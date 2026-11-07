import pytest
from playwright.async_api import async_playwright
from app.services.scroll_manager import HumanScrollEngine, HumanScrollResult
from app.models.schema import Severity, Category


@pytest.mark.asyncio
async def test_human_scroll_executes_smoothly_on_tall_page():
    """
    Test that on a tall document (>2500px), HumanScrollEngine performs
    incremental steps, records distance, and returns the viewport to top.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <head><title>Tall Page</title></head>
      <body style="margin:0; padding:0;">
        <header style="height:100px; background:#333; color:#fff;">Header</header>
        <div style="height:1200px; background:#f0f0f0;">Section 1 Content</div>
        <div style="height:1200px; background:#e0e0e0;">Section 2 Content</div>
        <footer style="height:400px; background:#222; color:#fff;">Footer Content</footer>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.set_content(html_content)

        result = await HumanScrollEngine.smooth_scroll_page(
            page, max_steps=6, step_px=350, pause_ms=50, return_to_top=True
        )

        # Viewport should be back near top after return_to_top=True
        final_scroll_y = await page.evaluate("window.scrollY || window.pageYOffset || 0")

        await browser.close()

        assert result.total_scrolled_px >= 350
        assert result.scroll_steps >= 1
        assert result.max_page_height >= 2500
        assert result.duration_ms > 0
        assert final_scroll_y == 0


@pytest.mark.asyncio
async def test_human_scroll_triggers_lazy_images_and_detects_broken():
    """
    Test that scroll triggers hydration and flags broken lazy-loaded images (naturalWidth == 0).
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body style="height:2800px;">
        <h1>Image Gallery</h1>
        <div style="height:1000px;">Top Spacer</div>
        <!-- Broken image below the fold -->
        <img id="broken-img" src="data:image/png;base64,brokenInvalidImageData123" style="width:200px;height:200px;" alt="Broken Asset" />
        <div style="height:1000px;">Bottom Spacer</div>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.set_content(html_content)

        # Force image error state simulation in DOM
        await page.evaluate("""
            () => {
                const img = document.getElementById('broken-img');
                Object.defineProperty(img, 'complete', { value: true });
                Object.defineProperty(img, 'naturalWidth', { value: 0 });
            }
        """)

        result = await HumanScrollEngine.smooth_scroll_page(
            page, max_steps=4, step_px=400, pause_ms=50, return_to_top=True
        )

        assert result.broken_images_detected >= 1
        finding = HumanScrollEngine.formulate_broken_assets_finding(result, "https://example-gallery.com")
        assert finding is not None
        assert finding.id == "UX_LAZY_LOAD_BROKEN_ASSET"
        assert finding.category == Category.UX
        assert finding.severity == Severity.MEDIUM
        assert "Lazy-Loaded Image Asset(s)" in finding.title

        await browser.close()


@pytest.mark.asyncio
async def test_human_scroll_skips_short_page():
    """
    Test that if page content fits within viewport, scrolling is skipped gracefully.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body style="height:400px; margin:0;">
        <h1>Compact Card</h1>
        <p>Short content.</p>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.set_content(html_content)

        result = await HumanScrollEngine.smooth_scroll_page(page, max_steps=6, step_px=350)
        await browser.close()

        assert result.scroll_steps == 0
        assert result.total_scrolled_px == 0
        assert "scroll skipped" in result.details.lower()

