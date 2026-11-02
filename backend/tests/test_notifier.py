import pytest
from datetime import datetime
from app.services.notifier import _format_discord_payload, _format_slack_payload, dispatch_webhook
from app.models.schema import ScanResult, ScanStatus, Finding, Category, Severity


def _dummy_scan_result():
    return ScanResult(
        scan_id="test-scan-12345",
        target_url="https://example.com",
        status=ScanStatus.COMPLETED,
        security_score=85,
        ux_score=90,
        findings=[
            Finding(
                id="SEC_TEST",
                category=Category.SECURITY,
                severity=Severity.CRITICAL,
                title="Critical SQL Leak",
                description="Test description",
                remediation="Fix query"
            )
        ],
        started_at=datetime.utcnow()
    )


def test_format_discord_payload():
    scan = _dummy_scan_result()
    payload = _format_discord_payload(scan)
    assert "embeds" in payload
    assert len(payload["embeds"]) == 1
    embed = payload["embeds"][0]
    assert "https://example.com" in embed["title"]
    assert any(f["name"] == "🛡️ Security Score" for f in embed["fields"])
    assert any("Critical SQL Leak" in f.get("value", "") for f in embed["fields"])


def test_format_slack_payload():
    scan = _dummy_scan_result()
    payload = _format_slack_payload(scan)
    assert "blocks" in payload
    assert len(payload["blocks"]) >= 2
    assert "WebGuard Audit" in payload["blocks"][0]["text"]["text"]


@pytest.mark.asyncio
async def test_dispatch_webhook_graceful_on_invalid_url():
    scan = _dummy_scan_result()
    # Should safely return False on invalid url without throwing unhandled exceptions
    result = await dispatch_webhook("invalid-url-protocol", scan)
    assert result is False

    result_empty = await dispatch_webhook("", scan)
    assert result_empty is False
