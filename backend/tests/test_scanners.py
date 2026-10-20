import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.security import validate_and_sanitize_target_url, SecurityValidationError
from app.services.orchestrator import execute_scan
from app.services.scorer import calculate_category_score
from app.models.schema import Finding, Category, Severity

def test_ssrf_protection():
    forbidden_targets = [
        "http://127.0.0.1",
        "http://localhost",
        "http://192.168.1.1",
        "http://10.0.0.1",
        "http://169.254.169.254",
    ]
    for target in forbidden_targets:
        try:
            validate_and_sanitize_target_url(target)
            assert False, f"SSRF check failed to block: {target}"
        except SecurityValidationError:
            pass
    print("[PASS] SSRF & Private IP blocking test passed.")

def test_scorer():
    findings = [
        Finding(
            id="TEST_1",
            category=Category.SECURITY,
            severity=Severity.HIGH,
            title="Test High",
            description="",
            remediation=""
        ),
        Finding(
            id="TEST_2",
            category=Category.SECURITY,
            severity=Severity.MEDIUM,
            title="Test Medium",
            description="",
            remediation=""
        )
    ]
    # 100 - 20 (HIGH) - 10 (MEDIUM) = 70
    score = calculate_category_score(findings, Category.SECURITY)
    assert score == 70, f"Expected 70, got {score}"
    print("[PASS] Scorer calculations test passed.")

async def test_live_scan():
    result = await execute_scan("https://example.com")
    assert result.status == "COMPLETED", f"Expected COMPLETED, got {result.status}"
    assert result.security_score <= 100
    assert result.ux_score <= 100
    print(f"[PASS] Scan on example.com succeeded. Security: {result.security_score}, UX: {result.ux_score}, Findings: {len(result.findings)}")

async def test_ssl_tls_scanner():
    from app.scanners.security.ssl_tls import SSLTLSScanner
    scanner = SSLTLSScanner()
    # Test plaintext http detection
    http_findings = await scanner.scan("http://example.com", None)
    assert any(f.id == "SEC_NO_ENCRYPTION" for f in http_findings)

    # Test valid https certificate check
    https_findings = await scanner.scan("https://example.com", None)
    assert not any(f.id == "SEC_NO_ENCRYPTION" for f in https_findings)
    print(f"[PASS] SSL/TLS scanner test passed (HTTP plaintext flagged, HTTPS verified).")

async def test_exposure_scanner():
    from app.scanners.security.exposure import ExposureScanner, SENSITIVE_TARGETS
    scanner = ExposureScanner()
    # Test validator logic directly
    env_validator = next(t["validator"] for t in SENSITIVE_TARGETS if t["path"] == "/.env")
    assert env_validator("DB_PASSWORD=secret123\nAPP_KEY=base64:xyz", "text/plain")
    assert not env_validator("<!DOCTYPE html><html><body>404 Not Found</body></html>", "text/html")

    git_validator = next(t["validator"] for t in SENSITIVE_TARGETS if t["path"] == "/.git/HEAD")
    assert git_validator("ref: refs/heads/main\n", "text/plain")
    assert not git_validator("<html><body>Not Found</body></html>", "text/html")
    print("[PASS] Exposure scanner validators test passed.")

async def test_broken_links_scanner():
    from app.scanners.ux.links import BrokenLinksScanner
    scanner = BrokenLinksScanner()
    assert scanner._clean_url("https://example.com/page", "javascript:void(0)") is None
    assert scanner._clean_url("https://example.com/page", "mailto:test@example.com") is None
    assert scanner._clean_url("https://example.com/page", "#section") is None
    assert scanner._clean_url("https://example.com/page", "/about") == "https://example.com/about"
    assert scanner._clean_url("https://example.com/page", "https://cdn.example.com/style.css") == "https://cdn.example.com/style.css"
    print("[PASS] Broken links URL cleaning and resolution test passed.")

async def test_technology_scanner():
    from app.scanners.security.technologies import KNOWN_TECH_RULES
    jquery_rule = next(r for r in KNOWN_TECH_RULES if r["name"] == "jQuery")
    assert jquery_rule["vulnerable_check"]("2.1.4") is True
    assert jquery_rule["vulnerable_check"]("3.4.1") is True
    assert jquery_rule["vulnerable_check"]("3.6.0") is False

    bootstrap_rule = next(r for r in KNOWN_TECH_RULES if r["name"] == "Bootstrap")
    assert bootstrap_rule["vulnerable_check"]("3.3.7") is True
    assert bootstrap_rule["vulnerable_check"]("4.4.1") is True
    assert bootstrap_rule["vulnerable_check"]("5.1.0") is False
    print("[PASS] Technology fingerprinting & vulnerability check test passed.")

def test_forms_a11y_scanner():
    from app.scanners.ux.forms_a11y import FormsA11yScanner
    from bs4 import BeautifulSoup

    scanner = FormsA11yScanner()

    # GET form with password field → SEC_FORM_GET_SENSITIVE_DATA
    html_get_pass = '<form method="get"><input type="password" name="password"></form>'
    soup = BeautifulSoup(html_get_pass, "html.parser")
    findings = scanner._check_form_method(soup.find_all("form"))
    assert any(f.id == "SEC_FORM_GET_SENSITIVE_DATA" for f in findings)

    # Button without label → UX_FORM_EMPTY_BUTTONS
    html_empty_btn = '<form><button></button></form>'
    soup = BeautifulSoup(html_empty_btn, "html.parser")
    findings = scanner._check_button_accessibility(soup.find_all("form"))
    assert any(f.id == "UX_FORM_EMPTY_BUTTONS" for f in findings)

    # Input without label → UX_FORM_UNLABELED_INPUTS
    html_unlabeled = '<html><body><form><input type="text" id="email"></form></body></html>'
    soup = BeautifulSoup(html_unlabeled, "html.parser")
    findings = scanner._check_input_labels(soup, soup.find_all("form"))
    assert any(f.id == "UX_FORM_UNLABELED_INPUTS" for f in findings)

    print("[PASS] Forms & Accessibility scanner test passed.")

if __name__ == "__main__":
    test_ssrf_protection()
    test_scorer()
    asyncio.run(test_ssl_tls_scanner())
    asyncio.run(test_exposure_scanner())
    asyncio.run(test_technology_scanner())
    asyncio.run(test_broken_links_scanner())
    test_forms_a11y_scanner()
    asyncio.run(test_live_scan())
