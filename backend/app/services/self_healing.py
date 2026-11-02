import asyncio
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel
from app.models.schema import Finding, Category, Severity, RCACategory


class HealingEvent(BaseModel):
    original_selector: str
    healed_selector: str
    strategy: str
    confidence: float
    timestamp: datetime = datetime.utcnow()


class SelfHealingEngine:
    """
    TestSprite-style Self-Healing Selector Engine.
    When a primary DOM selector changes or breaks, attempts multi-tier fallback
    strategies (data-testid -> role/aria -> semantic text -> nearest button/input)
    to prevent flaky tests and report repair telemetry.
    """

    def __init__(self):
        self.events: List[HealingEvent] = []

    async def resolve_element(
        self,
        page,
        primary_selector: str,
        fallbacks: Optional[List[str]] = None,
        semantic_hint: Optional[str] = None,
        timeout_ms: int = 1500,
    ) -> Tuple[Any, Optional[HealingEvent]]:
        """
        Attempts to locate an element with primary_selector.
        If missing, iterates through fallbacks or derives semantic selectors.
        """
        # 1. Try Primary Selector
        try:
            loc = page.locator(primary_selector).first
            if await loc.count() > 0 and await loc.is_visible(timeout=timeout_ms):
                return loc, None
        except Exception:
            pass

        # 2. Candidate Fallbacks List
        candidates: List[Tuple[str, str, float]] = []  # (selector, strategy, confidence)

        if fallbacks:
            for fb in fallbacks:
                candidates.append((fb, "Explicit Fallback Candidate", 0.90))

        # Semantic derivation if text hint provided (e.g., "Submit", "Login")
        if semantic_hint:
            clean_hint = semantic_hint.strip()
            candidates.append((f"[data-testid*='{clean_hint.lower()}']", "TestID Attribute Match", 0.95))
            candidates.append((f"[aria-label*='{clean_hint}' i]", "ARIA Accessibility Label", 0.88))
            candidates.append((f"button:has-text('{clean_hint}')", "Button Text Heuristic", 0.85))
            candidates.append((f"a:has-text('{clean_hint}')", "Anchor Text Heuristic", 0.80))
            candidates.append((f"input[value*='{clean_hint}' i]", "Input Value Heuristic", 0.78))

        # Try candidates in order
        for selector, strategy, confidence in candidates:
            try:
                candidate_loc = page.locator(selector).first
                if await candidate_loc.count() > 0 and await candidate_loc.is_visible(timeout=1000):
                    event = HealingEvent(
                        original_selector=primary_selector,
                        healed_selector=selector,
                        strategy=strategy,
                        confidence=confidence,
                        timestamp=datetime.utcnow(),
                    )
                    self.events.append(event)
                    return candidate_loc, event
            except Exception:
                continue

        # If completely unresolvable, return original locator
        return page.locator(primary_selector).first, None

    def formulate_findings(self, target_url: str) -> List[Finding]:
        """Translates self-healing events into actionable TEST_FRAGILITY findings."""
        findings: List[Finding] = []
        for ev in self.events:
            findings.append(
                Finding(
                    id="QA_SELF_HEALING_REPAIRED",
                    category=Category.UX,
                    severity=Severity.LOW,
                    title=f"Self-Healing: Brittle Selector Auto-Repaired ({ev.strategy})",
                    description=(
                        f"Original selector '{ev.original_selector}' was missing from the DOM. "
                        f"The autonomous self-healing engine recovered using '{ev.healed_selector}' "
                        f"with {int(ev.confidence * 100)}% confidence."
                    ),
                    remediation=(
                        f"Update test scripts and component markup to use resilient stable attributes: "
                        f"replace '{ev.original_selector}' with data-testid or aria-label '{ev.healed_selector}'."
                    ),
                    evidence={
                        "original_selector": ev.original_selector,
                        "healed_selector": ev.healed_selector,
                        "strategy": ev.strategy,
                        "confidence": ev.confidence,
                    },
                    risk_impact=(
                        "Brittle selectors break CI/CD test runs on minor CSS or layout redesigns, "
                        "causing false-alarm build failures."
                    ),
                    code_example=(
                        f"// Recommended: Add data-testid to your component\n"
                        f"<button data-testid='{ev.healed_selector.replace('[', '').replace(']', '')}'>\n"
                        f"  Action\n"
                        f"</button>"
                    ),
                    target_location="tests/e2e/autonomous.spec.ts",
                    line_number=1,
                    problematic_code=ev.original_selector,
                    rca_category=RCACategory.TEST_FRAGILITY,
                )
            )
        return findings

