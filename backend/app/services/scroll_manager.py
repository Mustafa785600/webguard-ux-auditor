"""
Human Scroll & Lazy-Load Trigger Engine (Smooth Human Scroll).

Simulates authentic human viewport scrolling:
1. Incremental mouse wheel & viewport scroll steps (300-450px per tick).
2. Micro-pauses (100-180ms) to let IntersectionObserver and lazy-load handlers fire.
3. Quantifies lazy-loaded asset hydration (data-src -> src, loading='lazy').
4. Detects infinite-scroll dynamic content injection and broken lazy images.
5. Returns page to top viewport so subsequent interactive audits remain aligned.
"""

import asyncio
import time
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from app.models.schema import Finding, Category, Severity, RCACategory, SectorType


@dataclass
class HumanScrollResult:
    total_scrolled_px: int = 0
    scroll_steps: int = 0
    max_page_height: int = 0
    lazy_elements_hydrated: int = 0
    infinite_scroll_detected: bool = False
    duration_ms: float = 0.0
    broken_images_detected: int = 0
    broken_image_sources: List[str] = None
    details: str = ""

    def __post_init__(self):
        if self.broken_image_sources is None:
            self.broken_image_sources = []


# ---------------------------------------------------------------------------
# In-browser DOM telemetry scripts
# ---------------------------------------------------------------------------
GET_PAGE_METRICS_SCRIPT = """
() => {
    return {
        scrollHeight: Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
            document.body.clientHeight,
            document.documentElement.clientHeight
        ),
        viewportHeight: window.innerHeight,
        currentScrollY: window.scrollY || window.pageYOffset || 0,
        lazyImagesCount: document.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy], [data-lazy-src]').length,
        totalImagesCount: document.querySelectorAll('img').length
    };
}
"""

CHECK_LAZY_AND_BROKEN_IMAGES_SCRIPT = """
() => {
    const images = Array.from(document.querySelectorAll('img'));
    let broken = [];
    let hydrated = 0;

    images.forEach(img => {
        // Hydrated check: has a valid src and positive dimensions
        if (img.complete && img.naturalWidth > 0) {
            hydrated++;
        }
        // Broken image check: finished loading or errored, but naturalWidth is 0
        if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:image/svg')) {
            broken.push(img.src.substring(0, 150));
        }
    });

    return {
        total: images.length,
        hydrated: hydrated,
        brokenCount: broken.length,
        brokenUrls: broken.slice(0, 5)
    };
}
"""

SCROLL_TO_TOP_SCRIPT = """
() => {
    window.scrollTo(0, 0);
}
"""


class HumanScrollEngine:
    """
    Simulates natural human mouse wheel scrolling to trigger IntersectionObserver,
    lazy-load scripts, dynamic feeds, and infinite scroll payloads.
    """

    @classmethod
    async def smooth_scroll_page(
        cls,
        page,
        max_steps: int = 8,
        step_px: int = 350,
        pause_ms: int = 140,
        return_to_top: bool = True
    ) -> HumanScrollResult:
        """
        Executes step-by-step smooth scroll downwards on the page.
        """
        start_time = time.perf_counter()

        try:
            # 1. Read initial metrics
            initial_metrics = await page.evaluate(GET_PAGE_METRICS_SCRIPT)
            initial_height = initial_metrics.get("scrollHeight", 800)
            viewport_h = initial_metrics.get("viewportHeight", 800)

            # If page is shorter than 1.2x viewport, no deep scroll needed
            if initial_height <= viewport_h * 1.1:
                return HumanScrollResult(
                    total_scrolled_px=0,
                    scroll_steps=0,
                    max_page_height=initial_height,
                    lazy_elements_hydrated=0,
                    infinite_scroll_detected=False,
                    duration_ms=round((time.perf_counter() - start_time) * 1000, 1),
                    details="Page height fits within viewport; scroll skipped."
                )

            total_scrolled = 0
            steps_taken = 0
            infinite_scroll = False

            # 2. Incrementally scroll downwards
            current_y = 0
            for step_idx in range(max_steps):
                # Dispatch wheel event simulating human mouse wheel
                try:
                    await page.mouse.wheel(0, step_px)
                except Exception:
                    # Fallback to JS scrollBy
                    await page.evaluate(f"window.scrollBy({{ top: {step_px}, behavior: 'smooth' }});")

                current_y += step_px
                total_scrolled += step_px
                steps_taken += 1

                # Brief human pause for rendering and network chunk delivery
                await asyncio.sleep(pause_ms / 1000.0)

                # Check if we reached the bottom or if height increased (infinite scroll)
                page_state = await page.evaluate(GET_PAGE_METRICS_SCRIPT)
                new_height = page_state.get("scrollHeight", initial_height)
                actual_y = page_state.get("currentScrollY", current_y)

                if new_height > initial_height + 200:
                    infinite_scroll = True
                    initial_height = new_height

                # If reached bottom
                if actual_y + viewport_h >= new_height - 50:
                    break

            # 3. Analyze post-scroll lazy image hydration & broken images
            img_audit = await page.evaluate(CHECK_LAZY_AND_BROKEN_IMAGES_SCRIPT)
            broken_count = img_audit.get("brokenCount", 0)
            broken_urls = img_audit.get("brokenUrls", [])
            hydrated_count = img_audit.get("hydrated", 0)

            # 4. Return to top smoothly if requested (so next test steps have top nav in view)
            if return_to_top:
                try:
                    await page.evaluate(SCROLL_TO_TOP_SCRIPT)
                    await asyncio.sleep(0.15)
                except Exception:
                    pass

            duration = round((time.perf_counter() - start_time) * 1000, 1)

            summary = (
                f"Traversed {total_scrolled}px over {steps_taken} human scroll steps. "
                f"Hydrated {hydrated_count} media elements. "
                + (f"Infinite scroll detected (+DOM height expansion). " if infinite_scroll else "")
                + (f"Found {broken_count} broken image asset(s)." if broken_count > 0 else "All visible assets loaded successfully.")
            )

            return HumanScrollResult(
                total_scrolled_px=total_scrolled,
                scroll_steps=steps_taken,
                max_page_height=initial_height,
                lazy_elements_hydrated=hydrated_count,
                infinite_scroll_detected=infinite_scroll,
                duration_ms=duration,
                broken_images_detected=broken_count,
                broken_image_sources=broken_urls,
                details=summary
            )

        except Exception as exc:
            duration = round((time.perf_counter() - start_time) * 1000, 1)
            return HumanScrollResult(
                total_scrolled_px=0,
                scroll_steps=0,
                duration_ms=duration,
                details=f"Scroll simulation completed with note: {str(exc)[:100]}"
            )

    @classmethod
    def formulate_broken_assets_finding(
        cls,
        result: HumanScrollResult,
        target_url: str
    ) -> Optional[Finding]:
        """
        If smooth human scrolling exposed broken image assets (e.g. 404 images loaded via lazy loading),
        formulates an actionable UX & QA finding.
        """
        if result.broken_images_detected == 0:
            return None

        urls_sample = "\n".join(f"- {u}" for u in result.broken_image_sources[:3])
        return Finding(
            id="UX_LAZY_LOAD_BROKEN_ASSET",
            category=Category.UX,
            severity=Severity.MEDIUM,
            title=f"{result.broken_images_detected} Lazy-Loaded Image Asset(s) Failed to Render",
            description=(
                f"During autonomous smooth human scrolling on '{target_url}', {result.broken_images_detected} "
                f"image element(s) failed to load after entering the viewport (naturalWidth: 0)."
            ),
            remediation=(
                "Verify CDN URLs, ensure fallback placeholder images are defined (e.g. onerror='this.src=...'), "
                "and audit responsive picture sources."
            ),
            risk_impact=(
                "Broken images appear as missing icon boxes or empty gaps, damaging brand perception, "
                "user trust, and perceived application polish."
            ),
            code_example=(
                "<img src='/images/product.jpg' \n"
                "     loading='lazy' \n"
                "     alt='Product preview' \n"
                "     onerror=\"this.onerror=null; this.src='/images/placeholder.png';\" />"
            ),
            target_location="Lazy-load DOM Image Elements",
            problematic_code=urls_sample,
            evidence={
                "broken_count": result.broken_images_detected,
                "broken_urls": result.broken_image_sources,
                "scrolled_distance_px": result.total_scrolled_px
            },
            rca_category=RCACategory.REAL_BUG,
            team_assignment="Yazılım Geliştirici (Frontend / Backend)",
            root_cause_hypothesis="Lazy-loaded image source URLs point to missing or deleted CDN assets, returning 404 or failing CORS without an onerror fallback handler.",
            reproduction_steps=[
                f"1. Navigate to target '{target_url}'",
                "2. Smoothly scroll down the page to trigger IntersectionObserver lazy loading",
                f"3. Observe {result.broken_images_detected} image element(s) failing to render with zero natural width",
            ]
        )
