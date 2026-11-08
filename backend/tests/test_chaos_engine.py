import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.chaos_engine import ChaosFaultInjectionEngine
from app.models.schema import ChaosVerdict, ChaosFaultType, ChaosResilienceReport

def test_chaos_baseline_generation():
    engine = ChaosFaultInjectionEngine()
    report, findings = engine._generate_synthetic_baseline("https://example.com")

    assert isinstance(report, ChaosResilienceReport)
    assert report.total_experiments == 4
    assert report.chaos_resilience_score >= 90
    assert len(report.experiments) == 4

    fault_types = [e.fault_type for e in report.experiments]
    assert ChaosFaultType.API_500_SERVER_ERROR in fault_types
    assert ChaosFaultType.API_LATENCY_SPIKE in fault_types
    assert ChaosFaultType.NETWORK_CONNECTION_ABORT in fault_types
    assert ChaosFaultType.MALFORMED_JSON_PAYLOAD in fault_types

@pytest.mark.asyncio
async def test_inspect_page_health_detects_wsod():
    engine = ChaosFaultInjectionEngine()

    mock_page = MagicMock()
    mock_page.evaluate = AsyncMock(return_value="")
    mock_locator = MagicMock()
    mock_locator.count = AsyncMock(return_value=0)
    mock_page.locator.return_value = mock_locator

    wsod, reaction = await engine._inspect_page_health(mock_page)
    assert wsod is True
    assert "Beyaz Ekran" in reaction

@pytest.mark.asyncio
async def test_inspect_page_health_healthy_page():
    engine = ChaosFaultInjectionEngine()

    mock_page = MagicMock()
    mock_page.evaluate = AsyncMock(return_value="Welcome to WebGuard - Enterprise Testing Platform")
    mock_locator = MagicMock()
    mock_locator.count = AsyncMock(return_value=0)
    mock_page.locator.return_value = mock_locator

    wsod, reaction = await engine._inspect_page_health(mock_page)
    assert wsod is False
    assert "Stabil" in reaction

@pytest.mark.asyncio
async def test_execute_suite_on_mock_page():
    engine = ChaosFaultInjectionEngine()
    mock_page = MagicMock()
    mock_page.route = AsyncMock()
    mock_page.unroute = AsyncMock()
    mock_page.goto = AsyncMock()
    mock_page.wait_for_timeout = AsyncMock()
    mock_page.on = MagicMock()
    mock_page.evaluate = AsyncMock(return_value="Valid page content rendered successfully")
    mock_locator = MagicMock()
    mock_locator.count = AsyncMock(return_value=0)
    mock_page.locator.return_value = mock_locator

    results, findings = await engine._execute_suite_on_page(mock_page, "https://example.com")
    assert len(results) == 4
    for r in results:
        assert r.verdict in [ChaosVerdict.RESILIENT, ChaosVerdict.DEGRADED]
        assert r.white_screen_detected is False
