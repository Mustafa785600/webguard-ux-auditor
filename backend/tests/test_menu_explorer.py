import pytest
from playwright.async_api import async_playwright
from app.services.menu_explorer import NavigationMenuExplorer, MenuTraversalResult
from app.models.schema import Severity, Category, RCACategory


@pytest.mark.asyncio
async def test_menu_explorer_reveals_hover_dropdown_links():
    """
    Test that hovering over a nav item with a CSS/JS hover dropdown
    dynamically reveals hidden sub-routes.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          .dropdown-menu { display: none; }
          .nav-item:hover .dropdown-menu { display: block; }
        </style>
      </head>
      <body>
        <nav>
          <ul>
            <li class="nav-item">
              <a href="#" aria-haspopup="true">Ürünler</a>
              <ul class="dropdown-menu">
                <li><a href="/urunler/guvenlik">Siber Güvenlik</a></li>
                <li><a href="/urunler/bulut">Bulut Çözümleri</a></li>
              </ul>
            </li>
            <li><a href="/iletisim">İletişim</a></li>
          </ul>
        </nav>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.set_content(html_content)

        result = await NavigationMenuExplorer.explore_dropdown_menus(page, base_url="https://example.com")
        await browser.close()

        assert result.menus_probed >= 1
        assert result.dropdowns_opened >= 1
        assert result.hidden_links_revealed >= 1
        assert any("/urunler/guvenlik" in url for url in result.revealed_urls)


@pytest.mark.asyncio
async def test_menu_explorer_reveals_click_dropdown_links():
    """
    Test that clicking an interactive button dropdown reveals hidden category links.
    """
    html_content = """
    <!DOCTYPE html>
    <html>
      <body>
        <nav>
          <div class="dropdown">
            <button id="btn-services" aria-haspopup="true" onclick="document.getElementById('services-menu').style.display = 'block';">
              Hizmetlerimiz
            </button>
            <div id="services-menu" class="dropdown-menu" style="display:none;">
              <a href="/hizmetler/penetrasyon">Sızma Testi</a>
              <a href="/hizmetler/denetim">Güvenlik Denetimi</a>
            </div>
          </div>
        </nav>
      </body>
    </html>
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.set_content(html_content)

        result = await NavigationMenuExplorer.explore_dropdown_menus(page, base_url="https://example.com")
        await browser.close()

        assert result.menus_probed >= 1
        assert result.dropdowns_opened >= 1
        assert result.hidden_links_revealed >= 2
        assert any("/hizmetler/penetrasyon" in url for url in result.revealed_urls)


@pytest.mark.asyncio
async def test_menu_explorer_formulates_summary_finding():
    """
    Test that formulate_menu_summary_finding produces a valid UX finding.
    """
    result = MenuTraversalResult(
        menus_probed=3,
        dropdowns_opened=2,
        hidden_links_revealed=4,
        revealed_urls=["https://example.com/sub1", "https://example.com/sub2"],
        duration_ms=450.0
    )
    finding = NavigationMenuExplorer.formulate_menu_summary_finding(result, "https://example.com")
    assert finding is not None
    assert finding.id == "QA_MULTI_LAYER_NAVIGATION_SUMMARY"
    assert finding.category == Category.UX
    assert finding.severity == Severity.INFO
    assert finding.rca_category == RCACategory.EXPECTED_BEHAVIOR
    assert "4 Sub-Routes Revealed" in finding.title


@pytest.mark.asyncio
async def test_menu_explorer_graceful_when_no_nav():
    """
    When no navigation elements exist on page, completes gracefully with 0 probed.
    """
    html_content = "<html><body><h1>Direct Landing</h1><p>No header or nav.</p></body></html>"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html_content)

        result = await NavigationMenuExplorer.explore_dropdown_menus(page)
        await browser.close()

        assert result.menus_probed == 0
        assert result.dropdowns_opened == 0
        assert result.hidden_links_revealed == 0

