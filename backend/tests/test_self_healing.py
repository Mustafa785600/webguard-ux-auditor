import pytest
from app.services.self_healing import SelfHealingEngine, HealingEvent
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
            confidence=0.95
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

