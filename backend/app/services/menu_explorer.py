"""
Multi-Layer Hover & Dropdown / Mega-Menu Traversal Engine.

Simulates authentic human navigation behavior:
1. Discovers top-level navigation items, dropdown toggles, and mega-menu triggers.
2. Hovers (and gently clicks if needed) over menu headers to reveal hidden sub-menus.
3. Extracts newly hydrated deep category links, sub-routes, and nested actions.
4. Cleanly dismisses opened overlays (Escape / mouse reset) to preserve DOM accessibility.
5. Feeds discovered internal links into AutonomousCrawler and PlaywrightQAScanner.
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from urllib.parse import urljoin, urlparse
from app.models.schema import Finding, Category, Severity, RCACategory


@dataclass
class SubmenuItem:
    parent_label: str
    link_text: str
    href: str
    revealed_by: str  # "HOVER" | "CLICK"


@dataclass
class MenuTraversalResult:
    menus_probed: int = 0
    dropdowns_opened: int = 0
    hidden_links_revealed: int = 0
    revealed_urls: List[str] = field(default_factory=list)
    submenus: List[SubmenuItem] = field(default_factory=list)
    duration_ms: float = 0.0
    details: str = ""


# ---------------------------------------------------------------------------
# In-browser DOM extraction helpers
# ---------------------------------------------------------------------------
GET_VISIBLE_SUBMENU_LINKS_SCRIPT = """
(container) => {
    const root = container || document;
    const links = Array.from(root.querySelectorAll(
        '.dropdown-menu a[href], .submenu a[href], [role="menu"] a[href], ' +
        '.mega-menu a[href], [class*="megamenu" i] a[href], [class*="sub-menu" i] a[href], ' +
        'ul ul a[href], div[class*="dropdown" i] a[href]'
    ));

    return links
        .filter(a => {
            const style = window.getComputedStyle(a);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rect = a.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && !!a.href;
        })
        .map(a => ({
            text: (a.innerText || a.textContent || '').trim().substring(0, 60),
            href: a.href
        }));
}
"""


class NavigationMenuExplorer:
    """
    Explores multi-layer navigation menus, hovering over category headers,
    opening mega-menus/dropdowns, and discovering hidden deep routes.
    """

    @classmethod
    async def explore_dropdown_menus(
        cls,
        page,
        base_url: str = "",
        max_menus: int = 6,
        hover_delay_ms: int = 220
    ) -> MenuTraversalResult:
        """
        Probes primary navigation headers for hover/click dropdowns and extracts hidden links.
        """
        start_time = time.perf_counter()
        revealed_urls: List[str] = []
        submenus: List[SubmenuItem] = []
        dropdowns_opened = 0
        menus_probed = 0

        try:
            # 1. Identify primary navigation triggers
            # Priority: Elements explicitly marked as dropdown triggers or top nav list items
            trigger_selectors = [
                "nav [aria-haspopup='true']:visible",
                "nav [data-bs-toggle='dropdown']:visible",
                "nav [data-toggle='dropdown']:visible",
                "nav .dropdown-toggle:visible",
                "header [aria-haspopup='true']:visible",
                "header [data-toggle='dropdown']:visible",
                "nav li:has(ul) > a:visible",
                "nav li:has(ul) > button:visible",
                "nav > ul > li > a:visible",
                "nav > ul > li > button:visible",
                "header nav a:visible",
                "header nav button:visible",
            ]

            nav_triggers = None
            for sel in trigger_selectors:
                try:
                    loc = page.locator(sel)
                    cnt = await loc.count()
                    if cnt > 0:
                        nav_triggers = loc
                        break
                except Exception:
                    continue

            # Fallback to general visible nav links if no specialized dropdown markup
            if not nav_triggers or await nav_triggers.count() == 0:
                nav_triggers = page.locator("nav a:visible, header a:visible")

            total_triggers = await nav_triggers.count()
            probe_limit = min(total_triggers, max_menus)

            # Record baseline of initially visible links before any hover
            initial_links_data = await page.evaluate(GET_VISIBLE_SUBMENU_LINKS_SCRIPT, None)
            initial_urls = {item["href"] for item in initial_links_data}

            for idx in range(probe_limit):
                try:
                    trigger = nav_triggers.nth(idx)
                    if not await trigger.is_visible():
                        continue

                    raw_label = await trigger.inner_text()
                    label = (raw_label or await trigger.get_attribute("aria-label") or f"Menu #{idx+1}").strip()
                    menus_probed += 1

                    # Check if trigger is a link to an external domain or simple jump
                    href_attr = (await trigger.get_attribute("href") or "").strip()
                    tag_name = await trigger.evaluate("el => el.tagName.toLowerCase()")

                    # ── STEP A: HOVER SIMULATION ─────────────────────────
                    await trigger.hover(timeout=3000)
                    await asyncio.sleep(hover_delay_ms / 1000.0)

                    # Inspect if new links became visible in the DOM
                    current_links = await page.evaluate(GET_VISIBLE_SUBMENU_LINKS_SCRIPT, None)
                    newly_revealed = [l for l in current_links if l["href"] not in initial_urls and l["href"] not in revealed_urls]

                    revealed_by = "HOVER"

                    # ── STEP B: CLICK SIMULATION (IF HOVER DID NOT OPEN) ─
                    if not newly_revealed:
                        # If trigger is a button, a hash link (#), or has aria-haspopup, try gentle click
                        is_interactive_toggle = (
                            tag_name == "button" or
                            href_attr in ("", "#", "javascript:void(0)", "javascript:;") or
                            await trigger.get_attribute("aria-haspopup") or
                            await trigger.get_attribute("data-toggle")
                        )

                        if is_interactive_toggle:
                            try:
                                await trigger.click(timeout=3000)
                                await asyncio.sleep(hover_delay_ms / 1000.0)
                                current_links = await page.evaluate(GET_VISIBLE_SUBMENU_LINKS_SCRIPT, None)
                                newly_revealed = [l for l in current_links if l["href"] not in initial_urls and l["href"] not in revealed_urls]
                                revealed_by = "CLICK"
                            except Exception:
                                pass

                    # ── STEP C: RECORD REVEALED ITEMS ────────────────────
                    if newly_revealed:
                        dropdowns_opened += 1
                        for item in newly_revealed:
                            full_url = item["href"]
                            if full_url not in revealed_urls:
                                revealed_urls.append(full_url)
                                submenus.append(
                                    SubmenuItem(
                                        parent_label=label[:40],
                                        link_text=item["text"] or label[:30],
                                        href=full_url,
                                        revealed_by=revealed_by
                                    )
                                )

                    # ── STEP D: CLEAN RESET ──────────────────────────────
                    # Move mouse away and press Escape to close opened overlays
                    try:
                        await page.mouse.move(0, 0)
                        await page.keyboard.press("Escape")
                        await asyncio.sleep(0.08)
                    except Exception:
                        pass

                except Exception:
                    continue

            duration = round((time.perf_counter() - start_time) * 1000, 1)
            details = (
                f"Probed {menus_probed} navigation triggers. Opened {dropdowns_opened} dropdown/mega-menus, "
                f"revealing {len(revealed_urls)} hidden sub-routes."
            )

            return MenuTraversalResult(
                menus_probed=menus_probed,
                dropdowns_opened=dropdowns_opened,
                hidden_links_revealed=len(revealed_urls),
                revealed_urls=revealed_urls,
                submenus=submenus,
                duration_ms=duration,
                details=details
            )

        except Exception as exc:
            duration = round((time.perf_counter() - start_time) * 1000, 1)
            return MenuTraversalResult(
                menus_probed=menus_probed,
                dropdowns_opened=0,
                hidden_links_revealed=0,
                revealed_urls=[],
                submenus=[],
                duration_ms=duration,
                details=f"Menu exploration completed with note: {str(exc)[:100]}"
            )

    @classmethod
    def formulate_menu_summary_finding(
        cls,
        result: MenuTraversalResult,
        target_url: str
    ) -> Optional[Finding]:
        """
        Provides an informational QA finding summarizing multi-layer navigation
        and sub-routes successfully exposed by the autonomous agent.
        """
        if result.hidden_links_revealed == 0 and result.dropdowns_opened == 0:
            return None

        samples = [f"- [{sub.parent_label}] → '{sub.link_text}' ({sub.href}) via {sub.revealed_by}" for sub in result.submenus[:5]]
        sample_text = "\n".join(samples)

        return Finding(
            id="QA_MULTI_LAYER_NAVIGATION_SUMMARY",
            category=Category.UX,
            severity=Severity.INFO,
            title=f"Multi-Layer Navigation Traversal: {result.hidden_links_revealed} Sub-Routes Revealed",
            description=(
                f"Autonomous agent probed {result.menus_probed} header menus, dynamically opened "
                f"{result.dropdowns_opened} dropdown/mega-menu(s), and extracted {result.hidden_links_revealed} "
                f"previously hidden sub-routes and category destinations."
            ),
            remediation=(
                "Ensure all dropdown menus support keyboard navigation (Tab, Arrow keys, Escape) "
                "and include explicit 'aria-haspopup' and 'aria-expanded' attributes for screen reader accessibility."
            ),
            risk_impact=(
                "Categories hidden exclusively behind hover scripts may remain undiscovered by search engine "
                "bots and keyboard-only assistive technology users unless accessible DOM fallbacks exist."
            ),
            code_example=(
                "<button aria-haspopup='true' aria-expanded='false' class='dropdown-toggle'>\n"
                "  Products\n"
                "</button>\n"
                "<ul class='dropdown-menu' role='menu'>\n"
                "  <li><a href='/products/cloud'>Cloud Platform</a></li>\n"
                "</ul>"
            ),
            target_location="Header / Main Navigation Bar",
            problematic_code=sample_text,
            evidence={
                "menus_probed": result.menus_probed,
                "dropdowns_opened": result.dropdowns_opened,
                "hidden_links_revealed": result.hidden_links_revealed,
                "revealed_urls_sample": result.revealed_urls[:10]
            },
            rca_category=RCACategory.EXPECTED_BEHAVIOR,
            team_assignment="Yazılım Geliştirici (Frontend / Backend)",
            root_cause_hypothesis="Interactive hover & click state machine successfully revealed client-side hydrated dropdown and mega-menu subtrees.",
            reproduction_steps=[
                f"1. Navigate to target '{target_url}'",
                "2. Hover mouse over top-level navigation categories in header",
                f"3. Observe dynamic expansion of {result.dropdowns_opened} dropdown/mega-menu(s) revealing sub-links",
            ]
        )
