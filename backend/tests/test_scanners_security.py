import pytest
from app.scanners.security.headers import SecurityHeadersScanner
from app.scanners.security.ssl_tls import SSLTLSScanner
from app.scanners.security.exposure import ExposureScanner, SENSITIVE_TARGETS
from app.scanners.security.technologies import TechnologyScanner, KNOWN_TECH_RULES
from tests.conftest import MockResponse

@pytest.mark.asyncio
async def test_security_headers_missing_all(mock_client_factory):
    scanner = SecurityHeadersScanner()
    client = mock_client_factory(default=MockResponse(200, "<html></html>", {}))
    findings = await scanner.scan("https://example.com", client)

    finding_ids = {f.id for f in findings}
    assert "SEC_HSTS_MISSING" in finding_ids
    assert "SEC_CSP_MISSING" in finding_ids
    assert "SEC_CLICKJACKING_RISK" in finding_ids
    assert "SEC_NOSNIFF_MISSING" in finding_ids

@pytest.mark.asyncio
async def test_security_headers_present_all(mock_client_factory):
    scanner = SecurityHeadersScanner()
    headers = {
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff"
    }
    client = mock_client_factory(default=MockResponse(200, "<html></html>", headers))
    findings = await scanner.scan("https://example.com", client)

    finding_ids = {f.id for f in findings}
    assert "SEC_HSTS_MISSING" not in finding_ids
    assert "SEC_CSP_MISSING" not in finding_ids
    assert "SEC_CLICKJACKING_RISK" not in finding_ids
    assert "SEC_NOSNIFF_MISSING" not in finding_ids

@pytest.mark.asyncio
async def test_server_version_leak(mock_client_factory):
    scanner = SecurityHeadersScanner()
    headers = {"Server": "Apache/2.4.41 (Ubuntu)", "X-Content-Type-Options": "nosniff"}
    client = mock_client_factory(default=MockResponse(200, "<html></html>", headers))
    findings = await scanner.scan("https://example.com", client)

    leak_finding = next((f for f in findings if f.id == "SEC_SERVER_INFO_LEAK"), None)
    assert leak_finding is not None
    assert "Apache/2.4.41" in leak_finding.description

@pytest.mark.asyncio
async def test_ssl_tls_plaintext_http():
    scanner = SSLTLSScanner()
    findings = await scanner.scan("http://insecure-site.com", None)
    assert any(f.id == "SEC_NO_ENCRYPTION" for f in findings)

@pytest.mark.asyncio
async def test_exposure_scanner_validators():
    env_validator = next(t["validator"] for t in SENSITIVE_TARGETS if t["path"] == "/.env")
    # Must match one of the exact keys the lambda checks
    assert env_validator("APP_KEY=base64:AAAA\nDB_PASSWORD=s3cr3t!", "text/plain")
    assert env_validator("SECRET_KEY=django-insecure-abc123", "text/plain")
    assert not env_validator("SOME_VAR=value\nANOTHER=nothing_sensitive", "text/plain")
    assert not env_validator("<html><body>404 Not Found</body></html>", "text/html")

    git_validator = next(t["validator"] for t in SENSITIVE_TARGETS if t["path"] == "/.git/HEAD")
    assert git_validator("ref: refs/heads/master\n", "text/plain")
    assert not git_validator("<!DOCTYPE html><html>Custom 404</html>", "text/html")

def test_technology_vulnerability_checks():
    jquery_rule = next(r for r in KNOWN_TECH_RULES if r["name"] == "jQuery")
    assert jquery_rule["vulnerable_check"]("1.12.4") is True
    assert jquery_rule["vulnerable_check"]("3.4.1") is True
    assert jquery_rule["vulnerable_check"]("3.6.0") is False

    bootstrap_rule = next(r for r in KNOWN_TECH_RULES if r["name"] == "Bootstrap")
    assert bootstrap_rule["vulnerable_check"]("3.3.7") is True
    assert bootstrap_rule["vulnerable_check"]("4.3.1") is True
    assert bootstrap_rule["vulnerable_check"]("5.2.0") is False
