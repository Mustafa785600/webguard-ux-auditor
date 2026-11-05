import asyncio
from datetime import datetime
from typing import Optional
import uuid
import httpx
from app.core.config import settings
from app.core.security import validate_and_sanitize_target_url
from app.models.schema import Finding, ScanResult, ScanStatus, Category
from app.scanners.security.headers import SecurityHeadersScanner
from app.scanners.security.ssl_tls import SSLTLSScanner
from app.scanners.security.exposure import ExposureScanner
from app.scanners.security.error_handling import ErrorHandlingScanner
from app.scanners.security.technologies import TechnologyScanner
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

async def execute_scan(
    target_url: str,
    prd_content: Optional[str] = None,
    webhook_url: Optional[str] = None,
    enable_crawler: bool = True,
    max_pages: int = 5,
    crawl_depth: int = 2,
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

    headers = {"User-Agent": settings.USER_AGENT}
    async with httpx.AsyncClient(
        headers=headers,
        timeout=settings.REQUEST_TIMEOUT_SECONDS,
        follow_redirects=True,
        verify=False
    ) as client:
        scan_coroutines = [scanner.scan(sanitized_url, client) for scanner in SCANNERS]
        scanner_results = await asyncio.gather(*scan_coroutines, return_exceptions=True)

    all_findings: list[Finding] = []
    for res in scanner_results:
        if isinstance(res, list):
            all_findings.extend(res)

    network_traces = []
    for scanner in SCANNERS:
        if hasattr(scanner, "network_traces") and scanner.network_traces:
            network_traces.extend(scanner.network_traces)

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

    result = ScanResult(
        scan_id=scan_id,
        target_url=sanitized_url,
        status=ScanStatus.COMPLETED,
        security_score=security_score,
        ux_score=ux_score,
        findings=all_findings,
        network_traces=network_traces,
        prd_analysis=prd_analysis,
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
