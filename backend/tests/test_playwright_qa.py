import pytest
import httpx
from app.scanners.ux.playwright_qa import PlaywrightQAScanner

@pytest.mark.asyncio
async def test_playwright_qa_scanner_initialization():
    scanner = PlaywrightQAScanner()
    assert scanner is not None

@pytest.mark.asyncio
async def test_playwright_qa_scanner_graceful_on_invalid_url():
    scanner = PlaywrightQAScanner()
    async with httpx.AsyncClient() as client:
        # Should gracefully return empty findings or caught exceptions without crashing
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
