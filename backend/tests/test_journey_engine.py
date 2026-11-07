import pytest
from playwright.async_api import async_playwright
from app.services.journey_engine import MultiStepJourneyEngine, UserJourneyResult, JourneyStepResult
from app.models.schema import Severity, Category, RCACategory


@pytest.mark.asyncio
async def test_wizard_journey_advances_steps():
    """
    Test that MultiStepJourneyEngine detects a multi-step form,
    fills Step 1, clicks 'İleri', and verifies transition to Step 2.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <form id="wizard-form">
          <div id="step-1" class="step active">
            <h3>Adım 1: İletişim Bilgileri</h3>
            <input type="email" id="email" placeholder="E-posta" />
            <button type="button" id="btn-next" onclick="
              document.getElementById('step-1').style.display = 'none';
              document.getElementById('step-2').style.display = 'block';
              document.getElementById('step-2').className = 'step active';
            ">İleri</button>
          </div>
          <div id="step-2" class="step" style="display:none;">
            <h3>Adım 2: Onay</h3>
            <input type="text" id="confirmation-code" placeholder="Onay Kodu" />
            <button type="submit">Tamamla</button>
          </div>
        </form>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.set_content(html_content)

        journey = await MultiStepJourneyEngine.execute_best_journey(page, "https://example.com/signup")
        await browser.close()

        assert journey is not None
        assert journey.archetype == "WIZARD_FORM"
        assert journey.success is True
        assert journey.state_transition_verified is True
        assert journey.steps_completed >= 2

        finding = MultiStepJourneyEngine.formulate_journey_finding(journey, "https://example.com/signup")
        assert finding.id == "QA_MULTI_STEP_JOURNEY_VERIFIED"
        assert finding.severity == Severity.INFO
        assert len(finding.reproduction_steps) >= 2


@pytest.mark.asyncio
async def test_search_journey_executes_search_and_verifies_results():
    """
    Test that MultiStepJourneyEngine detects a search box, fills query,
    submits Enter, and verifies results.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <header>
          <form action="/search" method="GET">
            <input type="search" name="q" placeholder="Ürün veya içerik ara..." />
          </form>
        </header>
        <main>
          <h1>Ana Sayfa</h1>
        </main>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.set_content(html_content)

        journey = await MultiStepJourneyEngine.execute_best_journey(page, "https://example.com")
        await browser.close()

        assert journey is not None
        assert journey.archetype == "SEARCH_DETAIL"
        assert journey.success is True
        assert journey.steps_completed >= 2


@pytest.mark.asyncio
async def test_auth_modal_journey_opens_and_dismisses():
    """
    Test that MultiStepJourneyEngine detects Login button, opens modal dialog,
    verifies presence, and dismisses cleanly.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <nav>
          <button id="login-btn" onclick="document.getElementById('auth-dialog').style.display='block';">
            Giriş Yap
          </button>
        </nav>
        <div id="auth-dialog" role="dialog" class="modal" style="display:none;">
          <h2>Kullanıcı Girişi</h2>
          <input type="text" placeholder="Kullanıcı Adı" />
          <input type="password" placeholder="Şifre" />
          <a href="/sifremi-unuttum">Şifremi Unuttum</a>
        </div>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.set_content(html_content)

        journey = await MultiStepJourneyEngine.execute_best_journey(page, "https://example.com")
        await browser.close()

        assert journey is not None
        assert journey.archetype == "AUTH_MODAL"
        assert journey.success is True
        assert journey.state_transition_verified is True


@pytest.mark.asyncio
async def test_journey_engine_graceful_when_no_interactive_flows():
    """
    When no search, wizard, cart, or CTA exists, returns None cleanly.
    """
    html_content = "<html><body><p>Static article text.</p></body></html>"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        journey = await MultiStepJourneyEngine.execute_best_journey(page, "https://example.com")
        await browser.close()

        assert journey is None

