import pytest
import httpx
from app.services.dast_verifier import DASTExploitVerifier
from app.models.schema import DASTVerificationStatus, DASTTestCategory, Severity

@pytest.mark.asyncio
async def test_dast_clean_target_all_safe():
    def mock_handler(request: httpx.Request):
        url_str = str(request.url)
        # Sensitive files return 404
        if any(p in url_str for p in ("/.env", "/.git", "/backup", "/dump", "/actuator", "/phpinfo")):
            return httpx.Response(404, text="Not Found")
        # CORS handles safely without arbitrary origin reflection
        if request.headers.get("origin"):
            return httpx.Response(200, headers={"access-control-allow-origin": "https://trusted.local"}, text="OK")
        # Search parameters encode inputs
        return httpx.Response(200, text="<html><body>Search: &lt;u&gt;safe&lt;/u&gt;</body></html>")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://clean-target.local") as client:
        verifier = DASTExploitVerifier()
        report, findings = await verifier.verify_vulnerabilities("http://clean-target.local", client=client)

    assert report.dast_confidence_score == 100
    assert report.confirmed_vulnerabilities_count == 0
    assert report.false_positives_filtered_count >= 5
    assert len(findings) == 0

@pytest.mark.asyncio
async def test_dast_confirmed_sensitive_file_exposure():
    def mock_handler(request: httpx.Request):
        url_str = str(request.url)
        if "/.env" in url_str:
            return httpx.Response(200, text="DATABASE_URL=postgres://user:pass@localhost:5432/db\nSECRET_KEY=supersecretkey")
        return httpx.Response(404, text="Not Found")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://exposed-site.local") as client:
        verifier = DASTExploitVerifier()
        report, findings = await verifier.verify_vulnerabilities("http://exposed-site.local", client=client)

    assert report.confirmed_vulnerabilities_count >= 1
    assert report.dast_confidence_score < 100

    env_items = [v for v in report.verifications if "DAST-EXP-env" in v.test_id]
    assert len(env_items) == 1
    assert env_items[0].verification_status == DASTVerificationStatus.CONFIRMED
    assert env_items[0].severity == Severity.HIGH
    assert any(f.id.startswith("DAST_CONFIRMED_EXPOSURE") for f in findings)

@pytest.mark.asyncio
async def test_dast_confirmed_cors_misconfiguration():
    def mock_handler(request: httpx.Request):
        req_origin = request.headers.get("origin", "")
        # VULNERABLE: dynamically reflects arbitrary origin with credentials true
        headers = {
            "access-control-allow-origin": req_origin,
            "access-control-allow-credentials": "true",
        }
        return httpx.Response(200, headers=headers, text="OK")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://vulnerable-cors.local") as client:
        verifier = DASTExploitVerifier()
        report, findings = await verifier.verify_vulnerabilities("http://vulnerable-cors.local", client=client)

    cors_items = [v for v in report.verifications if v.category == DASTTestCategory.CORS_MISCONFIGURATION]
    assert len(cors_items) == 1
    assert cors_items[0].verification_status == DASTVerificationStatus.CONFIRMED
    assert cors_items[0].severity == Severity.HIGH
    assert any(f.id == "DAST_CONFIRMED_CORS_ARBITRARY_ORIGIN" for f in findings)

@pytest.mark.asyncio
async def test_dast_reflected_canary_xss_confirmed():
    from urllib.parse import unquote

    def mock_handler(request: httpx.Request):
        # VULNERABLE: web framework parses/unquotes query param and reflects raw in HTML
        query = unquote(request.url.query.decode("utf-8"))
        return httpx.Response(200, text=f"<html><body>Your query: {query}</body></html>")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://vulnerable-xss.local") as client:
        verifier = DASTExploitVerifier()
        report, findings = await verifier.verify_vulnerabilities("http://vulnerable-xss.local", client=client)

    xss_items = [v for v in report.verifications if v.category == DASTTestCategory.REFLECTED_INPUT_SANITIZATION]
    assert len(xss_items) >= 1
    assert xss_items[0].verification_status == DASTVerificationStatus.CONFIRMED
    assert any(f.id == "DAST_CONFIRMED_REFLECTED_XSS" for f in findings)

@pytest.mark.asyncio
async def test_dast_open_redirect_confirmed():
    def mock_handler(request: httpx.Request):
        url_str = str(request.url)
        if "redirect_url=" in url_str:
            # VULNERABLE: redirects directly to external location
            dest = "https://example.com/webguard-canary-redirect"
            return httpx.Response(302, headers={"location": dest}, text="Redirecting...")
        return httpx.Response(200, text="Login Page")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://vulnerable-redirect.local") as client:
        verifier = DASTExploitVerifier()
        report, findings = await verifier.verify_vulnerabilities("http://vulnerable-redirect.local", client=client)

    red_items = [v for v in report.verifications if v.category == DASTTestCategory.OPEN_REDIRECT]
    assert len(red_items) == 1
    assert red_items[0].verification_status == DASTVerificationStatus.CONFIRMED
    assert any(f.id == "DAST_CONFIRMED_OPEN_REDIRECT" for f in findings)
