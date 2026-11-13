import asyncio
from datetime import datetime
from typing import Optional
import uuid
import httpx
from app.core.config import settings
from app.core.security import validate_and_sanitize_target_url
from app.models.schema import (
    Finding, ScanResult, ScanStatus, Category, SectorType, Severity, RCACategory,
    AuditMode, UserPersona, PersonaAuditReport
)
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
from app.services.performance_tester import PerformanceBenchmarkEngine
from app.services.live_screencast import live_hub
from app.services.codebase_intelligence import CodebaseIntelligenceEngine
from app.services.waf_leakage_prober import WAFLeakageProbingEngine
from app.services.chaos_engine import ChaosFaultInjectionEngine
from app.services.rate_limit_auditor import RateLimitingAuditor
from app.services.responsive_auditor import ResponsiveLayoutAuditor
from app.services.api_contract_auditor import APIContractDriftAuditor
from app.services.dast_verifier import DASTExploitVerifier
from app.services.session_heatmap_engine import SessionHeatmapEngine
from app.services.database_leak_prober import DatabaseLeakSlowQueryProber
from app.services.localization_auditor import LocalizationI18nAuditor
from app.services.memory_leak_profiler import MemoryLeakProfilerEngine
from app.services.third_party_security_auditor import ThirdPartySecurityAuditor
from app.services.tls_crypto_auditor import TLSCryptoAuditor
from app.services.incident_dispatcher import IncidentDispatcherHub
from app.services.seo_structured_data_auditor import SEOStructuredDataAuditor

SCANNERS = [
    SecurityHeadersScanner(),
    SSLTLSScanner(),
    ExposureScanner(),
    ErrorHandlingScanner(),
    TechnologyScanner(),
    BasicUXScanner(),
    BrokenLinksScanner(),
    FormsA11yScanner(),
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
    audit_mode: Optional[AuditMode] = AuditMode.UX_PERSONA,
    persona: Optional[UserPersona] = UserPersona.SHOPPER,
) -> ScanResult:
    scan_id = str(uuid.uuid4())
    started_at = datetime.utcnow()
    
    try:
        sanitized_url = validate_and_sanitize_target_url(target_url)
        live_hub.start_session(sanitized_url)
    except Exception as exc:
        return ScanResult(
            scan_id=scan_id,
            target_url=target_url,
            status=ScanStatus.FAILED,
            error_message=str(exc),
            selected_sector=sector or SectorType.AUTO,
            audit_mode=audit_mode or AuditMode.UX_PERSONA,
            persona=persona or UserPersona.SHOPPER,
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
    qa_scanner = PlaywrightQAScanner(persona=persona or UserPersona.SHOPPER)

    headers = {"User-Agent": settings.USER_AGENT}
    perf_metrics = None
    async with httpx.AsyncClient(
        headers=headers,
        timeout=settings.REQUEST_TIMEOUT_SECONDS,
        follow_redirects=True,
        verify=False
    ) as client:
        active_scanners = SCANNERS + [qa_scanner, compliance_scanner]
        scan_coroutines = [scanner.scan(sanitized_url, client) for scanner in active_scanners]
        scanner_results = await asyncio.gather(*scan_coroutines, return_exceptions=True)

        # Virgosol Yük, Stres ve Latency SLA Benchmark Motoru
        try:
            live_hub.record_action("Performans ve Core Web Vitals SLA yük testi yürütülüyor", action_type="JOURNEY", target="perf_engine")
            perf_engine = PerformanceBenchmarkEngine(concurrency=5, total_requests=10)
            perf_metrics, perf_findings = await perf_engine.benchmark(sanitized_url, client=client)
        except Exception as exc:
            perf_findings = []
            import logging
            logging.error(f"[Performance Benchmark Error] Failed on {sanitized_url}: {exc}")

        # Virgosol WAF ve Hata Sızıntısı Direnç Testi Motoru
        waf_report = None
        try:
            live_hub.record_action("WAF ve Hata Sızıntısı güvenlik direnç canarileri test ediliyor", action_type="GATE", target="waf_engine")
            waf_engine = WAFLeakageProbingEngine(concurrency=4)
            waf_report, waf_findings = await waf_engine.audit_waf_and_error_leakage(sanitized_url, client=client)
        except Exception as exc:
            waf_findings = []
            import logging
            logging.error(f"[WAF Probing Error] Failed on {sanitized_url}: {exc}")

        # Virgosol Hız Sınırı ve Kaba Kuvvet Direnç Testi Motoru (Rate-Limiting & Brute-Force Auditor)
        rate_limit_report = None
        rate_limit_findings = []
        try:
            live_hub.record_action("Rate-limiting ve kaba kuvvet direnç analizi (15 burst) yapılıyor", action_type="GATE", target="rate_limiter")
            rate_auditor = RateLimitingAuditor(burst_count=15)
            rate_limit_report, rate_limit_findings = await rate_auditor.audit_rate_limiting(sanitized_url, client=client)
        except Exception as exc:
            import logging
            logging.error(f"[Rate Limiting Audit Error] Failed on {sanitized_url}: {exc}")

        # Virgosol & WCAG Çoklu Cihaz ve Duyarlı Tasarım Denetçisi (Multi-Viewport & Responsive Auditor)
        multi_viewport_report = None
        resp_findings = []
        try:
            live_hub.record_action("Çoklu cihaz ve duyarlı tasarım (Responsive) uyumluluğu taranıyor", action_type="SCROLL", target="viewport_auditor")
            resp_auditor = ResponsiveLayoutAuditor()
            multi_viewport_report, resp_findings = await resp_auditor.audit_multi_viewport(sanitized_url, client=client)
        except Exception as exc:
            import logging
            logging.error(f"[Multi-Viewport Audit Error] Failed on {sanitized_url}: {exc}")

        # Virgosol & OWASP Güvenlik Açığı Otomatik Doğrulama Motoru (DAST Exploit Verification)
        dast_report = None
        dast_findings = []
        try:
            live_hub.record_action("DAST Exploit Verification: XSS, SQLi ve canary enjeksiyonları deneniyor", action_type="GATE", target="dast_verifier")
            dast_verifier = DASTExploitVerifier()
            dast_report, dast_findings = await dast_verifier.verify_vulnerabilities(sanitized_url, client=client)
        except Exception as exc:
            import logging
            logging.error(f"[DAST Verification Error] Failed on {sanitized_url}: {exc}")

    all_findings: list[Finding] = []
    for res in scanner_results:
        if isinstance(res, list):
            all_findings.extend(res)
    all_findings.extend(perf_findings)
    all_findings.extend(waf_findings)
    all_findings.extend(rate_limit_findings)
    all_findings.extend(resp_findings)
    all_findings.extend(dast_findings)

    # Virgosol & TestSprite Kaos Mühendisliği ve Ağ Hata Enjeksiyonu
    chaos_report = None
    try:
        live_hub.record_action("Kaos mühendisliği ve ağ hata enjeksiyonu yürütülüyor", action_type="GATE", target="chaos_engine")
        chaos_engine = ChaosFaultInjectionEngine()
        chaos_report, chaos_findings = await chaos_engine.run_chaos_experiments(sanitized_url)
        all_findings.extend(chaos_findings)
    except Exception as exc:
        import logging
        logging.error(f"[Chaos Engineering Error] Failed on {sanitized_url}: {exc}")

    network_traces = []
    for scanner in active_scanners:
        if hasattr(scanner, "network_traces") and scanner.network_traces:
            network_traces.extend(scanner.network_traces)

    # Virgosol & OWASP API Sözleşme ve Şema Sapması Denetimi (API Contract & Schema Drift)
    api_contract_report = None
    try:
        live_hub.record_action("API sözleşme ve şema sapması analizi yapılıyor", action_type="TYPE", target="api_contract")
        api_auditor = APIContractDriftAuditor()
        api_contract_report, api_contract_findings = await api_auditor.audit_contract_and_drift(
            sanitized_url, network_traces=network_traces
        )
        all_findings.extend(api_contract_findings)
    except Exception as exc:
        import logging
        logging.error(f"[API Contract Audit Error] Failed on {sanitized_url}: {exc}")

    self_healing_events = []
    for scanner in active_scanners:
        if hasattr(scanner, "self_healing_events") and scanner.self_healing_events:
            self_healing_events.extend(scanner.self_healing_events)

    user_journeys = []
    for scanner in active_scanners:
        if hasattr(scanner, "user_journeys") and scanner.user_journeys:
            user_journeys.extend(scanner.user_journeys)

    # Virgosol & Hotjar Kullanıcı Oturum Kaydı ve Isı Haritası Motoru (Session Replay & Heatmap)
    session_replay_report = None
    try:
        live_hub.record_action("Kullanıcı oturumu ve ısı haritası etkileşimleri simüle ediliyor", action_type="SCROLL", target="heatmap_engine")
        heatmap_engine = SessionHeatmapEngine()
        session_replay_report, heatmap_findings = heatmap_engine.analyze_or_generate_session(
            sanitized_url, user_journeys=user_journeys
        )
        all_findings.extend(heatmap_findings)
    except Exception as exc:
        import logging
        logging.error(f"[Session Heatmap Error] Failed on {sanitized_url}: {exc}")

    # Veritabanı ve Yavaş Sorgu Sızıntı Denetimi Motoru (Database Leak & Slow Query Prober)
    db_leak_report = None
    try:
        live_hub.record_action("Veritabanı sızıntısı ve yavaş sorgu probları test ediliyor", action_type="GATE", target="db_prober")
        db_prober = DatabaseLeakSlowQueryProber()
        db_leak_report, db_findings = await db_prober.audit(
            sanitized_url, network_traces=network_traces
        )
        all_findings.extend(db_findings)
    except Exception as exc:
        import logging
        logging.error(f"[Database Leak Prober Error] Failed on {sanitized_url}: {exc}")

    # Virgosol Çok Dilli (i18n) ve Lokalizasyon Kusurları Denetimi (Localization & i18n Auditor)
    l10n_report = None
    try:
        live_hub.record_action("I18n yerelleştirme ve çoklu dil eksiklikleri taranıyor", action_type="TYPE", target="i18n_auditor")
        l10n_auditor = LocalizationI18nAuditor()
        l10n_report, l10n_findings = await l10n_auditor.audit_localization(
            sanitized_url, client=client
        )
        all_findings.extend(l10n_findings)
    except Exception as exc:
        import logging
        logging.error(f"[Localization Audit Error] Failed on {sanitized_url}: {exc}")

    # Virgosol & Chrome DevTools SPA Bellek ve DOM Sızıntı Radarı (Memory & DOM Leak Profiler)
    memory_report = None
    try:
        live_hub.record_action("DOM düğüm sızıntısı ve bellek profili çıkarılıyor", action_type="JOURNEY", target="memory_profiler")
        mem_profiler = MemoryLeakProfilerEngine()
        memory_report, mem_findings = await mem_profiler.audit_memory_leaks(
            sanitized_url, client=client
        )
        all_findings.extend(mem_findings)
    except Exception as exc:
        import logging
        logging.error(f"[Memory Leak Profiler Error] Failed on {sanitized_url}: {exc}")

    # Virgosol & W3C Üçüncü Taraf Script, İzleyici ve CSP Sandbox Denetimi (Third-Party Tracker & CSP Sandbox Auditor)
    third_party_report = None
    try:
        live_hub.record_action("Üçüncü parti bağımlılıklar ve tedarik zinciri güvenliği inceleniyor", action_type="GATE", target="third_party")
        tp_auditor = ThirdPartySecurityAuditor()
        third_party_report, tp_findings = await tp_auditor.audit_third_party_and_csp(
            sanitized_url, client=client, network_traces=network_traces
        )
        all_findings.extend(tp_findings)
    except Exception as exc:
        import logging
        logging.error(f"[Third-Party Security Audit Error] Failed on {sanitized_url}: {exc}")

    # Virgosol & NIST/PCI-DSS SSL/TLS Sertifika Zinciri ve Modern Kriptografi Sağlığı (TLS/SSL Handshake & Cipher Suite Auditor)
    tls_report = None
    try:
        live_hub.record_action("TLS/SSL şifreleme ve kriptografik sertifika sağlığı denetleniyor", action_type="GATE", target="tls_auditor")
        tls_auditor = TLSCryptoAuditor()
        tls_report, tls_findings = await tls_auditor.audit_tls_crypto(
            sanitized_url, client=client
        )
        all_findings.extend(tls_findings)
    except Exception as exc:
        import logging
        logging.error(f"[TLS Crypto Audit Error] Failed on {sanitized_url}: {exc}")

    # Google Search Central & Schema.org / OpenGraph Yapısal Veri Denetleyicisi
    seo_report = None
    try:
        live_hub.record_action("SEO ve OpenGraph yapısal veri etiketleri denetleniyor", action_type="NAVIGATE", target="seo_auditor")
        raw_html = None
        for scanner in active_scanners:
            if hasattr(scanner, "last_html_content") and scanner.last_html_content:
                raw_html = scanner.last_html_content
                break
        seo_report, seo_findings = SEOStructuredDataAuditor.audit(
            sanitized_url, html_content=raw_html
        )
        all_findings.extend(seo_findings)
    except Exception as exc:
        import logging
        logging.error(f"[SEO Structured Data Audit Error] Failed on {sanitized_url}: {exc}")

    # Browser In-Page Core Web Vitals & Loading Speed Metriklerini Entegre Et
    if perf_metrics:
        for scanner in active_scanners:
            if hasattr(scanner, "browser_performance_metrics") and scanner.browser_performance_metrics:
                bpm = scanner.browser_performance_metrics
                perf_metrics.fcp_ms = bpm.get("fcp_ms")
                perf_metrics.lcp_ms = bpm.get("lcp_ms")
                perf_metrics.dom_load_ms = bpm.get("dom_load_ms")
                perf_metrics.window_load_ms = bpm.get("window_load_ms")
                perf_metrics.total_dom_nodes = bpm.get("total_dom_nodes")
                perf_metrics.total_page_size_kb = bpm.get("total_page_size_kb")
                perf_metrics.heavy_resources = bpm.get("heavy_resources")
                break

    crawl_graph = None
    crawled_pages_count = 1
    if enable_crawler:
        try:
            live_hub.record_action(f"Otonom Crawler: {sanitized_url} ve alt dizinleri taranıyor", action_type="NAVIGATE", target="crawler")
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

    # BDDK ve Finansal Mevzuat Skoru Hesabı
    bddk_findings = [f for f in all_findings if "BDDK" in (f.compliance_standard or "") or "BKM" in (f.compliance_standard or "")]
    bddk_deduction = 0
    for f in bddk_findings:
        if f.severity == Severity.CRITICAL:
            bddk_deduction += 35
        elif f.severity == Severity.HIGH:
            bddk_deduction += 20
        elif f.severity == Severity.MEDIUM:
            bddk_deduction += 10
        elif f.severity == Severity.LOW:
            bddk_deduction += 5
    bddk_compliance_score = max(0, 100 - bddk_deduction) if bddk_findings or detected_sector == SectorType.FINTECH_BANKING else None

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

    codebase_report = None
    try:
        codebase_report = CodebaseIntelligenceEngine().analyze()
    except Exception:
        pass

    incident_hub_report = None
    try:
        hub_report, incident_findings = IncidentDispatcherHub.generate_incident_hub(
            target_url=sanitized_url,
            findings=all_findings,
            scan_id=scan_id,
        )
        incident_hub_report = hub_report
        for f in incident_findings:
            classify_finding_rca_and_team(f)
        all_findings.extend(incident_findings)
    except Exception as exc:
        import logging
        logging.error(f"[Incident Hub Error] Failed to generate incident hub: {exc}", exc_info=True)

    result = ScanResult(
        scan_id=scan_id,
        target_url=sanitized_url,
        status=ScanStatus.COMPLETED,
        security_score=security_score,
        ux_score=ux_score,
        compliance_score=compliance_score,
        bddk_compliance_score=bddk_compliance_score,
        resilience_score=resilience_score,
        selected_sector=sector or SectorType.AUTO,
        detected_sector=detected_sector,
        findings=all_findings,
        rca_summary=rca_counts,
        network_traces=network_traces,
        performance_metrics=perf_metrics,
        prd_analysis=prd_analysis,
        self_healing_events=self_healing_events,
        user_journeys=user_journeys,
        crawl_graph=crawl_graph,
        codebase_intelligence=codebase_report,
        waf_resilience=waf_report,
        chaos_resilience=chaos_report,
        rate_limit_resilience=rate_limit_report,
        multi_viewport_report=multi_viewport_report,
        api_contract_drift=api_contract_report,
        dast_verification=dast_report,
        session_replay=session_replay_report,
        database_leak_report=db_leak_report,
        localization_audit=l10n_report,
        memory_leak_report=memory_report,
        third_party_security_report=third_party_report,
        tls_crypto_report=tls_report,
        incident_hub_report=incident_hub_report,
        seo_structured_data_report=seo_report,
        crawled_pages_count=crawled_pages_count,
        audit_mode=audit_mode or AuditMode.UX_PERSONA,
        persona=persona or UserPersona.SHOPPER,
        persona_audit_report=getattr(qa_scanner, "persona_audit_report", None),
        started_at=started_at,
        completed_at=datetime.utcnow()
    )

    try:
        live_hub.end_session("Güvenlik ve UX denetimi tamamlandı.")
    except Exception:
        pass

    if webhook_url:
        try:
            asyncio.create_task(dispatch_webhook(webhook_url, result))
        except Exception as exc:
            import logging
            logging.error(f"[Crawler Error] Failed to crawl {sanitized_url}: {exc}", exc_info=True)

    return result
