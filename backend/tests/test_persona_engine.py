import pytest
from unittest.mock import AsyncMock, MagicMock
from app.models.schema import UserPersona, PersonaAuditReport
from app.services.persona_engine import PersonaSimulatorEngine, PERSONA_METADATA

def test_persona_metadata_all_defined():
    for p in UserPersona:
        assert p in PERSONA_METADATA
        meta = PERSONA_METADATA[p]
        assert "title" in meta
        assert "icon" in meta
        assert "desc" in meta

@pytest.mark.asyncio
async def test_persona_simulation_shopper():
    mock_page = MagicMock()
    mock_locator = MagicMock()
    mock_locator.count = AsyncMock(return_value=1)
    mock_locator.first = mock_locator
    mock_locator.click = AsyncMock()
    mock_locator.fill = AsyncMock()
    mock_locator.hover = AsyncMock()
    mock_page.locator.return_value = mock_locator

    report, findings = await PersonaSimulatorEngine.simulate(
        page=mock_page,
        target_url="https://example.com",
        persona=UserPersona.SHOPPER
    )

    assert isinstance(report, PersonaAuditReport)
    assert report.persona == UserPersona.SHOPPER
    assert report.persona_title == "E-Ticaret Alışverişçisi"
    assert report.total_actions > 0
    assert report.satisfaction_score >= 0

@pytest.mark.asyncio
async def test_persona_simulation_rage_tester():
    mock_page = MagicMock()
    mock_locator = MagicMock()
    mock_locator.count = AsyncMock(return_value=1)
    mock_locator.first = mock_locator
    mock_locator.click = AsyncMock()
    mock_page.locator.return_value = mock_locator
    mock_page.evaluate = AsyncMock()

    report, findings = await PersonaSimulatorEngine.simulate(
        page=mock_page,
        target_url="https://example.com",
        persona=UserPersona.RAGE_TESTER
    )

    assert report.persona == UserPersona.RAGE_TESTER
    assert report.persona_title == "Sabırsız / Hızlı Kullanıcı"
    assert len(report.events) >= 1

@pytest.mark.asyncio
async def test_persona_simulation_accessibility():
    mock_page = MagicMock()
    mock_locator = MagicMock()
    # No missing alt images
    mock_locator.count = AsyncMock(return_value=0)
    mock_page.locator.return_value = mock_locator
    mock_page.keyboard.press = AsyncMock()
    mock_page.evaluate = AsyncMock(return_value="BUTTON")

    report, findings = await PersonaSimulatorEngine.simulate(
        page=mock_page,
        target_url="https://example.com",
        persona=UserPersona.ACCESSIBILITY
    )

    assert report.persona == UserPersona.ACCESSIBILITY
    assert "Erişilebilirlik" in report.persona_title
    assert report.satisfaction_score >= 80

@pytest.mark.asyncio
async def test_persona_simulation_power_explorer():
    mock_page = MagicMock()
    mock_locator = MagicMock()
    mock_locator.count = AsyncMock(return_value=4)
    mock_locator.nth.return_value.hover = AsyncMock()
    mock_page.locator.return_value = mock_locator

    report, findings = await PersonaSimulatorEngine.simulate(
        page=mock_page,
        target_url="https://example.com",
        persona=UserPersona.POWER_EXPLORER
    )

    assert report.persona == UserPersona.POWER_EXPLORER
    assert "Kaşif" in report.persona_title
    assert len(report.events) >= 1
