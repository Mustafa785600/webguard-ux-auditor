import pytest
from playwright.async_api import async_playwright
from app.services.challenge_detector import ChallengeDetector, ChallengeDetectionResult
from app.models.schema import Severity, Category, RCACategory


@pytest.mark.asyncio
async def test_challenge_detector_detects_recaptcha():
    """
    Test that presence of Google reCAPTCHA triggers detection and halts automation.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <form id="contact-form">
          <input type="email" placeholder="E-posta" />
          <div class="g-recaptcha" data-sitekey="testSiteKey123"></div>
          <button type="submit">Gönder</button>
        </form>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        result = await ChallengeDetector.inspect_and_halt_if_gated(page)
        await browser.close()

        assert result.detected is True
        assert result.challenge_type == "RECAPTCHA"
        assert result.halted_automation is True
        assert "Google reCAPTCHA" in result.provider_name


@pytest.mark.asyncio
async def test_challenge_detector_detects_turnstile():
    """
    Test that Cloudflare Turnstile is identified as an anti-bot barrier.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <div class="cf-turnstile" data-sitekey="testSiteKey"></div>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        result = await ChallengeDetector.inspect_and_halt_if_gated(page)
        await browser.close()

        assert result.detected is True
        assert result.challenge_type == "TURNSTILE"
        assert "Cloudflare Turnstile" in result.provider_name


@pytest.mark.asyncio
async def test_challenge_detector_detects_2fa():
    """
    Test that a 2FA OTP prompt is identified to halt automated brute-forcing.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <form id="otp-form">
          <h2>İki Adımlı Doğrulama</h2>
          <input type="text" autocomplete="one-time-code" id="otp-code" placeholder="SMS Doğrulama Kodu" />
          <button type="submit">Doğrula</button>
        </form>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        result = await ChallengeDetector.inspect_and_halt_if_gated(page)
        await browser.close()

        assert result.detected is True
        assert result.challenge_type == "TWO_FACTOR_AUTH"
        assert result.halted_automation is True


@pytest.mark.asyncio
async def test_challenge_detector_formulates_finding():
    """
    Test that formulate_hitl_finding generates an actionable finding with staging bypass guidance.
    """
    res = ChallengeDetectionResult(
        detected=True,
        challenge_type="RECAPTCHA",
        element_selector=".g-recaptcha",
        provider_name="Google reCAPTCHA",
        halted_automation=True,
        details="reCAPTCHA detected"
    )
    finding = ChallengeDetector.formulate_hitl_finding(res, "https://example.com/login")
    assert finding is not None
    assert finding.id == "QA_CAPTCHA_OR_2FA_GATE_DETECTED"
    assert finding.severity == Severity.INFO
    assert "Verification Gate Detected" in finding.title
    assert "X-QA-Bypass-Token" in finding.remediation


@pytest.mark.asyncio
async def test_challenge_detector_returns_clean_when_no_gate():
    """
    When no CAPTCHA or 2FA exists, returns detected=False cleanly.
    """
    html_content = "<html><body><form><input type='text'/><button>Submit</button></form></body></html>"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        result = await ChallengeDetector.inspect_and_halt_if_gated(page)
        await browser.close()

        assert result.detected is False
        assert result.challenge_type is None
