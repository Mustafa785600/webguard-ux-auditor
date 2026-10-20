import pytest
from bs4 import BeautifulSoup
from app.scanners.ux.basic_ux import BasicUXScanner
from app.scanners.ux.links import BrokenLinksScanner
from app.scanners.ux.forms_a11y import FormsA11yScanner
from tests.conftest import MockResponse

@pytest.mark.asyncio
async def test_basic_ux_missing_viewport_and_title(mock_client_factory):
    html = "<html><body><h1>Hello World</h1></body></html>"
    client = mock_client_factory(default=MockResponse(200, html, {}))
    scanner = BasicUXScanner()
    findings = await scanner.scan("https://example.com", client)

    finding_ids = {f.id for f in findings}
    assert "UX_MISSING_VIEWPORT" in finding_ids
    assert "UX_MISSING_TITLE" in finding_ids

@pytest.mark.asyncio
async def test_basic_ux_missing_image_alt(mock_client_factory):
    html = """
    <html>
      <head>
        <title>Valid Title</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <img src="/logo.png">
        <img src="/banner.jpg" alt="Valid Banner">
      </body>
    </html>
    """
    client = mock_client_factory(default=MockResponse(200, html, {}))
    scanner = BasicUXScanner()
    findings = await scanner.scan("https://example.com", client)

    alt_finding = next((f for f in findings if f.id == "UX_MISSING_IMG_ALT"), None)
    assert alt_finding is not None
    assert alt_finding.evidence["count"] == 1

def test_broken_links_url_cleaner():
    scanner = BrokenLinksScanner()
    base = "https://example.com/blog/article-1"

    assert scanner._clean_url(base, "javascript:void(0)") is None
    assert scanner._clean_url(base, "mailto:info@example.com") is None
    assert scanner._clean_url(base, "tel:+123456789") is None
    assert scanner._clean_url(base, "#comments") is None
    assert scanner._clean_url(base, "/about") == "https://example.com/about"
    assert scanner._clean_url(base, "../index.html") == "https://example.com/index.html"
    assert scanner._clean_url(base, "https://other.org/resource") == "https://other.org/resource"

def test_forms_a11y_violations():
    scanner = FormsA11yScanner()

    # GET method with password input
    html_get_pass = '<form method="get"><input type="password" name="pwd"></form>'
    soup = BeautifulSoup(html_get_pass, "html.parser")
    findings = scanner._check_form_method(soup.find_all("form"))
    assert any(f.id == "SEC_FORM_GET_SENSITIVE_DATA" for f in findings)

    # Empty button
    html_empty_btn = '<form><button aria-label=""></button></form>'
    soup = BeautifulSoup(html_empty_btn, "html.parser")
    findings = scanner._check_button_accessibility(soup.find_all("form"))
    assert any(f.id == "UX_FORM_EMPTY_BUTTONS" for f in findings)

    # Missing label
    html_unlabeled = '<html><body><form><input type="text" id="username"></form></body></html>'
    soup = BeautifulSoup(html_unlabeled, "html.parser")
    findings = scanner._check_input_labels(soup, soup.find_all("form"))
    assert any(f.id == "UX_FORM_UNLABELED_INPUTS" for f in findings)
