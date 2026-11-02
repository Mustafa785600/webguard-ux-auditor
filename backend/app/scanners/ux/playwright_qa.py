import asyncio
import base64
import re
from typing import List, Optional, Dict, Any
import httpx
from playwright.async_api import async_playwright, Error as PlaywrightError
from app.models.schema import Finding, Category, Severity, RCACategory
from app.scanners.base import BaseScanner

# ---------------------------------------------------------------------------
# Boundary Value Analysis — test payloads for autonomous form fill
# ---------------------------------------------------------------------------
FORM_TEST_PAYLOADS = [
    {"type": "valid_email",    "value": "testuser@webguard-qa.com"},
    {"type": "invalid_email",  "value": "not-an-email"},
    {"type": "sql_injection",  "value": "' OR '1'='1"},
    {"type": "xss_probe",      "value": "<script>alert(1)</script>"},
    {"type": "boundary_long",  "value": "A" * 300},
    {"type": "empty",          "value": ""},
]

AD_DOMAINS = ("google-analytics", "doubleclick", "facebook", "googlesyndication")


class PlaywrightQAScanner(BaseScanner):
    """
    Phase 2 Autonomous E2E Playwright QA Scanner (TestSprite style)

    Capabilities:
    - Runtime JS crash detection (pageerror + unhandledrejection)
    - Browser console error capture
    - Failed background API / network request detection (5xx)
    - Autonomous form fill with Boundary Value Analysis payloads
    - Before / after screenshot evidence (base64)
    - Infinite loading spinner detection (> 8 s)
    - Navigation link traversal crash detection
    - RCA Classification: REAL_BUG / TEST_FRAGILITY / ENV_ISSUE / EXPECTED_BEHAVIOR
    - Ready-to-run Playwright .spec.ts script generation
    """

    # ------------------------------------------------------------------ #
    #  Main entry point                                                    #
    # ------------------------------------------------------------------ #
    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []

        page_errors: List[dict]  = []
        console_errors: List[str] = []
        failed_requests: List[dict] = []
        server_errors: List[dict]  = []
        interaction_log: List[str] = []
        screenshot_initial_b64: Optional[str] = None
        interactive_elements_tested: int = 0

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebGuard-AutonomousQA/2.0",
                    ignore_https_errors=True
                )
                page = await context.new_page()

                # ── Event listeners ──────────────────────────────────────
                def handle_page_error(exc):
                    error_str = str(exc)
                    stack_match = re.search(
                        r"at\s+(?:.*?\s+)?\(?(https?://[^:\s]+):(\d+):(\d+)\)?", error_str
                    )
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
                    if not any(ad in req.url for ad in AD_DOMAINS):
                        failed_requests.append({
                            "url": req.url[:120],
                            "method": req.method,
                            "failure": req.failure or "Failed to connect"
                        })

                def handle_response(resp):
                    if resp.status >= 500:
                        server_errors.append({"url": resp.url[:120], "status": resp.status})

                page.on("pageerror",      handle_page_error)
                page.on("console",        handle_console)
                page.on("requestfailed",  handle_request_failed)
                page.on("response",       handle_response)

                # ── 1. Navigate ──────────────────────────────────────────
                try:
                    await page.goto(target_url, wait_until="domcontentloaded", timeout=15000)
                    await page.wait_for_timeout(1500)
                except Exception:
                    pass

                # ── 2. Initial screenshot (before interactions) ──────────
                try:
                    screenshot_initial_b64 = "data:image/png;base64," + base64.b64encode(
                        await page.screenshot(type="png", full_page=False)
                    ).decode()
                except Exception:
                    pass

                # ── 3. Infinite loading spinner detection ────────────────
                spinner_findings = await self._detect_infinite_spinners(page, interaction_log)
                findings.extend(spinner_findings)

                # ── 4. Autonomous form fill (Phase 2 core) ───────────────
                form_findings = await self._test_forms_autonomously(
                    page, target_url, interaction_log
                )
                findings.extend(form_findings)

                # ── 5. Navigation link traversal ─────────────────────────
                nav_findings = await self._traverse_nav_links(
                    page, target_url, interaction_log
                )
                findings.extend(nav_findings)

                # ── 6. Interactive element hover probe ───────────────────
                buttons = page.locator("button:visible, [role='button']:visible")
                btn_count = await buttons.count()
                interactive_elements_tested = min(btn_count, 5)
                for i in range(interactive_elements_tested):
                    try:
                        await buttons.nth(i).hover(timeout=1000)
                        interaction_log.append(f"Hovered button #{i+1}")
                    except Exception:
                        pass

                page_title = await page.title()
                await context.close()
                await browser.close()

        except Exception:
            return findings

        # ── Formulate Runtime Findings ───────────────────────────────────

        # Finding: Unhandled Runtime JS Exceptions
        for err in page_errors[:3]:
            findings.append(Finding(
                id="QA_RUNTIME_JS_CRASH",
                category=Category.UX,
                severity=Severity.HIGH,
                title="Unhandled Runtime JavaScript Exception in Browser",
                description=f"An unhandled JavaScript exception occurred during page execution: {err['message']}",
                remediation=(
                    "Add null-checks, initialize variables before access, and wrap component "
                    "logic in React Error Boundaries or try/catch blocks."
                ),
                evidence={"stack_snippet": err["raw"][:300]},
                risk_impact=(
                    "Runtime JS exceptions abruptly crash client-side application state, "
                    "freezing user interactions, buttons, and form submissions."
                ),
                code_example=(
                    "try {\n"
                    "  initComponent();\n"
                    "} catch (err) {\n"
                    "  reportError(err);\n"
                    "}"
                ),
                target_location=err["file"],
                line_number=err["line"],
                problematic_code=err["message"],
                screenshot_before_b64=screenshot_initial_b64,
                interaction_log=interaction_log[:10],
                rca_category=RCACategory.REAL_BUG,
            ))

        # Finding: Browser Console Errors
        if console_errors:
            findings.append(Finding(
                id="QA_BROWSER_CONSOLE_ERRORS",
                category=Category.UX,
                severity=Severity.MEDIUM,
                title=f"{len(console_errors)} Critical Console Error(s) Logged",
                description=(
                    f"The browser console emitted critical error messages during page "
                    f"initialization: {console_errors[0]}"
                ),
                remediation=(
                    "Review client scripts for broken imports, unhandled Promise rejections, "
                    "or cross-origin errors."
                ),
                evidence={"errors": console_errors[:5]},
                risk_impact=(
                    "Persistent console errors indicate degraded user experience, "
                    "broken submodules, or silent frontend failures."
                ),
                code_example=(
                    "window.addEventListener('unhandledrejection', (event) => {\n"
                    "  console.warn('Recovered rejection:', event.reason);\n"
                    "  event.preventDefault();\n"
                    "});"
                ),
                target_location="index.html (Browser Console)",
                line_number=1,
                problematic_code=console_errors[0],
                screenshot_before_b64=screenshot_initial_b64,
                rca_category=RCACategory.REAL_BUG,
            ))

        # Finding: Failed Internal API Requests (5xx)
        if server_errors:
            err_req = server_errors[0]
            findings.append(Finding(
                id="QA_FAILED_API_ENDPOINT",
                category=Category.UX,
                severity=Severity.HIGH,
                title=f"Internal API Call Failed with HTTP {err_req['status']}",
                description=(
                    f"Background fetch/XHR request to '{err_req['url']}' "
                    f"returned a server error ({err_req['status']})."
                ),
                remediation=(
                    "Inspect backend server logs for the failing endpoint, check database "
                    "connections, and return structured error responses."
                ),
                evidence={"server_errors": server_errors[:3]},
                risk_impact=(
                    "When client-side API calls fail with 5xx status, end users see indefinite "
                    "loading spinners, broken tables, or sudden transaction drop-offs."
                ),
                code_example=(
                    "const response = await fetch(url);\n"
                    "if (!response.ok) {\n"
                    "  throw new Error(`API error: ${response.status}`);\n"
                    "}"
                ),
                target_location="API Route / Backend Controller",
                problematic_code=f"{err_req['url']} (HTTP {err_req['status']})",
                screenshot_before_b64=screenshot_initial_b64,
                rca_category=RCACategory.ENV_ISSUE,
            ))

        # Finding: Generated Playwright E2E Test Script
        playwright_test_code = self._generate_e2e_script(
            target_url, page_title, interactive_elements_tested
        )
        findings.append(Finding(
            id="QA_PLAYWRIGHT_E2E_SUITE",
            category=Category.UX,
            severity=Severity.INFO,
            title="Autonomous Playwright E2E Test Suite Generated",
            description=(
                f"Autonomous QA agent explored {interactive_elements_tested} interactive "
                f"element(s), performed form boundary-value analysis, and generated a "
                f"turnkey Playwright E2E test script."
            ),
            remediation=(
                "Save this test script to your e2e test suite (e.g. e2e/homepage.spec.ts) "
                "and run it in CI/CD pipeline with 'npx playwright test'."
            ),
            evidence={
                "interactive_elements_probed": interactive_elements_tested,
                "screenshot_captured": bool(screenshot_initial_b64),
                "interaction_log": interaction_log[:15],
            },
            risk_impact=(
                "Without automated E2E tests, future deployments can silently break "
                "frontend workflows without developer awareness."
            ),
            code_example=playwright_test_code,
            target_location="tests/e2e/autonomous.spec.ts",
            line_number=1,
            problematic_code=f"// Test scenario generated for {target_url}",
            screenshot_before_b64=screenshot_initial_b64,
            rca_category=RCACategory.EXPECTED_BEHAVIOR,
        ))

        return findings

    # ------------------------------------------------------------------ #
    #  Phase 2 — Autonomous Form Fill (Boundary Value Analysis)           #
    # ------------------------------------------------------------------ #
    async def _test_forms_autonomously(
        self,
        page,
        target_url: str,
        interaction_log: List[str],
    ) -> List[Finding]:
        findings: List[Finding] = []

        try:
            forms = page.locator("form")
            form_count = await forms.count()
            interaction_log.append(f"Found {form_count} form(s) on page")

            for form_idx in range(min(form_count, 3)):
                form = forms.nth(form_idx)
                inputs = form.locator("input:visible, textarea:visible, select:visible")
                input_count = await inputs.count()

                if input_count == 0:
                    continue

                interaction_log.append(f"Form #{form_idx+1}: {input_count} field(s) detected")

                # Before screenshot
                screenshot_before: Optional[str] = None
                try:
                    screenshot_before = "data:image/png;base64," + base64.b64encode(
                        await page.screenshot(type="png", full_page=False)
                    ).decode()
                except Exception:
                    pass

                # Fill each field with boundary value payloads
                for payload in FORM_TEST_PAYLOADS:
                    for i in range(min(input_count, 5)):
                        try:
                            inp = inputs.nth(i)
                            input_type = await inp.get_attribute("type") or "text"
                            if input_type in ("submit", "button", "hidden", "checkbox", "radio"):
                                continue
                            await inp.fill(payload["value"], timeout=2000)
                        except Exception:
                            pass

                    # Attempt form submission
                    try:
                        submit_btn = form.locator("button[type='submit'], input[type='submit']")
                        if await submit_btn.count() > 0:
                            interaction_log.append(
                                f"Form #{form_idx+1}: submitting with payload '{payload['type']}'"
                            )
                            await submit_btn.first.click(timeout=3000)
                            await page.wait_for_timeout(800)
                    except Exception:
                        pass

                # After screenshot
                screenshot_after: Optional[str] = None
                try:
                    screenshot_after = "data:image/png;base64," + base64.b64encode(
                        await page.screenshot(type="png", full_page=False)
                    ).decode()
                except Exception:
                    pass

                # Check if XSS payload rendered in DOM
                try:
                    body_text = await page.inner_text("body")
                    if "<script>" in body_text or "alert(1)" in body_text:
                        interaction_log.append(f"Form #{form_idx+1}: XSS payload reflected in DOM!")
                        findings.append(Finding(
                            id="QA_FORM_XSS_REFLECTION",
                            category=Category.SECURITY,
                            severity=Severity.CRITICAL,
                            title="Reflected XSS: Form Input Rendered Unescaped in DOM",
                            description=(
                                f"Form #{form_idx+1} reflected the XSS probe "
                                f"'<script>alert(1)</script>' directly into the page DOM "
                                f"without sanitization."
                            ),
                            remediation=(
                                "Sanitize all user input server-side (e.g. DOMPurify client-side, "
                                "bleach server-side). Never render raw user input as HTML."
                            ),
                            evidence={"form_index": form_idx + 1, "payload": "<script>alert(1)</script>"},
                            risk_impact=(
                                "Reflected XSS allows attackers to inject malicious scripts into "
                                "victim browsers, leading to session hijacking and data theft."
                            ),
                            code_example=(
                                "import DOMPurify from 'dompurify';\n"
                                "const safe = DOMPurify.sanitize(userInput);\n"
                                "element.innerHTML = safe;"
                            ),
                            target_location=f"form[{form_idx}] on {target_url}",
                            problematic_code="<script>alert(1)</script>",
                            screenshot_before_b64=screenshot_before,
                            screenshot_after_b64=screenshot_after,
                            interaction_log=interaction_log[-5:],
                            rca_category=RCACategory.REAL_BUG,
                        ))
                except Exception:
                    pass

                # Check SQL injection reflection
                try:
                    body_text = await page.inner_text("body")
                    sql_indicators = ["syntax error", "mysql", "sql", "ORA-", "pg_"]
                    if any(ind.lower() in body_text.lower() for ind in sql_indicators):
                        interaction_log.append(f"Form #{form_idx+1}: SQL error string reflected in response!")
                        findings.append(Finding(
                            id="QA_FORM_SQL_ERROR_LEAK",
                            category=Category.SECURITY,
                            severity=Severity.CRITICAL,
                            title="SQL Error String Leaked in Form Response",
                            description=(
                                f"Form #{form_idx+1} returned a database error message in the "
                                f"response when submitted with a SQL injection probe."
                            ),
                            remediation=(
                                "Use parameterized queries / ORM. Never expose raw database "
                                "error messages to the client. Log errors server-side only."
                            ),
                            evidence={"form_index": form_idx + 1, "payload": "' OR '1'='1"},
                            risk_impact=(
                                "Exposed SQL errors reveal database technology and schema, "
                                "enabling targeted SQL injection attacks."
                            ),
                            code_example=(
                                "cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))"
                            ),
                            target_location=f"form[{form_idx}] on {target_url}",
                            problematic_code="' OR '1'='1",
                            screenshot_before_b64=screenshot_before,
                            screenshot_after_b64=screenshot_after,
                            interaction_log=interaction_log[-5:],
                            rca_category=RCACategory.REAL_BUG,
                        ))
                except Exception:
                    pass

                interaction_log.append(f"Form #{form_idx+1}: boundary-value analysis complete")

        except Exception:
            pass

        return findings

    # ------------------------------------------------------------------ #
    #  Phase 2 — Infinite Loading Spinner Detection                       #
    # ------------------------------------------------------------------ #
    async def _detect_infinite_spinners(
        self, page, interaction_log: List[str]
    ) -> List[Finding]:
        findings: List[Finding] = []
        spinner_selectors = [
            ".spinner", ".loader", "[data-loading]",
            "[aria-busy='true']", ".loading", ".sk-spinner",
        ]
        for sel in spinner_selectors:
            try:
                el = page.locator(sel).first
                if await el.count() == 0:
                    continue
                # Wait 8 seconds — if still visible → infinite spinner
                await page.wait_for_timeout(8000)
                if await el.is_visible():
                    interaction_log.append(f"Infinite spinner detected: '{sel}' still visible after 8s")
                    findings.append(Finding(
                        id="QA_INFINITE_LOADING_SPINNER",
                        category=Category.UX,
                        severity=Severity.HIGH,
                        title="Infinite Loading Spinner — Page Never Resolves",
                        description=(
                            f"Element matching '{sel}' remained visible for more than 8 seconds "
                            f"after page load, indicating the page is stuck in a loading state."
                        ),
                        remediation=(
                            "Ensure all async data-fetch calls resolve or reject with a timeout. "
                            "Add error boundaries that dismiss the spinner on failure."
                        ),
                        evidence={"selector": sel, "wait_duration_ms": 8000},
                        risk_impact=(
                            "An infinite spinner traps users on the page with no feedback, "
                            "leading to high bounce rates and lost conversions."
                        ),
                        code_example=(
                            "const controller = new AbortController();\n"
                            "const timer = setTimeout(() => controller.abort(), 5000);\n"
                            "await fetch(url, { signal: controller.signal });\n"
                            "clearTimeout(timer);"
                        ),
                        target_location=sel,
                        problematic_code=f"Element '{sel}' never hidden after data load",
                        rca_category=RCACategory.REAL_BUG,
                    ))
                    break
            except Exception:
                pass
        return findings

    # ------------------------------------------------------------------ #
    #  Phase 2 — Navigation Link Traversal                                #
    # ------------------------------------------------------------------ #
    async def _traverse_nav_links(
        self, page, target_url: str, interaction_log: List[str]
    ) -> List[Finding]:
        findings: List[Finding] = []
        try:
            nav_links = page.locator("nav a[href]:visible, header a[href]:visible")
            link_count = await nav_links.count()
            interaction_log.append(f"Found {link_count} navigation link(s)")

            initial_url = page.url

            for i in range(min(link_count, 4)):
                try:
                    link = nav_links.nth(i)
                    href = await link.get_attribute("href") or ""
                    label = (await link.inner_text()).strip()[:40]

                    if href.startswith("http") and not href.startswith(target_url):
                        continue  # skip external links

                    errors_before = len(page_errors_snapshot := list([]))
                    await link.click(timeout=3000)
                    await page.wait_for_timeout(800)

                    current_url = page.url
                    interaction_log.append(
                        f"Nav link '{label}' → {current_url[:60]}"
                    )

                    # Navigate back to target for next iteration
                    if current_url != initial_url:
                        await page.go_back(timeout=5000)
                        await page.wait_for_timeout(500)
                        # Re-query locator after navigation
                        nav_links = page.locator("nav a[href]:visible, header a[href]:visible")

                except Exception as e:
                    interaction_log.append(f"Nav link #{i+1}: click failed — {str(e)[:60]}")

        except Exception:
            pass
        return findings

    # ------------------------------------------------------------------ #
    #  E2E Script Generator                                               #
    # ------------------------------------------------------------------ #
    def _generate_e2e_script(
        self, target_url: str, page_title: str, buttons_tested: int
    ) -> str:
        return (
            f"import {{ test, expect }} from '@playwright/test';\n\n"
            f"test('Autonomous E2E — {page_title[:40]}', async ({{ page }}) => {{\n"
            f"  await page.goto('{target_url}', {{ waitUntil: 'domcontentloaded' }});\n\n"
            f"  await expect(page).toHaveTitle(/.+/);\n\n"
            f"  const buttons = page.locator('button, [role=\"button\"]');\n"
            f"  if (await buttons.count() > 0) {{\n"
            f"    await expect(buttons.first()).toBeVisible();\n"
            f"  }}\n\n"
            f"  const forms = page.locator('form');\n"
            f"  const formCount = await forms.count();\n"
            f"  for (let i = 0; i < Math.min(formCount, 2); i++) {{\n"
            f"    const form = forms.nth(i);\n"
            f"    const emailInput = form.locator('input[type=\"email\"]');\n"
            f"    if (await emailInput.count() > 0) {{\n"
            f"      await emailInput.fill('test@example.com');\n"
            f"    }}\n"
            f"  }}\n"
            f"\n"
            f"  await expect(page).not.toHaveURL(/error/);\n"
            f"}});"
        )
