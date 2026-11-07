import pytest
from playwright.async_api import async_playwright
from app.services.cookie_manager import CookieConsentManager, ConsentResult
from app.models.schema import Finding, Severity, Category


@pytest.mark.asyncio
async def test_cookie_consent_prefers_reject_over_accept():
    """
    Test Priority 1: When both 'Kabul Et' and 'Tümünü Reddet' are present,
    the manager MUST choose 'Tümünü Reddet' (User's primary requirement).
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <head><title>Cookie Test</title></head>
      <body>
        <h1>Test Page</h1>
        <div id="onetrust-banner-sdk" class="cookie-banner" style="position:fixed;bottom:0;width:100%;background:#eee;padding:20px;">
          <p>Sitemizde çerezler kullanılmaktadır (KVKK Bilgilendirmesi).</p>
          <button id="onetrust-accept-btn-handler" style="padding:10px;">Tümünü Kabul Et</button>
          <button id="onetrust-reject-all-handler" style="padding:10px;">Tümünü Reddet</button>
        </div>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        result = await CookieConsentManager.dismiss_cookie_banner(page)
        await browser.close()

        assert result.detected is True
        assert result.action == "REJECTED"
        assert result.dark_pattern_detected is False
        assert "Reddet" in (result.button_text or "")


@pytest.mark.asyncio
async def test_cookie_consent_selects_necessary_only_when_no_reject():
    """
    Test Priority 2: When no direct 'Reddet' button exists,
    it MUST choose 'Sadece Zorunlu Çerezler' (Necessary Only).
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <div class="cookie-consent" style="position:fixed;bottom:0;background:#333;color:#fff;padding:15px;">
          <p>Çerez Tercihleri</p>
          <button id="btn-necessary">Sadece Zorunlu Çerezler</button>
          <button id="btn-accept">Tümünü Kabul Et</button>
        </div>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        result = await CookieConsentManager.dismiss_cookie_banner(page)
        await browser.close()

        assert result.detected is True
        assert result.action == "NECESSARY_ONLY"
        assert result.dark_pattern_detected is False
        assert "Zorunlu" in (result.button_text or "")


@pytest.mark.asyncio
async def test_cookie_consent_detects_dark_pattern_when_only_accept_exists():
    """
    Test Priority 4: When a site forces consent with ONLY 'Kabul Et' (no Reddet / no Zorunlu),
    it clicks accept to avoid blocking page exploration, but flags a KVKK Dark Pattern finding.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <div class="cookie-modal" style="position:fixed;top:0;width:100%;height:100%;background:rgba(0,0,0,0.8);">
          <div style="background:#fff;padding:20px;margin:50px auto;width:300px;">
            <h3>Çerez Onayı</h3>
            <p>Devam etmek için çerezleri kabul etmek zorundasınız.</p>
            <button id="btn-accept">Kabul Et</button>
          </div>
        </div>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        result = await CookieConsentManager.dismiss_cookie_banner(page)
        await browser.close()

        assert result.detected is True
        assert result.action == "FORCED_ACCEPTED"
        assert result.dark_pattern_detected is True

        finding = CookieConsentManager.formulate_compliance_finding(result, "https://example-forced.com")
        assert finding is not None
        assert finding.id == "KVKK_FORCED_COOKIE_CONSENT"
        assert finding.severity == Severity.HIGH
        assert "KVKK Md. 5" in (finding.compliance_standard or "")
        assert "Hukuk & Uyum" in (finding.team_assignment or "")


@pytest.mark.asyncio
async def test_cookie_consent_graceful_when_no_banner():
    """
    When no cookie banner exists, it should return instantly with detected=False without error.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Normal Blog Page</h1>
        <p>No cookie banners here.</p>
        <button id="subscribe">Bültene Abone Ol</button>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        result = await CookieConsentManager.dismiss_cookie_banner(page)
        await browser.close()

        assert result.detected is False
        assert result.action == "NONE"
        assert result.dark_pattern_detected is False
