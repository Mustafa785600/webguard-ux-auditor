import pytest
from unittest.mock import AsyncMock, MagicMock
import httpx
from app.models.schema import EthicalSecurityReport, OpenDoorStatus
from app.services.ethical_security_engine import (
    EthicalSecurityEngine,
    CRITICAL_OPEN_DOORS,
    WAF_SIGNATURES,
)

def test_waf_signatures_present():
    assert len(WAF_SIGNATURES) >= 4
    vendors = [s["vendor"] for s in WAF_SIGNATURES]
    assert any("Cloudflare" in v for v in vendors)
    assert any("AWS" in v for v in vendors)

def test_open_doors_validators():
    env_target = next(item for item in CRITICAL_OPEN_DOORS if item["path"] == "/.env")
    # Real .env content should match
    assert env_target["validator"]("DB_PASSWORD=secret123\nAPP_KEY=base64:xyz") is True
    # Fake catch-all SPA HTML should not match
    assert env_target["validator"]("<!DOCTYPE html><html><body>Welcome to SPA</body></html>") is False

    git_target = next(item for item in CRITICAL_OPEN_DOORS if item["path"] == "/.git/HEAD")
    assert git_target["validator"]("ref: refs/heads/main\n") is True
    assert git_target["validator"]("<html>404 Not Found</html>") is False

@pytest.mark.asyncio
async def test_ethical_security_audit_with_mock_client():
    mock_client = AsyncMock(spec=httpx.AsyncClient)

    # Base response with Cloudflare WAF header
    base_response = MagicMock(spec=httpx.Response)
    base_response.status_code = 200
    base_response.headers = {"cf-ray": "84829104820", "server": "cloudflare"}
    base_response.text = "OK"
    base_response.content = b"OK"
    base_response.elapsed.total_seconds.return_value = 0.05

    # Probe response for canaries -> 403 Forbidden
    canary_response = MagicMock(spec=httpx.Response)
    canary_response.status_code = 403
    canary_response.headers = {}
    canary_response.text = "Forbidden"
    canary_response.content = b"Forbidden"
    canary_response.elapsed.total_seconds.return_value = 0.04

    # Burst response -> HTTP 429 Too Many Requests
    burst_response = MagicMock(spec=httpx.Response)
    burst_response.status_code = 429
    burst_response.headers = {"retry-after": "60"}
    burst_response.text = "Rate Limited"
    burst_response.content = b"Rate Limited"
    burst_response.elapsed.total_seconds.return_value = 0.02

    # Open door response -> 404 Not Found
    open_door_response = MagicMock(spec=httpx.Response)
    open_door_response.status_code = 404
    open_door_response.headers = {"content-type": "text/html"}
    open_door_response.text = "<!DOCTYPE html><html>404</html>"
    open_door_response.content = b"404"
    open_door_response.elapsed.total_seconds.return_value = 0.03

    def side_effect(url, **kwargs):
        if "webguard" in url:
            return canary_response
        elif any(od["path"] in url for od in CRITICAL_OPEN_DOORS):
            return open_door_response
        elif mock_client.get.call_count > 6:
            return burst_response
        return base_response

    mock_client.get.side_effect = side_effect

    report, findings = await EthicalSecurityEngine.audit(
        target_url="https://example.com", client=mock_client
    )

    assert isinstance(report, EthicalSecurityReport)
    assert report.target_url == "https://example.com"
    assert report.waf_detected is True
    assert report.waf_vendor == "Cloudflare WAF"
    assert report.cyber_resilience_score >= 70
    assert report.open_doors_probed >= len(CRITICAL_OPEN_DOORS)
    assert report.open_doors_exposed_count == 0
    assert report.resilience_tier in ("FORTRESS", "RESILIENT")
