import pytest
from app.services.codebase_intelligence import CodebaseIntelligenceEngine
from app.models.schema import ArchitectureLayer, CodebaseIntelligenceReport

def test_codebase_intelligence_engine_analysis():
    engine = CodebaseIntelligenceEngine()
    report = engine.analyze()

    assert isinstance(report, CodebaseIntelligenceReport)
    assert report.total_files > 0
    assert report.total_lines_of_code > 0
    assert report.total_symbols > 0
    assert report.architectural_health_score >= 90
    assert len(report.full_stack_flows) >= 4

    # Verify key symbols are extracted with purposes
    symbol_names = [s.name for s in report.symbols]
    assert "CookieConsentManager" in symbol_names
    assert "HumanScrollEngine" in symbol_names
    assert "NavigationMenuExplorer" in symbol_names
    assert "ChallengeDetector" in symbol_names
    assert "LiveStreamHub" in symbol_names
    assert "ScanResult" in symbol_names

    # Check intent purpose synthesis
    cookie_sym = next(s for s in report.symbols if s.name == "CookieConsentManager")
    assert "KVKK" in cookie_sym.purpose_summary or "çerez" in cookie_sym.purpose_summary.lower()
    assert cookie_sym.layer in [ArchitectureLayer.SERVICE_LOGIC, ArchitectureLayer.SECURITY_GUARD]
    assert cookie_sym.blast_radius_score > 0

    # Check edges and cross-stack connections
    assert len(report.edges) > 0

def test_blast_radius_calculation():
    engine = CodebaseIntelligenceEngine()
    report = engine.analyze()

    # Models and orchestrators should have significant blast radius
    scan_result_sym = next((s for s in report.symbols if s.name == "ScanResult"), None)
    if scan_result_sym:
        assert scan_result_sym.blast_radius_score >= 5

