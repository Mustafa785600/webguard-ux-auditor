import asyncio
from app.services.crawler import normalize_url, is_crawlable_link
from playwright.async_api import async_playwright
from urllib.parse import urlparse, urljoin

TARGET = "https://github.com"

async def probe():
    seed_domain = urlparse(TARGET).netloc
    print("Seed domain:", seed_domain)
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
            ignore_https_errors=True
        )
        page = await context.new_page()
        resp = await page.goto(TARGET, timeout=15000, wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        status = resp.status if resp else "none"
        title = await page.title()
        print("HTTP Status:", status)
        print("Title:", title)

        hrefs = await page.eval_on_selector_all(
            "a[href]",
            "els => els.map(el => el.href || el.getAttribute('href'))"
        )
        print("Total hrefs in DOM:", len(hrefs))

        internal = []
        for h in hrefs:
            if not h:
                continue
            full = urljoin(TARGET, h)
            if is_crawlable_link(full, seed_domain):
                n = normalize_url(full)
                if n not in internal:
                    internal.append(n)

        print("Crawlable internal links:", len(internal))
        for lnk in internal[:10]:
            print(" ->", lnk)

        await browser.close()

asyncio.run(probe())
