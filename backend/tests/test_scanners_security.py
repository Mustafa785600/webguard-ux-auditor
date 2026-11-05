import pytest
from app.scanners.security.headers import SecurityHeadersScanner
from app.scanners.security.ssl_tls import SSLTLSScanner
from app.scanners.security.exposure import ExposureScanner, SENSITIVE_TARGETS
from app.scanners.security.error_handling import ErrorHandlingScanner
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
    assert "SEC_REFERRER_POLICY_MISSING" in finding_ids
    assert "SEC_PERMISSIONS_POLICY_MISSING" in finding_ids

@pytest.mark.asyncio
async def test_security_headers_present_all(mock_client_factory):
    scanner = SecurityHeadersScanner()
    headers = {
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    }
    client = mock_client_factory(default=MockResponse(200, "<html></html>", headers))
    findings = await scanner.scan("https://example.com", client)

    finding_ids = {f.id for f in findings}
    assert "SEC_HSTS_MISSING" not in finding_ids
    assert "SEC_CSP_MISSING" not in finding_ids
    assert "SEC_CLICKJACKING_RISK" not in finding_ids
    assert "SEC_NOSNIFF_MISSING" not in finding_ids
    assert "SEC_REFERRER_POLICY_MISSING" not in finding_ids
    assert "SEC_PERMISSIONS_POLICY_MISSING" not in finding_ids

@pytest.mark.asyncio
async def test_insecure_referrer_policy(mock_client_factory):
    scanner = SecurityHeadersScanner()
    headers = {
        "Strict-Transport-Security": "max-age=31536000",
        "Referrer-Policy": "unsafe-url",
        "Permissions-Policy": "camera=()"
    }
    client = mock_client_factory(default=MockResponse(200, "<html></html>", headers))
    findings = await scanner.scan("https://example.com", client)

    finding_ids = {f.id for f in findings}
    assert "SEC_INSECURE_REFERRER_POLICY" in finding_ids
    assert "SEC_REFERRER_POLICY_MISSING" not in finding_ids

@pytest.mark.asyncio
async def test_feature_policy_legacy_fallback(mock_client_factory):
    scanner = SecurityHeadersScanner()
    headers = {
        "Strict-Transport-Security": "max-age=31536000",
        "Referrer-Policy": "no-referrer",
        "Feature-Policy": "camera 'none'; microphone 'none'"
    }
    client = mock_client_factory(default=MockResponse(200, "<html></html>", headers))
    findings = await scanner.scan("https://example.com", client)

    finding_ids = {f.id for f in findings}
    assert "SEC_PERMISSIONS_POLICY_MISSING" not in finding_ids

@pytest.mark.asyncio
async def test_cookie_missing_samesite_and_flags(mock_client_factory):
    scanner = SecurityHeadersScanner()
    headers = {
        "Strict-Transport-Security": "max-age=31536000",
        "Set-Cookie": "session_id=12345; Path=/"
    }
    client = mock_client_factory(default=MockResponse(200, "<html></html>", headers))
    findings = await scanner.scan("https://example.com", client)

    cookie_finding = next((f for f in findings if f.id == "SEC_INSECURE_COOKIE"), None)
    assert cookie_finding is not None
    assert "Missing SameSite attribute" in cookie_finding.description
    assert "Missing Secure flag" in cookie_finding.description
    assert "Missing HttpOnly flag" in cookie_finding.description

@pytest.mark.asyncio
async def test_cookie_samesite_none_without_secure(mock_client_factory):
    scanner = SecurityHeadersScanner()
    headers = {
        "Strict-Transport-Security": "max-age=31536000",
        "Set-Cookie": "token=abc; HttpOnly; SameSite=None"
    }
    client = mock_client_factory(default=MockResponse(200, "<html></html>", headers))
    findings = await scanner.scan("https://example.com", client)

    cookie_finding = next((f for f in findings if f.id == "SEC_INSECURE_COOKIE"), None)
    assert cookie_finding is not None
    assert "SameSite=None without Secure flag" in cookie_finding.description

@pytest.mark.asyncio
async def test_cookie_fully_compliant(mock_client_factory):
    scanner = SecurityHeadersScanner()
    headers = {
        "Strict-Transport-Security": "max-age=31536000",
        "Content-Security-Policy": "default-src 'self'",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=()",
        "Set-Cookie": "session_id=secure_token; Secure; HttpOnly; SameSite=Lax"
    }
    client = mock_client_factory(default=MockResponse(200, "<html></html>", headers))
    findings = await scanner.scan("https://example.com", client)

    assert not any(f.id == "SEC_INSECURE_COOKIE" for f in findings)

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
async def test_ssl_tls_http_to_https_no_redirect(mock_client_factory):
    scanner = SSLTLSScanner()
    client = mock_client_factory(default=MockResponse(200, "Plaintext HTTP Content", {}))
    finding = await scanner._check_http_to_https_redirect("example.com", client)
    assert finding is not None
    assert finding.id == "SEC_HTTP_NO_REDIRECT"

@pytest.mark.asyncio
async def test_ssl_tls_http_to_https_temporary_redirect(mock_client_factory):
    scanner = SSLTLSScanner()
    client = mock_client_factory(default=MockResponse(302, "", {"Location": "https://example.com/"}))
    finding = await scanner._check_http_to_https_redirect("example.com", client)
    assert finding is not None
    assert finding.id == "SEC_HTTP_TEMPORARY_REDIRECT"

@pytest.mark.asyncio
async def test_ssl_tls_http_to_https_permanent_redirect(mock_client_factory):
    scanner = SSLTLSScanner()
    client = mock_client_factory(default=MockResponse(301, "", {"Location": "https://example.com/"}))
    finding = await scanner._check_http_to_https_redirect("example.com", client)
    assert finding is None

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

    sql_validator = next(t["validator"] for t in SENSITIVE_TARGETS if t["path"] == "/dump.sql")
    assert sql_validator("CREATE TABLE users (id int);\nINSERT INTO users VALUES (1);", "text/plain")
    assert sql_validator("-- MySQL dump 10.13\n-- Database: prod", "text/plain")
    assert not sql_validator("<!DOCTYPE html><html>404 Not Found</html>", "text/html")

    zip_validator = next(t["validator"] for t in SENSITIVE_TARGETS if t["path"] == "/backup.zip")
    assert zip_validator("PK\x03\x04\x00\x00", "application/zip", b"PK\x03\x04\x00\x00")
    assert zip_validator("binarydata", "application/zip")
    assert not zip_validator("<!DOCTYPE html><html>404 Not Found</html>", "text/html", b"<!DOCTYPE html>")

@pytest.mark.asyncio
async def test_exposure_scanner_finds_db_dump(mock_client_factory):
    scanner = ExposureScanner()
    responses = {
        "https://example.com/dump.sql": MockResponse(
            200,
            "-- MySQL dump 10.13\nCREATE TABLE `users` (`id` int);\nINSERT INTO `users` VALUES (1);",
            {"Content-Type": "application/sql"}
        )
    }
    client = mock_client_factory(responses=responses, default=MockResponse(404, "Not Found", {}))
    findings = await scanner.scan("https://example.com", client)

    dump_finding = next((f for f in findings if f.id == "SEC_EXPOSED_DB_DUMP"), None)
    assert dump_finding is not None
    assert "/dump.sql" in dump_finding.problematic_code

@pytest.mark.asyncio
async def test_error_handling_stack_trace_detected(mock_client_factory):
    scanner = ErrorHandlingScanner()
    django_debug_body = """
    <html><body>
    <h1>Exception Value: DisallowedHost</h1>
    <p>You're seeing this error because you have DEBUG = True in your Django settings file.</p>
    <pre>Traceback (most recent call last):
      File "/app/views.py", line 42, in index
        raise ValueError("Boom")
    </pre></body></html>
    """
    responses = {
        "https://example.com/webguard_err_handling_test_404_probe": MockResponse(500, django_debug_body, {})
    }
    client = mock_client_factory(responses=responses, default=MockResponse(200, "Normal Page", {}))
    findings = await scanner.scan("https://example.com", client)

    err_finding = next((f for f in findings if f.id == "SEC_STACK_TRACE_DISCLOSURE"), None)
    assert err_finding is not None
    assert "Django" in err_finding.title

@pytest.mark.asyncio
async def test_error_handling_clean_error_page(mock_client_factory):
    scanner = ErrorHandlingScanner()
    clean_body = """
    <!DOCTYPE html>
    <html><head><title>500 Internal Server Error</title></head>
    <body><h1>Oops! Something went wrong on our end.</h1>
    <p>Please contact support if the issue persists.</p></body></html>
    """
    client = mock_client_factory(default=MockResponse(500, clean_body, {}))
    findings = await scanner.scan("https://example.com", client)

    assert not any(f.id == "SEC_STACK_TRACE_DISCLOSURE" for f in findings)

def test_technology_vulnerability_checks():
    jquery_rule = next(r for r in KNOWN_TECH_RULES if r["name"] == "jQuery")
    assert jquery_rule["vulnerable_check"]("1.12.4") is True
    assert jquery_rule["vulnerable_check"]("3.4.1") is True
    assert jquery_rule["vulnerable_check"]("3.6.0") is False

    bootstrap_rule = next(r for r in KNOWN_TECH_RULES if r["name"] == "Bootstrap")
    assert bootstrap_rule["vulnerable_check"]("3.3.7") is True
    assert bootstrap_rule["vulnerable_check"]("4.3.1") is True
    assert bootstrap_rule["vulnerable_check"]("5.2.0") is False
