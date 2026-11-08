import pytest
import httpx
from app.services.rate_limit_auditor import RateLimitingAuditor
from app.models.schema import RateLimitStatus, Severity, RCACategory

@pytest.mark.asyncio
async def test_rate_limiting_enforced_with_retry_after():
    call_count = 0

    def mock_handler(request: httpx.Request):
        nonlocal call_count
        call_count += 1
        # First 4 requests return 401 Unauthorized (invalid canary credentials)
        if call_count < 5:
            return httpx.Response(401, json={"detail": "Invalid credentials"}, headers={"ratelimit-remaining": str(5 - call_count)})
        # 5th request triggers HTTP 429 with Retry-After
        return httpx.Response(
            429,
            json={"error": "Too Many Requests", "detail": "Rate limit exceeded. Try again in 60s."},
            headers={
                "retry-after": "60",
                "ratelimit-remaining": "0",
                "x-ratelimit-limit": "5",
            }
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://mock-service.local") as client:
        auditor = RateLimitingAuditor(burst_count=15)
        report, findings = await auditor.audit_rate_limiting("http://mock-service.local/login", client=client)

    assert report.rate_limiting_detected is True
    assert report.status == RateLimitStatus.ENFORCED_HTTP_429
    assert report.resilience_score == 100
    assert report.http_429_received is True
    assert report.retry_after_header_present is True
    assert report.throttled_at_attempt == 4
    assert "retry-after" in report.rate_limit_headers
    # Loop should have broken early upon throttling
    assert len(report.attempts) == 4
    # Should not produce missing rate limit finding
    assert not any(f.id == "SEC_RATE_LIMIT_ABSENT" for f in findings)
    assert not any(f.id == "SEC_RATE_LIMIT_MISSING_RETRY_AFTER" for f in findings)

@pytest.mark.asyncio
async def test_rate_limiting_enforced_missing_retry_after():
    call_count = 0

    def mock_handler(request: httpx.Request):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return httpx.Response(401, json={"detail": "Bad password"})
        return httpx.Response(429, json={"error": "Rate limit reached"})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://mock-service.local") as client:
        auditor = RateLimitingAuditor(burst_count=10)
        report, findings = await auditor.audit_rate_limiting("http://mock-service.local/api/auth/login", client=client)

    assert report.rate_limiting_detected is True
    assert report.status == RateLimitStatus.ENFORCED_HTTP_429
    assert report.resilience_score == 90
    assert report.retry_after_header_present is False
    assert any(f.id == "SEC_RATE_LIMIT_MISSING_RETRY_AFTER" for f in findings)

@pytest.mark.asyncio
async def test_rate_limiting_not_enforced_generates_finding():
    def mock_handler(request: httpx.Request):
        # Always returns 200/401 with no rate limit headers or delay
        return httpx.Response(200, json={"status": "ok"})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://vulnerable-auth.local") as client:
        auditor = RateLimitingAuditor(burst_count=8)
        report, findings = await auditor.audit_rate_limiting("http://vulnerable-auth.local/login", client=client)

    assert report.rate_limiting_detected is False
    assert report.status == RateLimitStatus.NOT_ENFORCED
    assert report.resilience_score == 30
    assert report.throttled_at_attempt is None
    assert len(report.attempts) == 8

    # Finding validation
    absent_findings = [f for f in findings if f.id == "SEC_RATE_LIMIT_ABSENT"]
    assert len(absent_findings) == 1
    finding = absent_findings[0]
    assert finding.severity == Severity.HIGH
    assert "BDDK Madde 34" in finding.compliance_standard
    assert "OWASP API4:2023" in finding.compliance_standard
    assert "PCI-DSS 8.3.4" in finding.compliance_standard
    assert finding.rca_category == RCACategory.REAL_BUG
    assert "SlowAPI" in (finding.code_example or "")
