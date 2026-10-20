import asyncio
from datetime import datetime
import uuid
import httpx
from app.core.config import settings
from app.core.security import validate_and_sanitize_target_url
from app.models.schema import Finding, ScanResult, ScanStatus, Category
from app.scanners.security.headers import SecurityHeadersScanner
from app.scanners.security.ssl_tls import SSLTLSScanner
from app.scanners.security.exposure import ExposureScanner
from app.scanners.security.technologies import TechnologyScanner
from app.scanners.ux.basic_ux import BasicUXScanner
from app.scanners.ux.links import BrokenLinksScanner
from app.scanners.ux.forms_a11y import FormsA11yScanner
from app.services.scorer import calculate_category_score

SCANNERS = [
    SecurityHeadersScanner(),
    SSLTLSScanner(),
    ExposureScanner(),
    TechnologyScanner(),
    BasicUXScanner(),
    BrokenLinksScanner(),
    FormsA11yScanner(),
]

async def execute_scan(target_url: str) -> ScanResult:
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

    security_score = calculate_category_score(all_findings, Category.SECURITY)
    ux_score = calculate_category_score(all_findings, Category.UX)

    return ScanResult(
        scan_id=scan_id,
        target_url=sanitized_url,
        status=ScanStatus.COMPLETED,
        security_score=security_score,
        ux_score=ux_score,
        findings=all_findings,
        started_at=started_at,
        completed_at=datetime.utcnow()
    )
