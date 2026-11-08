import pytest
import httpx
from app.services.waf_leakage_prober import WAFLeakageProbingEngine
from app.models.schema import WAFProbeStatus, WAFResilienceReport, Severity

def test_waf_identification():
    engine = WAFLeakageProbingEngine()

    # Cloudflare detection
    cf_headers = httpx.Headers({"cf-ray": "8234719283712-IST", "server": "cloudflare"})
    cookies = httpx.Cookies()
    vendor, detected = engine._identify_waf(cf_headers, "", 200, cookies)
    assert detected is True
    assert "Cloudflare" in vendor

    # AWS WAF detection
    aws_headers = httpx.Headers({"x-amzn-requestid": "abc-123", "server": "awselb/2.0"})
    vendor, detected = engine._identify_waf(aws_headers, "", 200, cookies)
    assert detected is True
    assert "AWS WAF" in vendor

    # No WAF detection
    plain_headers = httpx.Headers({"server": "nginx/1.18.0", "content-type": "text/html"})
    vendor, detected = engine._identify_waf(plain_headers, "Welcome to my website", 200, cookies)
    assert detected is False
    assert "No WAF" in vendor

def test_response_evaluation():
    engine = WAFLeakageProbingEngine()

    # 1. Stack trace leak
    status, leak = engine._evaluate_response(500, "Traceback (most recent call last):\n  File 'app.py', line 42", None)
    assert status == WAFProbeStatus.STACK_TRACE_LEAK
    assert leak is not None

    # 2. Database query syntax leak
    status, leak = engine._evaluate_response(200, "You have an error in your SQL syntax near '1=1'", None)
    assert status == WAFProbeStatus.STACK_TRACE_LEAK

    # 3. Blocked by WAF
    status, leak = engine._evaluate_response(403, "Access Denied", "Cloudflare WAF")
    assert status == WAFProbeStatus.BLOCKED_BY_WAF
    assert leak is None

    # 4. Unhandled 500 without stack trace
    status, leak = engine._evaluate_response(500, "Internal Server Error", None)
    assert status == WAFProbeStatus.UNHANDLED_500_CRASH
    assert leak is None

    # 5. Handled cleanly
    status, leak = engine._evaluate_response(400, "Invalid input characters", None)
    assert status == WAFProbeStatus.HANDLED_CLEANLY
    assert leak is None

@pytest.mark.asyncio
async def test_audit_waf_mock_transport():
    # Transport that returns 403 on SQLi/XSS, and 200 on others
    def mock_handler(request: httpx.Request):
        url_str = str(request.url)
        headers = {"cf-ray": "test-ray-id", "server": "cloudflare"}
        if "1%3D1" in url_str or "script" in url_str:
            return httpx.Response(403, headers=headers, text="403 Forbidden - Cloudflare WAF")
        return httpx.Response(200, headers=headers, text="OK")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        engine = WAFLeakageProbingEngine()
        report, findings = await engine.audit_waf_and_error_leakage("https://example.com", client=client)

        assert isinstance(report, WAFResilienceReport)
        assert report.waf_detected is True
        assert "Cloudflare" in report.waf_vendor
        assert report.probes_blocked_by_waf > 0
        assert report.stack_trace_leaks == 0
        assert report.waf_protection_score >= 80

