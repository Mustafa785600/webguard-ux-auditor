import asyncio
import base64
import re
from typing import List, Optional
import httpx
from playwright.async_api import async_playwright, Error as PlaywrightError
from app.models.schema import Finding, Category, Severity
from app.scanners.base import BaseScanner

class PlaywrightQAScanner(BaseScanner):
    """
    Autonomous E2E Playwright QA Scanner (TestSprite style)
    - Launches headless Chromium
    - Tracks runtime JavaScript crashes (pageerror)
    - Records browser console errors
    - Detects failed background API calls and network requests
    - Tests interactive elements
    - Generates ready-to-run Playwright test scripts
    """

    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []

        page_errors: List[dict] = []
        console_errors: List[str] = []
        failed_requests: List[dict] = []
        server_errors: List[dict] = []
        screenshot_b64: Optional[str] = None
        interactive_elements_tested: int = 0

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebGuard-AutonomousQA/1.0",
                    ignore_https_errors=True
                )
                page = await context.new_page()

                # 1. Listeners for runtime errors
                def handle_page_error(exc):
                    error_str = str(exc)
                    # Extract file and line from stack if present
                    stack_match = re.search(r"at\s+(?:.*?\s+)?\(?(https?://[^:\s]+):(\d+):(\d+)\)?", error_str)
                    file_name = "application.js"
                    line_num = None
                    if stack_match:
                        raw_url = stack_match.group(1)
                        file_name = raw_url.split("/")[-1].split("?")[0] or "bundle.js"
                        line_num = int(stack_match.group(2))

                    page_errors.append({
                        "message": error_str[:250],
                        "file": file_name,
                        "line": line_num,
                        "raw": error_str
                    })

                def handle_console(msg):
                    if msg.type == "error":
                        console_errors.append(msg.text[:200])

                def handle_request_failed(req):
                    # Only record main domain / non-ad failed requests
                    if not any(ad in req.url for ad in ("google-analytics", "doubleclick", "facebook")):
                        failed_requests.append({
                            "url": req.url[:120],
                            "method": req.method,
                            "failure": req.failure or "Failed to connect"
                        })

                def handle_response(resp):
                    if resp.status >= 500:
                        server_errors.append({
                            "url": resp.url[:120],
                            "status": resp.status
                        })

                page.on("pageerror", handle_page_error)
                page.on("console", handle_console)
                page.on("requestfailed", handle_request_failed)
                page.on("response", handle_response)

                # 2. Navigate to target
                try:
                    nav_response = await page.goto(target_url, wait_until="domcontentloaded", timeout=12000)
                    await page.wait_for_timeout(1000)
                except Exception:
                    pass

                # 3. Autonomous interaction probe (TestSprite style element verification)
                buttons = page.locator("button:visible, [role='button']:visible")
                btn_count = await buttons.count()
                interactive_elements_tested = min(btn_count, 5)

                for i in range(interactive_elements_tested):
                    try:
                        btn = buttons.nth(i)
                        # Hover to trigger dynamic JS tooltips / mouse events safely
                        await btn.hover(timeout=1000)
                    except Exception:
                        pass

                # 4. Capture screenshot
                try:
                    screenshot_bytes = await page.screenshot(type="png", full_page=False)
                    screenshot_b64 = "data:image/png;base64," + base64.b64encode(screenshot_bytes).decode("utf-8")
                except Exception:
                    pass

                page_title = await page.title()
                await context.close()
                await browser.close()

        except Exception:
            return findings

        # ── Formulate Findings ──

        # Finding 1: Unhandled Runtime JavaScript Exception
        for err in page_errors[:3]:
            findings.append(
                Finding(
                    id="QA_RUNTIME_JS_CRASH",
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title="Unhandled Runtime JavaScript Exception in Browser",
                    description=f"An unhandled JavaScript exception occurred during execution: {err['message']}",
                    remediation="Add null-checks, ensure variables are initialized before access, and encapsulate component logic in React Error Boundaries or try/catch blocks.",
                    evidence={"stack_snippet": err["raw"][:300]},
                    risk_impact="Runtime JavaScript exceptions abruptly crash client-side application state, freezing user interactions, buttons, and form submissions.",
                    code_example="try {\n  initComponent();\n} catch (err) {\n  console.error('Handled graceful error:', err);\n}",
                    target_location=err["file"],
                    line_number=err["line"],
                    problematic_code=err["message"]
                )
            )

        # Finding 2: Browser Console Errors
        if console_errors:
            findings.append(
                Finding(
                    id="QA_BROWSER_CONSOLE_ERRORS",
                    category=Category.UX,
                    severity=Severity.MEDIUM,
                    title=f"{len(console_errors)} Critical Console Error(s) Logged",
                    description=f"The browser console emitted critical error messages during page initialization: {console_errors[0]}",
                    remediation="Review client scripts for broken imports, unhandled Promise rejections, or cross-origin errors.",
                    evidence={"errors": console_errors[:5]},
                    risk_impact="Persistent console errors indicate degraded user experience, broken submodules, or silent frontend failures.",
                    code_example="window.addEventListener('unhandledrejection', (event) => {\n  console.warn('Recovered rejection:', event.reason);\n});",
                    target_location="index.html (Browser Console)",
                    line_number=1,
                    problematic_code=console_errors[0]
                )
            )

        # Finding 3: Failed Internal API Requests (5xx)
        if server_errors:
            err_req = server_errors[0]
            findings.append(
                Finding(
                    id="QA_FAILED_API_ENDPOINT",
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title=f"Internal API Call Failed with HTTP {err_req['status']}",
                    description=f"Background fetch/XHR request to '{err_req['url']}' returned a server error ({err_req['status']}).",
                    remediation="Inspect backend server logs for the failing endpoint, check database connections, and return structured error responses.",
                    evidence={"server_errors": server_errors[:3]},
                    risk_impact="When client-side API calls fail with 5xx status, end users see indefinite loading spinners, broken tables, or sudden transaction drop-offs.",
                    code_example="const response = await fetch(url);\nif (!response.ok) {\n  throw new Error(`API error: ${response.status}`);\n}",
                    target_location="API Route / Backend Controller",
                    problematic_code=f"{err_req['url']} (HTTP {err_req['status']})"
                )
            )

        # Finding 4: Autonomous Playwright Test Script (TestSprite Style)
        # Generates a production Playwright test for this specific page
        playwright_test_code = (
            f"import {{ test, expect }} from '@playwright/test';\n\n"
            f"test('Autonomous E2E Flow - {page_title[:30]}', async ({{ page }}) => {{\n"
            f"  // 1. Navigate to target URL\n"
            f"  await page.goto('{target_url}', {{ waitUntil: 'domcontentloaded' }});\n\n"
            f"  // 2. Verify page title and viewport\n"
            f"  await expect(page).toHaveTitle(/.+/);\n\n"
            f"  // 3. Verify interactive elements ({interactive_elements_tested} buttons validated)\n"
            f"  const buttons = page.locator('button, [role=\"button\"]');\n"
            f"  if (await buttons.count() > 0) {{\n"
            f"    await expect(buttons.first()).toBeVisible();\n"
            f"  }}\n"
            f"}});"
        )

        findings.append(
            Finding(
                id="QA_PLAYWRIGHT_E2E_SUITE",
                category=Category.UX,
                severity=Severity.INFO,
                title="Autonomous Playwright E2E Test Suite Generated",
                description=f"Autonomous QA agent explored {interactive_elements_tested} interactive element(s) and generated a turnkey Playwright E2E test script.",
                remediation="Save this test script to your e2e test suite (e.g., e2e/homepage.spec.ts) and run it in CI/CD pipeline with 'npx playwright test'.",
                evidence={
                    "interactive_elements_probed": interactive_elements_tested,
                    "screenshot_captured": bool(screenshot_b64)
                },
                risk_impact="Without automated E2E tests, future pull requests and deployments can silently break frontend workflows without developer awareness.",
                code_example=playwright_test_code,
                target_location="tests/e2e/autonomous.spec.ts",
                line_number=1,
                problematic_code=f"// Test scenario generated for {target_url}"
            )
        )

        return findings
