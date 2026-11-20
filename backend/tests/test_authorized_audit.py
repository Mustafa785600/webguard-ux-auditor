import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.challenge_detector import ChallengeDetector, ChallengeDetectionResult
from app.services.ethical_security_engine import EthicalSecurityEngine, WAF_SIGNATURES
from app.models.schema import Finding, Category, Severity, RCACategory


def test_akamai_bot_shield_detection():
    """Verify Akamai Bot Manager detection from block page text and reference code."""
    sample_akamai_html = """
    <html>
        <body>
            <h1>Bağlantınız güvensiz olarak algılandığı için siteye erişemiyorsunuz.</h1>
            <p>Bağlantınızı kontrol edip sayfayı yenileyin veya farklı bir tarayıcıdan giriş yapmayı deneyin.</p>
            <p>Referans Kodu: 0.95622c17.1794640188.88ecb18</p>
            <p>IP Adresi: 74.220.48.202</p>
        </body>
    </html>
    """
    res = ChallengeDetector.inspect_http_response(
        status_code=403,
        headers={"Server": "AkamaiGHost", "Content-Type": "text/html"},
        body_text=sample_akamai_html
    )

    assert res.detected is True
    assert res.challenge_type == "AKAMAI_BOT_MANAGER"
    assert res.is_bot_shield is True
    assert "Akamai" in res.provider_name

    # Check finding generation
    finding = ChallengeDetector.formulate_hitl_finding(res, "https://www.hepsiburada.com")
    assert finding is not None
    assert finding.id == "SEC_BOT_SHIELD_VERIFIED_PERIMETER_DEFENSE"
    assert finding.category == Category.SECURITY
    assert finding.rca_category == RCACategory.EXPECTED_BEHAVIOR
    assert "Akamai" in finding.title
    assert "100/100" in finding.title
    assert "X-Audit-Token" in finding.remediation


def test_cloudflare_waf_detection():
    """Verify Cloudflare WAF block detection from HTTP response."""
    res = ChallengeDetector.inspect_http_response(
        status_code=403,
        headers={"Server": "cloudflare", "cf-ray": "82a123456789"},
        body_text="<title>Error 1020: Access denied</title><p>Cloudflare Ray ID: 82a123456789</p>"
    )

    assert res.detected is True
    assert res.challenge_type == "CLOUDFLARE_WAF"
    assert res.is_bot_shield is True
    assert "Cloudflare" in res.provider_name


@pytest.mark.asyncio
async def test_ethical_security_engine_with_bot_shield():
    """Verify that EthicalSecurityEngine boosts WAF and resilience scores to 100/100 when Akamai is verified."""
    mock_client = AsyncMock()

    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_resp.headers = {"server": "akamaighost"}
    mock_resp.text = "Bağlantınız güvensiz Referans Kodu: 0.95622c17.1794640188.88ecb18"
    mock_resp.content = b"Blocked"
    mock_resp.elapsed.total_seconds.return_value = 0.05

    mock_client.get.return_value = mock_resp

    custom_headers = {"X-Audit-Token": "hb_qa_token_2026"}

    report, findings = await EthicalSecurityEngine.audit(
        target_url="https://www.hepsiburada.com",
        client=mock_client,
        custom_headers=custom_headers
    )

    assert report.bot_shield_detected is True
    assert "Akamai" in (report.bot_shield_name or "")
    assert report.waf_filtering_score == 100
    assert report.cyber_resilience_score >= 95
    assert report.resilience_tier == "FORTRESS"
    assert report.authorized_audit_active is True
    assert any("Akamai" in s for s in report.key_strengths)
