import pytest
from app.services.self_healing import SelfHealingEngine, HealingEvent, heal_playwright_script
from app.models.schema import RCACategory, Severity


def test_self_healing_engine_initialization():
    engine = SelfHealingEngine()
    assert len(engine.events) == 0


def test_self_healing_engine_formulate_findings():
    engine = SelfHealingEngine()
    engine.events.append(
        HealingEvent(
            original_selector="#btn-submit-old",
            healed_selector="button[data-testid='submit-btn']",
            strategy="TestID Attribute Match",
            confidence=0.95,
            flakiness_cause="CSS class rehashed"
        )
    )

    findings = engine.formulate_findings("https://example.com")
    assert len(findings) == 1
    finding = findings[0]
    assert finding.id == "QA_SELF_HEALING_REPAIRED"
    assert finding.severity == Severity.LOW
    assert finding.rca_category == RCACategory.TEST_FRAGILITY
    assert finding.evidence["original_selector"] == "#btn-submit-old"
    assert finding.evidence["healed_selector"] == "button[data-testid='submit-btn']"
    assert finding.reproduction_steps is not None
    assert len(finding.reproduction_steps) >= 4
    assert finding.root_cause_hypothesis is not None


def test_heal_playwright_script_css_hash_and_xpath():
    brittle_script = """
import { test, expect } from '@playwright/test';

test('E-Commerce Checkout', async ({ page }) => {
  await page.goto('https://shop.example.com');
  await page.click('.css-1v8x7qz');
  await page.locator('/html/body/div[2]/div/section/form/div[3]/button').click();
  await page.waitForTimeout(5000);
});
"""
    result = heal_playwright_script(brittle_script)
    assert len(result.repairs) >= 3
    assert result.resilience_score_after > result.resilience_score_before
    assert result.flakiness_reduction_pct > 0
    # Check that static sleep is removed
    assert "waitForTimeout(5000)" not in result.healed_code
    assert "toBeVisible" in result.healed_code
    # Check that xpath is repaired
    assert "/html/body" not in result.healed_code


def test_heal_playwright_script_clean_code():
    clean_script = """
import { test, expect } from '@playwright/test';

test('Resilient Auth', async ({ page }) => {
  await page.goto('https://app.example.com');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.locator('body')).toBeVisible();
});
"""
    result = heal_playwright_script(clean_script)
    assert len(result.repairs) == 0
    assert result.resilience_score_before >= 90
    assert result.resilience_score_after >= 95
