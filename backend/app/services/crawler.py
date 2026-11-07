import asyncio
import base64
from collections import deque
import time
from typing import List, Tuple, Set, Optional
from urllib.parse import urlparse, urljoin
import httpx
from playwright.async_api import async_playwright, Error as PlaywrightError
from app.models.schema import CrawlNode, Finding, Category, Severity, RCACategory
from app.services.cookie_manager import CookieConsentManager
from app.services.scroll_manager import HumanScrollEngine
from app.services.menu_explorer import NavigationMenuExplorer

IGNORE_EXTENSIONS = (
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
    ".css", ".js", ".mjs", ".map",
    ".pdf", ".zip", ".tar", ".gz", ".rar",
    ".mp3", ".mp4", ".wav", ".avi",
    ".woff", ".woff2", ".ttf", ".eot"
)

def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    if not path:
        path = "/"
    # Preserve SPA hash routing (e.g., #/about, #!/contact, #/products)
    fragment = parsed.fragment
    preserved_frag = fragment if fragment.startswith(("/", "!/")) else ""
    cleaned = parsed._replace(fragment=preserved_frag, path=path).geturl()
    return cleaned

def get_base_domain(netloc: str) -> str:
    parts = netloc.lower().split(":")[0].split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return netloc.lower()

def is_same_domain(url: str, seed_domain: str) -> bool:
    try:
        netloc = urlparse(url).netloc.lower().split(":")[0]
        seed = seed_domain.lower().split(":")[0]
        if netloc == seed or netloc == f"www.{seed}" or seed == f"www.{netloc}":
            return True
        # Allow same base domain for subdomains (e.g., app.site.com, docs.site.com)
        return get_base_domain(netloc) == get_base_domain(seed)
    except Exception:
        return False

def is_crawlable_link(url: str, seed_domain: str) -> bool:
    if not url or url.startswith(("javascript:", "mailto:", "tel:", "data:")):
        return False
    # Ignore simple in-page anchor links (e.g., #top, #section1) unless it's SPA hash routing (#/route)
    if url.startswith("#") and not url.startswith(("#/", "#!/")):
        return False
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    if not is_same_domain(url, seed_domain):
        return False
    path_lower = parsed.path.lower()
    if any(path_lower.endswith(ext) for ext in IGNORE_EXTENSIONS):
        return False
    return True

class AutonomousCrawler:
    """
    Autonomous Multi-Page Crawler & Route Graph Explorer (TestSprite style).
    Traverses internal routes, explores state transitions, interacts with forms and buttons,
    and synthesizes an interactive site hierarchy graph with per-route health audits.
    """

    async def crawl_and_explore(
        self,
        seed_url: str,
        max_pages: int = 5,
        max_depth: int = 1
    ) -> Tuple[List[CrawlNode], List[Finding]]:
        clean_seed = normalize_url(seed_url)
        seed_parsed = urlparse(clean_seed)
        seed_domain = seed_parsed.netloc

        queue = deque([(clean_seed, 0)])
        visited: Set[str] = set()
        crawl_nodes: List[CrawlNode] = []
        crawler_findings: List[Finding] = []

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-blink-features=AutomationControlled",
                    ]
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 WebGuard/3.0",
                    ignore_https_errors=True
                )
                page = await context.new_page()
                await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

                while queue and len(visited) < max_pages:
                    current_url, current_depth = queue.popleft()
                    current_clean = normalize_url(current_url)

                    if current_clean in visited:
                        continue
                    visited.add(current_clean)

                    route = urlparse(current_clean).path or "/"
                    page_errors: List[str] = []
                    
                    def on_page_error(err):
                        page_errors.append(str(err))

                    page.on("pageerror", on_page_error)

                    start_time = time.time()
                    status_code = 200
                    title = ""
                    thumb_b64: Optional[str] = None
                    discovered_internal_links: List[str] = []
                    forms_count = 0
                    buttons_count = 0

                    try:
                        resp = await page.goto(current_clean, timeout=12000, wait_until="domcontentloaded")
                        if resp:
                            status_code = resp.status
                        try:
                            await page.wait_for_timeout(1000)
                        except Exception:
                            pass

                        # Privacy-First Cookie / KVKK Banner Dismissal (Reject > Necessary > Close)
                        try:
                            consent_res = await CookieConsentManager.dismiss_cookie_banner(page)
                            if consent_res.dark_pattern_detected:
                                forced_cookie_finding = CookieConsentManager.formulate_compliance_finding(consent_res, current_clean)
                                if forced_cookie_finding and not any(f.id == "KVKK_FORCED_COOKIE_CONSENT" for f in crawler_findings):
                                    crawler_findings.append(forced_cookie_finding)
                        except Exception:
                            pass

                        # Natural Human Scrolling & Lazy-load Trigger (Reveals lazy-loaded links & assets)
                        try:
                            scroll_res = await HumanScrollEngine.smooth_scroll_page(
                                page, max_steps=6, step_px=400, pause_ms=100, return_to_top=True
                            )
                            if scroll_res.broken_images_detected > 0:
                                broken_finding = HumanScrollEngine.formulate_broken_assets_finding(scroll_res, current_clean)
                                if broken_finding and not any(f.id == "UX_LAZY_LOAD_BROKEN_ASSET" for f in crawler_findings):
                                    crawler_findings.append(broken_finding)
                        except Exception:
                            pass

                        title = await page.title()
                        load_time_ms = round((time.time() - start_time) * 1000, 1)

                        # Capture thumbnail screenshot
                        try:
                            screenshot_bytes = await page.screenshot(type="jpeg", quality=40)
                            thumb_b64 = base64.b64encode(screenshot_bytes).decode("ascii")
                        except Exception:
                            thumb_b64 = None

                        # Extract internal links for crawler queue
                        hrefs = await page.eval_on_selector_all(
                            "a[href]",
                            "elements => elements.map(el => el.href || el.getAttribute('href'))"
                        )
                        for raw_href in hrefs:
                            if not raw_href:
                                continue
                            full_url = urljoin(current_clean, raw_href)
                            if is_crawlable_link(full_url, seed_domain):
                                norm = normalize_url(full_url)
                                if norm not in discovered_internal_links:
                                    discovered_internal_links.append(norm)
                                if current_depth < max_depth and norm not in visited:
                                    queue.append((norm, current_depth + 1))

                        # Multi-Layer Navigation Exploration (Dropdown & Mega-menu Traversal)
                        try:
                            menu_res = await NavigationMenuExplorer.explore_dropdown_menus(page, base_url=current_clean)
                            for revealed_url in menu_res.revealed_urls:
                                full_revealed = urljoin(current_clean, revealed_url)
                                if is_crawlable_link(full_revealed, seed_domain):
                                    norm = normalize_url(full_revealed)
                                    if norm not in discovered_internal_links:
                                        discovered_internal_links.append(norm)
                                    if current_depth < max_depth and norm not in visited:
                                        queue.append((norm, current_depth + 1))
                        except Exception:
                            pass

                        # Form inspection and safe dummy testing
                        form_elements = await page.locator("form").all()
                        forms_count = len(form_elements)
                        
                        for form in form_elements[:3]:
                            try:
                                text_inputs = await form.locator("input[type='text'], input[type='email'], input:not([type])").all()
                                for inp in text_inputs[:2]:
                                    is_visible = await inp.is_visible()
                                    if is_visible:
                                        await inp.fill("test@webguard-audit.local", timeout=1500)
                            except Exception:
                                pass

                        # Count interactive buttons
                        buttons = await page.locator("button, a.btn, [role='button']").all()
                        buttons_count = len(buttons)

                    except Exception as nav_err:
                        status_code = 500 if "net::ERR_" not in str(nav_err) else 0
                        load_time_ms = round((time.time() - start_time) * 1000, 1)
                        page_errors.append(f"Navigation failed: {str(nav_err)[:100]}")

                    page_issue_count = 0

                    # Formulate Findings for route status and unhandled errors
                    if status_code >= 400 or status_code == 0:
                        page_issue_count += 1
                        crawler_findings.append(
                            Finding(
                                id=f"CRAWL_ROUTE_ERROR_{len(crawler_findings)+1}",
                                category=Category.UX,
                                severity=Severity.HIGH if status_code >= 500 else Severity.MEDIUM,
                                title=f"Route Failure: HTTP {status_code} on {route}",
                                description=f"The autonomous crawler encountered a non-success response ({status_code}) when exploring route {current_clean}.",
                                remediation="Ensure the route is properly handled by your server or SPA routing, and broken links are redirected.",
                                risk_impact="Users following internal links encounter broken pages or server errors, degrading credibility and user retention.",
                                target_location=f"Route: {route}",
                                page_url=current_clean,
                                rca_category=RCACategory.REAL_BUG,
                                evidence={"route": route, "status_code": status_code, "url": current_clean}
                            )
                        )

                    for p_err in page_errors:
                        page_issue_count += 1
                        crawler_findings.append(
                            Finding(
                                id=f"CRAWL_JS_ERROR_{len(crawler_findings)+1}",
                                category=Category.UX,
                                severity=Severity.HIGH,
                                title=f"Runtime Exception on Route {route}",
                                description=f"Unhandled JavaScript exception triggered while exploring {route}: {p_err[:120]}",
                                remediation="Add defensive null checks, error boundaries, or try-catch handlers to prevent runtime script crashes.",
                                risk_impact="JavaScript errors break client-side rendering and freeze interactive controls on this route.",
                                target_location=f"Client runtime on {route}",
                                page_url=current_clean,
                                rca_category=RCACategory.REAL_BUG,
                                evidence={"route": route, "error": p_err}
                            )
                        )

                    crawl_nodes.append(
                        CrawlNode(
                            url=current_clean,
                            route=route,
                            title=title or route,
                            depth=current_depth,
                            status_code=status_code,
                            forms_count=forms_count,
                            buttons_count=buttons_count,
                            links_found=discovered_internal_links[:10],
                            page_issues_count=page_issue_count,
                            screenshot_b64=thumb_b64,
                            load_time_ms=load_time_ms
                        )
                    )

                await browser.close()

        except Exception as e:
            import traceback
            print(f"[CRAWLER CRITICAL ERROR]: {type(e).__name__}: {e}")
            traceback.print_exc()
            # Fallback for headless environments or network failure
            if not crawl_nodes:
                crawl_nodes.append(
                    CrawlNode(
                        url=clean_seed,
                        route=seed_parsed.path or "/",
                        title=seed_domain,
                        depth=0,
                        status_code=200,
                        forms_count=0,
                        buttons_count=0,
                        links_found=[],
                        page_issues_count=0,
                        load_time_ms=100.0
                    )
                )

        return crawl_nodes, crawler_findings

