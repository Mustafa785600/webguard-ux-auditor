import pytest
import httpx
from app.scanners.ux.playwright_qa import PlaywrightQAScanner
from app.models.schema import RCACategory


@pytest.mark.asyncio
async def test_playwright_qa_scanner_initialization():
    scanner = PlaywrightQAScanner()
    assert scanner is not None


@pytest.mark.asyncio
async def test_playwright_qa_scanner_graceful_on_invalid_url():
    scanner = PlaywrightQAScanner()
    async with httpx.AsyncClient() as client:
        findings = await scanner.scan("http://invalid-non-existent-domain-12345.xyz", client)
        assert isinstance(findings, list)


@pytest.mark.asyncio
async def test_playwright_qa_scanner_generates_suite_on_valid_domain():
    scanner = PlaywrightQAScanner()
    async with httpx.AsyncClient() as client:
        findings = await scanner.scan("https://example.com", client)
        assert isinstance(findings, list)
        suite_finding = next((f for f in findings if f.id == "QA_PLAYWRIGHT_E2E_SUITE"), None)
        assert suite_finding is not None
        assert "import { test, expect }" in suite_finding.code_example


@pytest.mark.asyncio
async def test_playwright_qa_suite_finding_has_rca_category():
    """Phase 2: E2E suite finding must carry EXPECTED_BEHAVIOR RCA classification."""
    scanner = PlaywrightQAScanner()
    async with httpx.AsyncClient() as client:
        findings = await scanner.scan("https://example.com", client)
        suite_finding = next((f for f in findings if f.id == "QA_PLAYWRIGHT_E2E_SUITE"), None)
        assert suite_finding is not None
        assert suite_finding.rca_category == RCACategory.EXPECTED_BEHAVIOR


@pytest.mark.asyncio
async def test_playwright_qa_findings_schema_has_phase2_fields():
    """Phase 2: All findings must be valid Finding objects with optional phase-2 fields."""
    scanner = PlaywrightQAScanner()
    async with httpx.AsyncClient() as client:
        findings = await scanner.scan("https://example.com", client)
        for finding in findings:
            # rca_category is optional but if set must be a valid RCACategory
            if finding.rca_category is not None:
                assert finding.rca_category in list(RCACategory)
            # interaction_log if present must be a list
            if finding.interaction_log is not None:
                assert isinstance(finding.interaction_log, list)


@pytest.mark.asyncio
async def test_playwright_qa_screenshot_captured_on_valid_domain():
    """Phase 2: Scanner must capture a before-screenshot for valid domains."""
    scanner = PlaywrightQAScanner()
    async with httpx.AsyncClient() as client:
        findings = await scanner.scan("https://example.com", client)
        suite_finding = next((f for f in findings if f.id == "QA_PLAYWRIGHT_E2E_SUITE"), None)
        if suite_finding:
            # evidence should record screenshot_captured
            assert suite_finding.evidence is not None
            assert "screenshot_captured" in suite_finding.evidence
