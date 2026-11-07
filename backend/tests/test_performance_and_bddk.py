import gzip
import pytest
import httpx
from bs4 import BeautifulSoup
from app.models.schema import SectorType, Severity, Category
from app.services.performance_tester import PerformanceBenchmarkEngine
from app.scanners.security.compliance import ComplianceScanner

@pytest.mark.asyncio
async def test_performance_benchmark_calculations():
    engine = PerformanceBenchmarkEngine(concurrency=2, total_requests=4, timeout_seconds=2.0)
    
    # Mock transport with fast 200 OK and valid gzipped content
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"Content-Encoding": "gzip"}, content=gzip.compress(b"OK"), request=request)
    
    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        metrics, findings = await engine.benchmark("https://test-bank.com", client=client)
    
    assert metrics.total_requests == 4
    assert metrics.success_rate == 100.0
    assert metrics.sla_status in ("EXCELLENT", "ACCEPTABLE")
    assert metrics.p50_latency_ms >= 0
    assert metrics.p95_latency_ms >= 0
    assert metrics.throughput_req_per_sec > 0

@pytest.mark.asyncio
async def test_performance_sla_breach_detection():
    # Force a breach by mocking a simulated slow or error response
    engine = PerformanceBenchmarkEngine(concurrency=2, total_requests=3, timeout_seconds=1.0)
    
    def slow_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error", request=request)
    
    transport = httpx.MockTransport(slow_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        metrics, findings = await engine.benchmark("https://slow-service.com", client=client)
    
    assert metrics.success_rate < 50.0
    assert metrics.sla_status == "BREACH"
    # Should generate concurrent stress failure
    stress_findings = [f for f in findings if f.id == "PERF_CONCURRENT_STRESS_FAILURE"]
    assert len(stress_findings) == 1

def test_bddk_sector_auto_detection():
    scanner = ComplianceScanner()
    soup = BeautifulSoup("<html><body>Bireysel Bankacılık, Vadeli Mevduat Hesabı ve FAST / EFT işlemleri</body></html>", "html.parser")
    sector = scanner.detect_sector(soup, "https://ornekbank.com.tr", soup.text)
    assert sector == SectorType.FINTECH_BANKING

def test_bddk_unmasked_iban_detection():
    scanner = ComplianceScanner()
    html_with_iban = """
    <div>
        <p>Hesap IBAN Numaranız: TR330006100511123456789012</p>
    </div>
    """
    findings = scanner._check_bddk_financial_data_masking(html_with_iban)
    iban_findings = [f for f in findings if f.id == "BDDK_UNMASKED_IBAN_EXPOSURE"]
    assert len(iban_findings) == 1
    assert iban_findings[0].severity == Severity.HIGH
    assert "BDDK" in iban_findings[0].compliance_standard

def test_bddk_masked_iban_no_false_positive():
    scanner = ComplianceScanner()
    html_with_masked_iban = """
    <div>
        <p>Hesap IBAN: TR33 ********** 9012</p>
    </div>
    """
    findings = scanner._check_bddk_financial_data_masking(html_with_masked_iban)
    iban_findings = [f for f in findings if f.id == "BDDK_UNMASKED_IBAN_EXPOSURE"]
    assert len(iban_findings) == 0

def test_bddk_unmasked_tckn_detection():
    scanner = ComplianceScanner()
    # 10000000146 passes authentic Turkish TCKN checksum algorithm
    html_with_tckn = """
    <div>
        <span>Müşteri TCKN: 10000000146</span>
    </div>
    """
    findings = scanner._check_bddk_financial_data_masking(html_with_tckn)
    tckn_findings = [f for f in findings if f.id == "BDDK_UNMASKED_TCKN_EXPOSURE"]
    assert len(tckn_findings) == 1
    assert tckn_findings[0].severity == Severity.CRITICAL

def test_bddk_session_cookie_missing_flags():
    scanner = ComplianceScanner()
    resp = httpx.Response(
        200,
        headers=[
            ("Set-Cookie", "session_id=1234567890; Path=/"),
            ("Set-Cookie", "user_pref=dark; Path=/")
        ]
    )
    findings = scanner._check_bddk_session_security(resp)
    assert len(findings) == 1
    assert findings[0].id == "BDDK_INSECURE_SESSION_COOKIE"
    assert "Secure" in findings[0].description
