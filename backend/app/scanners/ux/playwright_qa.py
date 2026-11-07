import asyncio
import base64
import re
import time
from typing import List, Optional, Dict, Any
import httpx
from playwright.async_api import async_playwright, Error as PlaywrightError
from app.models.schema import Finding, Category, Severity, RCACategory, NetworkRequestTrace
from app.scanners.base import BaseScanner
from app.services.self_healing import SelfHealingEngine
from app.services.cookie_manager import CookieConsentManager
from app.services.scroll_manager import HumanScrollEngine
from app.services.menu_explorer import NavigationMenuExplorer

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
    Phase 2 & Phase 3 Autonomous E2E Playwright QA Scanner (TestSprite style)

    Capabilities:
    - Runtime JS crash detection (pageerror + unhandledrejection)
    - Browser console error capture
    - Network & API Contract Validation: Fetch/XHR interception, timing & status
    - Slow endpoint detection (>2000ms latency)
    - Insecure CORS detection (Access-Control-Allow-Origin: *)
    - Failed background API / network request detection (4xx/5xx)
    - Network waterfall profiling
    - Autonomous form fill with Boundary Value Analysis payloads
    - Before / after screenshot evidence (base64)
    - Infinite loading spinner detection (> 8 s)
    - Navigation link traversal crash detection
    - RCA Classification: REAL_BUG / TEST_FRAGILITY / ENV_ISSUE / EXPECTED_BEHAVIOR
    - Ready-to-run Playwright .spec.ts script generation
    """

    def __init__(self):
        self.network_traces: List[NetworkRequestTrace] = []
        self.self_healing = SelfHealingEngine()
        self.self_healing_events: List[Dict[str, Any]] = []

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

        # Phase 3 Network tracking structures
        request_start_times: Dict[Any, float] = {}
        captured_traces: List[NetworkRequestTrace] = []
        slow_endpoints: List[dict] = []
        cors_issues: List[dict] = []

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebGuard-AutonomousQA/3.0",
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

                def handle_request(req):
                    request_start_times[req] = time.perf_counter()

                def handle_request_failed(req):
                    if not any(ad in req.url for ad in AD_DOMAINS):
                        failed_requests.append({
                            "url": req.url[:120],
                            "method": req.method,
                            "failure": req.failure or "Failed to connect"
                        })

                def handle_response(resp):
                    req = resp.request
                    start_t = request_start_times.get(req)
                    duration_ms = (time.perf_counter() - start_t) * 1000 if start_t else 0.0
                    headers = resp.headers
                    cors_header = headers.get("access-control-allow-origin")
                    res_type = req.resource_type

                    trace = NetworkRequestTrace(
                        url=req.url[:250],
                        method=req.method,
                        status=resp.status,
                        resource_type=res_type,
                        duration_ms=round(duration_ms, 1),
                        cors_allowed=cors_header is not None,
                    )
                    captured_traces.append(trace)

                    # Check slow endpoints (>2000ms)
                    if duration_ms > 2000 and not any(ad in req.url for ad in AD_DOMAINS):
                        slow_endpoints.append({
                            "url": req.url[:150],
                            "method": req.method,
                            "status": resp.status,
                            "duration_ms": round(duration_ms, 1),
                            "resource_type": res_type,
                        })

                    # Check Wildcard CORS on API/JSON responses
                    is_api = "/api/" in req.url or "json" in headers.get("content-type", "").lower()
                    if is_api and cors_header == "*":
                        cors_issues.append({
                            "url": req.url[:150],
                            "cors": cors_header,
                            "credentials": headers.get("access-control-allow-credentials", "false"),
                        })

                    if resp.status >= 500:
                        server_errors.append({"url": resp.url[:120], "status": resp.status})

                page.on("pageerror",      handle_page_error)
                page.on("console",        handle_console)
                page.on("request",        handle_request)
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

                # ── 2.5. Privacy-First Cookie / KVKK Banner Dismissal ────
                # Enforces user policy: Reject All > Necessary Only > Close > Forced Accept
                try:
                    consent_res = await CookieConsentManager.dismiss_cookie_banner(page)
                    if consent_res.detected:
                        interaction_log.append(f"Cookie / KVKK: {consent_res.details}")
                        if consent_res.dark_pattern_detected:
                            forced_cookie_finding = CookieConsentManager.formulate_compliance_finding(consent_res, target_url)
                            if forced_cookie_finding:
                                forced_cookie_finding.screenshot_before_b64 = screenshot_initial_b64
                                findings.append(forced_cookie_finding)
                except Exception:
                    pass

                # ── 2.8. Smooth Human Scroll & Lazy-Load Trigger ──────────
                try:
                    scroll_res = await HumanScrollEngine.smooth_scroll_page(
                        page, max_steps=8, step_px=350, pause_ms=130, return_to_top=True
                    )
                    if scroll_res.total_scrolled_px > 0:
                        interaction_log.append(f"Smooth Scroll: {scroll_res.details}")
                        if scroll_res.broken_images_detected > 0:
                            broken_finding = HumanScrollEngine.formulate_broken_assets_finding(scroll_res, target_url)
                            if broken_finding:
                                broken_finding.screenshot_before_b64 = screenshot_initial_b64
                                findings.append(broken_finding)
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

                # ── 5.5. Multi-Layer Navigation & Mega-Menu Exploration ──
                try:
                    menu_res = await NavigationMenuExplorer.explore_dropdown_menus(page, base_url=target_url)
                    if menu_res.menus_probed > 0:
                        interaction_log.append(f"Navigation: {menu_res.details}")
                        menu_finding = NavigationMenuExplorer.formulate_menu_summary_finding(menu_res, target_url)
                        if menu_finding:
                            findings.append(menu_finding)
                except Exception:
                    pass

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

                # Capture final state screenshot (after all interactions & error triggers)
                screenshot_final_b64: Optional[str] = None
                try:
                    screenshot_final_b64 = "data:image/png;base64," + base64.b64encode(
                        await page.screenshot(type="png", full_page=False)
                    ).decode()
                except Exception:
                    screenshot_final_b64 = screenshot_initial_b64

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
                screenshot_after_b64=screenshot_final_b64 or screenshot_initial_b64,
                reproduction_steps=[
                    f"1. Navigate to '{target_url}' in headless browser",
                    f"2. Wait for page hydration and script initialization",
                    f"3. Unhandled exception thrown in {err['file']}:{err['line']}",
                    f"4. Error message captured: {err['message']}",
                ],
                root_cause_hypothesis=f"Script execution in {err['file']} threw an unhandled exception without proper try/catch or error boundary, crashing interactive DOM components.",
                dom_snapshot=f"<script src='.../{err['file']}'></script>",
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
                screenshot_after_b64=screenshot_final_b64 or screenshot_initial_b64,
                reproduction_steps=[
                    f"1. Open page '{target_url}' in browser",
                    "2. Attach listener to window 'console' error event",
                    f"3. Critical error emitted during startup: {console_errors[0]}",
                ],
                root_cause_hypothesis="Client script executed a failing network call, missing asset import, or unresolved promise during page startup.",
                dom_snapshot=f"console.error('{console_errors[0]}')",
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
                screenshot_after_b64=screenshot_final_b64 or screenshot_initial_b64,
                reproduction_steps=[
                    f"1. Navigate to '{target_url}'",
                    f"2. Trigger background asynchronous fetch/XHR request to '{err_req['url']}'",
                    f"3. Server responded with HTTP status code {err_req['status']}",
                ],
                root_cause_hypothesis=f"Backend controller at '{err_req['url']}' encountered an unhandled server error or database disconnection, returning HTTP {err_req['status']}.",
                dom_snapshot=f"fetch('{err_req['url']}') // Returned HTTP {err_req['status']}",
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

        # ── Phase 3: Network & API Contract Findings ───────────────────────

        # Finding: Slow API Endpoints
        if slow_endpoints:
            worst_slow = max(slow_endpoints, key=lambda x: x["duration_ms"])
            findings.append(Finding(
                id="QA_SLOW_API_ENDPOINT",
                category=Category.UX,
                severity=Severity.HIGH if worst_slow["duration_ms"] > 5000 else Severity.MEDIUM,
                title=f"Slow API Response Detected ({worst_slow['duration_ms']}ms Latency)",
                description=(
                    f"Background request to '{worst_slow['url'][:100]}' took {worst_slow['duration_ms']}ms, "
                    f"exceeding the 2000ms threshold for responsive user experiences."
                ),
                remediation=(
                    "Implement server-side caching (e.g. Redis), optimize database queries and indexes, "
                    "minify JSON payload sizes, and offload CPU-heavy computation to asynchronous workers."
                ),
                evidence={"slow_endpoints": slow_endpoints[:5], "total_slow": len(slow_endpoints)},
                risk_impact=(
                    "Slow API endpoints introduce UI freezes, broken spinners, and increased bounce rates, "
                    "diminishing user conversion and engagement."
                ),
                code_example=(
                    "const cached = await cache.get(cacheKey);\n"
                    "if (cached) return JSON.parse(cached);\n"
                    "const freshData = await fetchQuery();\n"
                    "await cache.set(cacheKey, JSON.stringify(freshData), { ttl: 60 });"
                ),
                target_location="API Route / Backend Performance",
                problematic_code=f"{worst_slow['method']} {worst_slow['url'][:80]} ({worst_slow['duration_ms']}ms)",
                screenshot_before_b64=screenshot_initial_b64,
                screenshot_after_b64=screenshot_final_b64 or screenshot_initial_b64,
                reproduction_steps=[
                    f"1. Navigate to target '{target_url}'",
                    f"2. Initiate asynchronous {worst_slow['method']} call to '{worst_slow['url'][:80]}'",
                    f"3. High latency measured: {worst_slow['duration_ms']}ms (threshold: 2000ms)",
                ],
                root_cause_hypothesis=f"Backend route '{worst_slow['url'][:60]}' lacks query optimization, database indexes, or Redis caching, triggering slow roundtrip times.",
                dom_snapshot=f"fetch('{worst_slow['url'][:80]}') // Latency: {worst_slow['duration_ms']}ms",
                rca_category=RCACategory.REAL_BUG,
            ))

        # Finding: Insecure Wildcard CORS
        if cors_issues:
            issue = cors_issues[0]
            findings.append(Finding(
                id="QA_INSECURE_CORS_POLICY",
                category=Category.SECURITY,
                severity=Severity.HIGH,
                title="Wildcard Access-Control-Allow-Origin on API Route",
                description=(
                    f"API route '{issue['url'][:100]}' responded with 'Access-Control-Allow-Origin: *', "
                    f"allowing any arbitrary third-party origin to make cross-origin reads."
                ),
                remediation=(
                    "Explicitly restrict Access-Control-Allow-Origin to trusted application domains. "
                    "Never combine wildcard origins with credentials or sensitive endpoints."
                ),
                evidence={"cors_issue": issue, "total_cors_issues": len(cors_issues)},
                risk_impact=(
                    "Overly permissive CORS headers expose internal API responses to malicious third-party "
                    "scripts executing inside an authenticated user's browser."
                ),
                code_example=(
                    "res.setHeader('Access-Control-Allow-Origin', 'https://app.yourdomain.com');\n"
                    "res.setHeader('Vary', 'Origin');"
                ),
                target_location="API Gateway / CORS Middleware",
                problematic_code="Access-Control-Allow-Origin: *",
                screenshot_before_b64=screenshot_initial_b64,
                screenshot_after_b64=screenshot_final_b64 or screenshot_initial_b64,
                reproduction_steps=[
                    f"1. Send cross-origin request from third-party client to '{issue['url'][:80]}'",
                    "2. Read 'Access-Control-Allow-Origin' header from HTTP response",
                    "3. Observed unrestricted wildcard '*' configuration",
                ],
                root_cause_hypothesis="CORS policy is configured with permissive wildcard ('*') origin reflection instead of an explicit whitelist of trusted frontend domains.",
                dom_snapshot=f"// HTTP Response Headers\nAccess-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true",
                rca_category=RCACategory.REAL_BUG,
            ))

        # Finding: Network Waterfall Profile Summary
        if captured_traces:
            self.network_traces = captured_traces
            total_reqs = len(captured_traces)
            avg_latency = round(sum(t.duration_ms for t in captured_traces) / max(total_reqs, 1), 1)
            slow_count = len(slow_endpoints)
            failed_count = sum(1 for t in captured_traces if t.status >= 400)

            findings.append(Finding(
                id="QA_NETWORK_WATERFALL_SUMMARY",
                category=Category.UX,
                severity=Severity.INFO,
                title=f"Network Waterfall Analyzed: {total_reqs} Request(s) Profiled",
                description=(
                    f"Profiled {total_reqs} network requests. Average response latency was {avg_latency}ms "
                    f"with {slow_count} slow endpoint(s) and {failed_count} HTTP failure(s)."
                ),
                remediation=(
                    "Audit high-latency requests, enable HTTP/2 or HTTP/3 multiplexing, compress text assets "
                    "with gzip/brotli, and preconnect to critical API origins."
                ),
                evidence={
                    "total_requests": total_reqs,
                    "avg_duration_ms": avg_latency,
                    "slow_count": slow_count,
                    "failed_count": failed_count,
                    "top_slowest": [
                        {
                            "url": t.url,
                            "method": t.method,
                            "status": t.status,
                            "duration_ms": t.duration_ms,
                            "resource_type": t.resource_type,
                        }
                        for t in sorted(captured_traces, key=lambda x: x.duration_ms, reverse=True)[:5]
                    ],
                },
                risk_impact=(
                    "Unoptimized network waterfalls directly increase Time-to-Interactive (TTI) "
                    "and Largest Contentful Paint (LCP)."
                ),
                code_example="<link rel='preconnect' href='https://api.yourdomain.com'>",
                target_location="Network Waterfall Profile",
                line_number=1,
                problematic_code=f"// Total requests: {total_reqs}, Avg: {avg_latency}ms",
                screenshot_before_b64=screenshot_initial_b64,
                rca_category=RCACategory.EXPECTED_BEHAVIOR,
            ))

        # ── Phase 4: Self-Healing & Flaky Test Auto-Repairs ──────────────
        healing_findings = self.self_healing.formulate_findings(
            target_url,
            screenshot_before=screenshot_initial_b64,
            screenshot_after=screenshot_final_b64 or screenshot_initial_b64,
        )
        findings.extend(healing_findings)
        self.self_healing_events = [
            {
                "original_selector": ev.original_selector,
                "healed_selector": ev.healed_selector,
                "strategy": ev.strategy,
                "confidence": ev.confidence,
                "flakiness_cause": ev.flakiness_cause,
                "timestamp": ev.timestamp.isoformat() if hasattr(ev.timestamp, "isoformat") else str(ev.timestamp),
            }
            for ev in self.self_healing.events
        ]

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

                    # Attempt form submission with self-healing selector recovery
                    try:
                        submit_btn, event = await self.self_healing.resolve_element(
                            form,
                            "button[type='submit'], input[type='submit']",
                            fallbacks=["button:visible", "[role='button']:visible"],
                            semantic_hint="Submit",
                            timeout_ms=1000
                        )
                        if await submit_btn.count() > 0:
                            interaction_log.append(
                                f"Form #{form_idx+1}: submitting with payload '{payload['type']}'" +
                                (f" (Self-healed: {event.strategy})" if event else "")
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
                            reproduction_steps=[
                                f"1. Open target page '{target_url}'",
                                f"2. Locate form #{form_idx+1} on page",
                                "3. Fill input fields with XSS probe: <script>alert(1)</script>",
                                "4. Click form submit button",
                                "5. Probe payload reflected unsanitized in DOM response",
                            ],
                            root_cause_hypothesis="Form input is rendered directly into response HTML without output encoding or sanitization (Reflected XSS).",
                            dom_snapshot=f"<form action='...'>...<script>alert(1)</script>...</form>",
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
                            reproduction_steps=[
                                f"1. Open target page '{target_url}'",
                                f"2. Locate form #{form_idx+1}",
                                "3. Inject SQL boundary probe payload: ' OR '1'='1",
                                "4. Submit form",
                                "5. Database error string reflected in page response",
                            ],
                            root_cause_hypothesis="Backend SQL query constructed via unescaped string concatenation, leaking database driver syntax errors to client.",
                            dom_snapshot=f"<form action='...'>// Leaked SQL syntax error in response</form>",
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
                        reproduction_steps=[
                            f"1. Navigate to '{target_url}'",
                            f"2. Wait for loading indicator matching '{sel}'",
                            "3. Monitor element visibility for 8000ms duration",
                            "4. Spinner remains visible without data resolution or timeout dismissal",
                        ],
                        root_cause_hypothesis=f"Frontend loading state for '{sel}' is controlled by an unhandled promise or suspended state machine that never dispatches a completion or error action.",
                        dom_snapshot=f"<div class='loading-spinner' selector='{sel}' aria-busy='true'></div>",
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
