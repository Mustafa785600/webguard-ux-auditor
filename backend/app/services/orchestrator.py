import asyncio
from datetime import datetime
from typing import Optional
import uuid
import httpx
from app.core.config import settings
from app.core.security import validate_and_sanitize_target_url
from app.models.schema import Finding, ScanResult, ScanStatus, Category, SectorType, Severity, RCACategory
from app.scanners.security.headers import SecurityHeadersScanner
from app.scanners.security.ssl_tls import SSLTLSScanner
from app.scanners.security.exposure import ExposureScanner
from app.scanners.security.error_handling import ErrorHandlingScanner
from app.scanners.security.technologies import TechnologyScanner
from app.scanners.security.compliance import ComplianceScanner
from app.scanners.ux.basic_ux import BasicUXScanner
from app.scanners.ux.links import BrokenLinksScanner
from app.scanners.ux.forms_a11y import FormsA11yScanner
from app.scanners.ux.playwright_qa import PlaywrightQAScanner
from app.services.scorer import calculate_category_score
from app.services.prd_agent import analyze_prd_and_generate_tests
from app.services.crawler import AutonomousCrawler
from app.services.notifier import dispatch_webhook

SCANNERS = [
    SecurityHeadersScanner(),
    SSLTLSScanner(),
    ExposureScanner(),
    ErrorHandlingScanner(),
    TechnologyScanner(),
    BasicUXScanner(),
    BrokenLinksScanner(),
    FormsA11yScanner(),
    PlaywrightQAScanner(),
]

def classify_finding_rca_and_team(finding: Finding) -> None:
    """
    TestSprite & Virgosol Enterprise Root Cause Analysis (RCA) & Triage Engine.
    Ensures 100% of findings are categorized into the 4 RCA tiers with assigned team:
    - REAL_BUG: Frontend/Backend Application Developers (Dev Team)
    - ENV_ISSUE: DevOps / System Administrators / Network Ops (Infra Team)
    - TEST_FRAGILITY: QA Engineers & Test Automation Engineers (QA Team)
    - EXPECTED_BEHAVIOR: Product Management & Informational Review (Product Team)
    """
    fid = finding.id.upper()

    # 1. RCA Category Auto-Assignment
    if not finding.rca_category:
        if any(k in fid for k in ("HEADER", "HSTS", "CSP", "NOSNIFF", "REFERRER", "PERMISSIONS", "SERVER_INFO", "SSL", "TLS", "CERT", "ENCRYPTION", "EXPOSURE", "ROBOTS", "UNREACHABLE", "HTTP3", "TECH", "BROKEN_ASSET", "CORS")):
            finding.rca_category = RCACategory.ENV_ISSUE
        elif any(k in fid for k in ("FRAGILITY", "HEALING", "TIMEOUT", "FLAKY")):
            finding.rca_category = RCACategory.TEST_FRAGILITY
        elif any(k in fid for k in ("SUITE", "SUMMARY", "INFO", "WATERFALL")):
            finding.rca_category = RCACategory.EXPECTED_BEHAVIOR
        else:
            finding.rca_category = RCACategory.REAL_BUG

    # 2. Team Assignment (Virgosol Enterprise Triage)
    if not finding.team_assignment:
        if finding.compliance_standard:
            finding.team_assignment = "Hukuk & Uyum Ekibi (DPO / Compliance)"
        elif finding.rca_category == RCACategory.ENV_ISSUE:
            finding.team_assignment = "DevOps & Sistem Yöneticisi (Infra/SecOps)"
        elif finding.rca_category == RCACategory.TEST_FRAGILITY:
            finding.team_assignment = "QA & Test Mühendisliği (Auto-Heal QA)"
        elif finding.rca_category == RCACategory.EXPECTED_BEHAVIOR:
            finding.team_assignment = "Ürün & Güvenlik Analisti (Review)"
        else:
            finding.team_assignment = "Yazılım Geliştirici (Frontend / Backend)"

    # 3. Root Cause Hypothesis
    if not finding.root_cause_hypothesis:
        if finding.rca_category == RCACategory.ENV_ISSUE:
            finding.root_cause_hypothesis = (
                f"Web sunucusu veya reverse-proxy yapılandırmasında (Nginx/Apache/Cloudflare) "
                f"ilgili güvenlik direktifi, HTTP başlığı veya TLS ayarı tanımlanmamış."
            )
        elif finding.rca_category == RCACategory.REAL_BUG:
            finding.root_cause_hypothesis = (
                f"Uygulama kaynak kodunda veya bileşen şablonunda beklenen veri doğrulama, "
                f"sanitizasyon veya UI bileşen standardı eksik."
            )
        elif finding.rca_category == RCACategory.TEST_FRAGILITY:
            finding.root_cause_hypothesis = (
                f"Test otomasyon seçicisi veya zamanlama mekanizması dinamik DOM render döngülerine karşı kırılgan."
            )
        else:
            finding.root_cause_hypothesis = (
                f"Sistemin standart çalışma parametreleri dahilinde gözlemlenen teyit edilmiş operasyonel durum."
            )


async def execute_scan(
    target_url: str,
    prd_content: Optional[str] = None,
    webhook_url: Optional[str] = None,
    enable_crawler: bool = True,
    max_pages: int = 5,
    crawl_depth: int = 2,
    sector: Optional[SectorType] = SectorType.AUTO,
) -> ScanResult:
    scan_id = str(uuid.uuid4())
    started_at = datetime.utcnow()
    
    try:
        sanitized_url = validate_and_sanitize_target_url(target_url)
    except Exception as exc:
        return ScanResult(
            scan_id=scan_id,
            target_url=target_url,
            status=ScanStatus.FAILED,
            error_message=str(exc),
            selected_sector=sector or SectorType.AUTO,
            started_at=started_at,
            completed_at=datetime.utcnow()
        )

    prd_analysis = None
    if prd_content and prd_content.strip():
        try:
            prd_analysis = await analyze_prd_and_generate_tests(prd_content, sanitized_url)
        except Exception as exc:
            import logging
            logging.error(f"[Crawler Error] Failed to crawl {sanitized_url}: {exc}", exc_info=True)

    compliance_scanner = ComplianceScanner(requested_sector=sector or SectorType.AUTO)

    headers = {"User-Agent": settings.USER_AGENT}
    async with httpx.AsyncClient(
        headers=headers,
        timeout=settings.REQUEST_TIMEOUT_SECONDS,
        follow_redirects=True,
        verify=False
    ) as client:
        active_scanners = SCANNERS + [compliance_scanner]
        scan_coroutines = [scanner.scan(sanitized_url, client) for scanner in active_scanners]
        scanner_results = await asyncio.gather(*scan_coroutines, return_exceptions=True)

    all_findings: list[Finding] = []
    for res in scanner_results:
        if isinstance(res, list):
            all_findings.extend(res)

    network_traces = []
    for scanner in active_scanners:
        if hasattr(scanner, "network_traces") and scanner.network_traces:
            network_traces.extend(scanner.network_traces)

    self_healing_events = []
    for scanner in active_scanners:
        if hasattr(scanner, "self_healing_events") and scanner.self_healing_events:
            self_healing_events.extend(scanner.self_healing_events)

    crawl_graph = None
    crawled_pages_count = 1
    if enable_crawler:
        try:
            crawler = AutonomousCrawler()
            crawl_nodes, crawler_findings = await crawler.crawl_and_explore(
                sanitized_url,
                max_pages=max_pages,
                max_depth=crawl_depth
            )
            crawl_graph = crawl_nodes
            crawled_pages_count = len(crawl_nodes)
            all_findings.extend(crawler_findings)
        except Exception as exc:
            import logging
            logging.error(f"[Crawler Error] Failed to crawl {sanitized_url}: {exc}", exc_info=True)

    security_score = calculate_category_score(all_findings, Category.SECURITY)
    ux_score = calculate_category_score(all_findings, Category.UX)

    # Sektörel Uyumluluk Skoru Hesabı
    comp_findings = [f for f in all_findings if f.compliance_standard]
    comp_deduction = 0
    for f in comp_findings:
        if f.severity == Severity.CRITICAL:
            comp_deduction += 25
        elif f.severity == Severity.HIGH:
            comp_deduction += 15
        elif f.severity == Severity.MEDIUM:
            comp_deduction += 8
        elif f.severity == Severity.LOW:
            comp_deduction += 3
    compliance_score = max(0, 100 - comp_deduction)

    detected_sector = compliance_scanner.detected_sector or SectorType.GENERAL

    # Ensure 100% Full-Spectrum RCA & Team Assignment for all findings
    rca_counts = {
        RCACategory.REAL_BUG.value: 0,
        RCACategory.ENV_ISSUE.value: 0,
        RCACategory.TEST_FRAGILITY.value: 0,
        RCACategory.EXPECTED_BEHAVIOR.value: 0,
    }
    for f in all_findings:
        classify_finding_rca_and_team(f)
        k = f.rca_category.value if hasattr(f.rca_category, "value") else str(f.rca_category)
        rca_counts[k] = rca_counts.get(k, 0) + 1

    # TestSuite Resilience & Flakiness Resistance Calculation
    fragile_findings = [f for f in all_findings if f.rca_category == RCACategory.TEST_FRAGILITY]
    resilience_score = max(55, 100 - (len(fragile_findings) * 6))

    result = ScanResult(
        scan_id=scan_id,
        target_url=sanitized_url,
        status=ScanStatus.COMPLETED,
        security_score=security_score,
        ux_score=ux_score,
        compliance_score=compliance_score,
        resilience_score=resilience_score,
        selected_sector=sector or SectorType.AUTO,
        detected_sector=detected_sector,
        findings=all_findings,
        rca_summary=rca_counts,
        network_traces=network_traces,
        prd_analysis=prd_analysis,
        self_healing_events=self_healing_events,
        crawl_graph=crawl_graph,
        crawled_pages_count=crawled_pages_count,
        started_at=started_at,
        completed_at=datetime.utcnow()
    )

    if webhook_url:
        try:
            asyncio.create_task(dispatch_webhook(webhook_url, result))
        except Exception as exc:
            import logging
            logging.error(f"[Crawler Error] Failed to crawl {sanitized_url}: {exc}", exc_info=True)

    return result
