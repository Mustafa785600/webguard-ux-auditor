from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"

class Category(str, Enum):
    SECURITY = "SECURITY"
    UX = "UX"

class ScanStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class RCACategory(str, Enum):
    REAL_BUG = "REAL_BUG"
    TEST_FRAGILITY = "TEST_FRAGILITY"
    ENV_ISSUE = "ENV_ISSUE"
    EXPECTED_BEHAVIOR = "EXPECTED_BEHAVIOR"

class SectorType(str, Enum):
    AUTO = "AUTO"
    GENERAL = "GENERAL"
    ECOMMERCE = "ECOMMERCE"
    HEALTHCARE = "HEALTHCARE"
    CORPORATE_GOV = "CORPORATE_GOV"
    SAAS_API = "SAAS_API"
    FINTECH_BANKING = "FINTECH_BANKING"

class NetworkRequestTrace(BaseModel):
    url: str
    method: str
    status: int
    resource_type: str
    duration_ms: float
    size_bytes: Optional[int] = None
    cors_allowed: Optional[bool] = None
    content_type: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    response_body: Optional[str] = None

class Finding(BaseModel):
    id: str
    category: Category
    severity: Severity
    title: str
    description: str
    remediation: str
    evidence: Optional[Dict[str, Any]] = None
    risk_impact: Optional[str] = None
    code_example: Optional[str] = None
    target_location: Optional[str] = None
    line_number: Optional[int] = None
    problematic_code: Optional[str] = None
    # Phase 2: Autonomous interaction evidence
    screenshot_before_b64: Optional[str] = None
    screenshot_after_b64: Optional[str] = None
    interaction_log: Optional[List[str]] = None
    # Phase 2: RCA Classification (TestSprite style)
    rca_category: Optional[RCACategory] = None
    # Multi-page Autonomous Crawler: URL or route where finding was discovered
    page_url: Optional[str] = None
    # Sektörel Uyumluluk ve Yasal Standartlar (PCI-DSS, KVKK, HIPAA, OWASP)
    compliance_standard: Optional[str] = None
    sector_relevance: Optional[List[SectorType]] = None
    # TestSprite Failure Diagnostic Bundle (Öncesi / Sonrası ve Kök Neden Teşhisi)
    reproduction_steps: Optional[List[str]] = None
    dom_snapshot: Optional[str] = None
    root_cause_hypothesis: Optional[str] = None
    # Virgosol & TestSprite Kurumsal Triyaj (Hangi Ekip Çözecek?)
    team_assignment: Optional[str] = None

class CrawlNode(BaseModel):
    url: str
    route: str
    title: Optional[str] = None
    depth: int = 0
    status_code: int = 200
    forms_count: int = 0
    buttons_count: int = 0
    links_found: List[str] = []
    page_issues_count: int = 0
    screenshot_b64: Optional[str] = None
    load_time_ms: Optional[float] = None

class PRDScenario(BaseModel):
    title: str
    role: str
    steps: List[str]
    expected_result: str
    edge_cases: List[str] = []
    scenario_type: str = "POSITIVE"  # "POSITIVE" | "NEGATIVE_SECURITY" | "BOUNDARY"
    security_risk: Optional[str] = None
    abuse_payload: Optional[str] = None
    requirement_id: Optional[str] = None

class PRDTraceabilityItem(BaseModel):
    req_id: str
    requirement: str
    positive_test: str
    security_test: str
    risk_level: str = "MEDIUM"  # "HIGH" | "MEDIUM" | "LOW"
    status: str = "COVERED"     # "COVERED" | "NEEDS_REVIEW"

class PRDAnalysisResponse(BaseModel):
    target_url: str
    summary: str
    user_roles: List[str]
    scenarios: List[PRDScenario]
    security_scenarios_count: int = 0
    coverage_score: int = 100
    traceability_matrix: Optional[List[PRDTraceabilityItem]] = None
    generated_spec_code: str
    generated_at: datetime

class PRDAnalyzeRequest(BaseModel):
    target_url: str = Field(..., example="https://example.com")
    prd_text: str = Field(..., example="Users should be able to register, log in, and browse products.")

class ScanRequest(BaseModel):
    url: str = Field(..., example="https://example.com")
    sector: Optional[SectorType] = SectorType.AUTO
    prd_content: Optional[str] = None
    webhook_url: Optional[str] = None
    enable_crawler: Optional[bool] = False
    max_pages: Optional[int] = 5
    crawl_depth: Optional[int] = 1

class PerformanceMetrics(BaseModel):
    total_requests: int
    concurrency: int
    success_rate: float
    avg_latency_ms: float
    min_latency_ms: float
    p50_latency_ms: float
    p90_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    max_latency_ms: float
    throughput_req_per_sec: float
    sla_status: str  # "EXCELLENT" | "ACCEPTABLE" | "BREACH"
    status_codes: Dict[int, int] = {}
    samples: List[float] = []
    ttfb_ms: Optional[float] = None
    fcp_ms: Optional[float] = None
    lcp_ms: Optional[float] = None
    dom_load_ms: Optional[float] = None
    window_load_ms: Optional[float] = None
    total_dom_nodes: Optional[int] = None
    total_page_size_kb: Optional[float] = None
    heavy_resources: Optional[List[Dict[str, Any]]] = None

class ScanResult(BaseModel):
    scan_id: str
    target_url: str
    status: ScanStatus
    security_score: int = 100
    ux_score: int = 100
    compliance_score: int = 100
    resilience_score: int = 95
    bddk_compliance_score: Optional[int] = None
    selected_sector: Optional[SectorType] = SectorType.AUTO
    detected_sector: Optional[SectorType] = None
    findings: List[Finding] = []
    rca_summary: Optional[Dict[str, int]] = None
    network_traces: List[NetworkRequestTrace] = []
    performance_metrics: Optional[PerformanceMetrics] = None
    prd_analysis: Optional[PRDAnalysisResponse] = None
    self_healing_events: Optional[List[Dict[str, Any]]] = None
    user_journeys: Optional[List[Dict[str, Any]]] = None
    crawl_graph: Optional[List[CrawlNode]] = None
    codebase_intelligence: Optional['CodebaseIntelligenceReport'] = None
    waf_resilience: Optional['WAFResilienceReport'] = None
    chaos_resilience: Optional['ChaosResilienceReport'] = None
    rate_limit_resilience: Optional['RateLimitResilienceReport'] = None
    multi_viewport_report: Optional['MultiViewportReport'] = None
    api_contract_drift: Optional['APIContractDriftReport'] = None
    dast_verification: Optional['DASTVerificationReport'] = None
    session_replay: Optional['SessionReplayReport'] = None
    database_leak_report: Optional['DatabaseLeakReport'] = None
    localization_audit: Optional['LocalizationAuditReport'] = None
    memory_leak_report: Optional['MemoryLeakReport'] = None
    crawled_pages_count: int = 1
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

# ── TestSprite Otonom E2E Auto-Heal & Flaky Test İyileştirici ────────────

class AutoHealRepair(BaseModel):
    original: str
    healed: str
    strategy: str
    confidence: float
    line_number: Optional[int] = None
    flakiness_cause: Optional[str] = None

class AutoHealRequest(BaseModel):
    script_code: str = Field(..., description="Brittle Playwright / Cypress / E2E test script to auto-heal")
    target_url: Optional[str] = None

class AutoHealResponse(BaseModel):
    original_code: str
    healed_code: str
    repairs: List[AutoHealRepair]
    resilience_score_before: int
    resilience_score_after: int
    flakiness_reduction_pct: int
    healed_at: datetime = Field(default_factory=datetime.utcnow)

# ── Codebase Intelligence & Holistic Architecture Models ─────────────────

class ArchitectureLayer(str, Enum):
    FRONTEND_UI = "FRONTEND_UI"
    API_CONTROLLER = "API_CONTROLLER"
    SERVICE_LOGIC = "SERVICE_LOGIC"
    SECURITY_GUARD = "SECURITY_GUARD"
    DATA_MODEL = "DATA_MODEL"
    INFRA_CONFIG = "INFRA_CONFIG"

class CodeSymbolNode(BaseModel):
    id: str
    name: str
    file_path: str
    symbol_type: str  # class, function, async_function, component, route, interface
    layer: ArchitectureLayer
    purpose_summary: str
    line_start: int
    line_end: int
    docstring: Optional[str] = None
    decorators: List[str] = []
    http_method: Optional[str] = None
    http_route: Optional[str] = None
    calls: List[str] = []
    called_by: List[str] = []
    blast_radius_score: int = 1

class CodebaseConnectionEdge(BaseModel):
    source_id: str
    target_id: str
    connection_type: str  # CALLS, IMPORTS, HTTP_REQUEST, INSTANTIATES, DEPENDS_ON
    description: str

class FullStackFlow(BaseModel):
    id: str
    flow_name: str
    entry_point: str
    api_route: str
    service_pipeline: List[str] = []
    model_schema: str
    description: str

class CodebaseIntelligenceReport(BaseModel):
    total_files: int
    total_lines_of_code: int
    total_symbols: int
    symbols: List[CodeSymbolNode] = []
    edges: List[CodebaseConnectionEdge] = []
    full_stack_flows: List[FullStackFlow] = []
    layer_distribution: Dict[str, int] = {}
    architectural_health_score: int = 100
    detected_frameworks: List[str] = []
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)

# ── WAF ve Hata Sızıntısı Direnç Modelleri (Virgosol Enterprise) ──────────

class WAFProbeStatus(str, Enum):
    BLOCKED_BY_WAF = "BLOCKED_BY_WAF"          # WAF isteği 400/403 ile kibarca engelledi (Güvenli)
    HANDLED_CLEANLY = "HANDLED_CLEANLY"        # Uygulama girdiyi süzüp temiz hata döndü (Güvenli)
    UNHANDLED_500_CRASH = "UNHANDLED_500_CRASH"# Sunucu 500/502 verdi, çöküş yaşandı (Kusur)
    STACK_TRACE_LEAK = "STACK_TRACE_LEAK"      # Stack trace, veritabanı veya dosya yolu sızdı (Kritik Zafiyet)

class WAFProbeResult(BaseModel):
    category: str  # SQLi, XSS, Path Traversal, Command Injection, Buffer/Header, Malformed JSON
    probe_name: str
    target_vector: str  # Query Param, HTTP Header, Body, Path
    payload_sample: str
    status_code: int
    probe_status: WAFProbeStatus
    detected_leakage: Optional[str] = None
    waf_signature_matched: Optional[str] = None
    response_time_ms: float

class WAFResilienceReport(BaseModel):
    waf_detected: bool
    waf_vendor: str  # Cloudflare, AWS WAF, Akamai, ModSecurity, F5 BIG-IP, No WAF
    waf_protection_score: int = 100  # 0 - 100
    total_probes_executed: int
    probes_blocked_by_waf: int
    probes_handled_cleanly: int
    unhandled_500_crashes: int
    stack_trace_leaks: int
    probe_results: List[WAFProbeResult] = []
    audited_at: datetime = Field(default_factory=datetime.utcnow)

# ── Kaos Mühendisliği ve Ağ Hata Enjeksiyonu Modelleri (Chaos Engineering) ─

class ChaosFaultType(str, Enum):
    API_500_SERVER_ERROR = "API_500_SERVER_ERROR"          # Enjekte edilen HTTP 500 hatası
    API_LATENCY_SPIKE = "API_LATENCY_SPIKE"                # 3500ms yüksek gecikme simülasyonu
    NETWORK_CONNECTION_ABORT = "NETWORK_CONNECTION_ABORT"  # Ağ kesintisi / zaman aşımı (abort)
    MALFORMED_JSON_PAYLOAD = "MALFORMED_JSON_PAYLOAD"      # Bozuk / eksik JSON yanıtı enjeksiyonu
    SLOW_3G_THROTTLING = "SLOW_3G_THROTTLING"              # Düşük bant genişliği simülasyonu

class ChaosVerdict(str, Enum):
    RESILIENT = "RESILIENT"                          # Uygulama şık hata veya loading gösterdi (Pass)
    DEGRADED = "DEGRADED"                            # Kısmi UI bozulması ama çökmedi (Acceptable)
    CRASH_UNHANDLED = "CRASH_UNHANDLED"              # JS hatası veya unhandled exception (Fail)
    WHITE_SCREEN_OF_DEATH = "WHITE_SCREEN_OF_DEATH"  # Beyaz ekran çöküşü (Critical Fail)

class ChaosExperimentResult(BaseModel):
    experiment_id: str
    name: str
    fault_type: ChaosFaultType
    target_pattern: str
    injected_fault_description: str
    ui_reaction: str
    verdict: ChaosVerdict
    js_exceptions: List[str] = []
    white_screen_detected: bool = False
    duration_ms: float

class ChaosResilienceReport(BaseModel):
    chaos_resilience_score: int = 100  # 0 - 100
    total_experiments: int
    resilient_experiments: int
    degraded_experiments: int
    crashed_experiments: int
    white_screens_count: int
    experiments: List[ChaosExperimentResult] = []
    audited_at: datetime = Field(default_factory=datetime.utcnow)

# ── Hız Sınırı ve Kaba Kuvvet Direnci Modelleri (Rate Limiting Resilience) ──

class RateLimitStatus(str, Enum):
    ENFORCED_HTTP_429 = "ENFORCED_HTTP_429"          # HTTP 429 Too Many Requests başarıyla uygulandı (Mükemmel)
    ENFORCED_ACCOUNT_LOCK = "ENFORCED_ACCOUNT_LOCK"  # Hesap kilitleme / geçici IP kısıtlaması uygulandı
    PARTIAL_DELAY = "PARTIAL_DELAY"                  # Gecikme artırıldı (Tarpit)
    NOT_ENFORCED = "NOT_ENFORCED"                    # Hız sınırı yok, kaba kuvvete açık (Zafiyet)

class RateLimitProbeAttempt(BaseModel):
    attempt_number: int
    status_code: int
    latency_ms: float
    rate_limit_remaining: Optional[int] = None
    retry_after_seconds: Optional[int] = None
    throttled: bool = False

class RateLimitResilienceReport(BaseModel):
    rate_limiting_detected: bool
    status: RateLimitStatus
    resilience_score: int = 100  # 0 - 100
    tested_endpoint: str
    total_burst_requests: int
    throttled_at_attempt: Optional[int] = None
    http_429_received: bool
    retry_after_header_present: bool
    rate_limit_headers: Dict[str, str] = {}
    attempts: List[RateLimitProbeAttempt] = []
    compliance_frameworks: List[str] = ["OWASP API4:2023", "BDDK Madde 34", "PCI-DSS 8.3.4"]
    audited_at: datetime = Field(default_factory=datetime.utcnow)

# ── Çoklu Cihaz ve Duyarlı Tasarım Modelleri (Multi-Viewport & Responsive Layout) ──

class DeviceProfile(str, Enum):
    MOBILE = "MOBILE"        # Akıllı Telefon (390 x 844)
    TABLET = "TABLET"        # Tablet (768 x 1024)
    DESKTOP = "DESKTOP"      # Masaüstü HD (1920 x 1080)

class ResponsiveDefectType(str, Enum):
    HORIZONTAL_OVERFLOW = "HORIZONTAL_OVERFLOW"            # Yatay kaydırma çubuğu taşması
    TOUCH_TARGET_TOO_SMALL = "TOUCH_TARGET_TOO_SMALL"      # Dokunma hedefi boyutu < 44x44px (WCAG 2.5.5)
    ILLEGIBLE_FONT_SIZE = "ILLEGIBLE_FONT_SIZE"            # Okunamayacak kadar küçük yazı (< 12px)
    VIEWPORT_META_MISSING = "VIEWPORT_META_MISSING"        # <meta name="viewport"> etiketi eksik
    PINCH_TO_ZOOM_BLOCKED = "PINCH_TO_ZOOM_BLOCKED"        # user-scalable=no ile yakınlaştırma engellenmiş
    CONTENT_CLIPPED = "CONTENT_CLIPPED"                    # Metin veya içerik kırpılmış

class ResponsiveDefectItem(BaseModel):
    defect_type: ResponsiveDefectType
    severity: Severity
    description: str
    selector: Optional[str] = None
    bounding_box: Optional[Dict[str, float]] = None
    computed_value: Optional[str] = None
    recommended_fix: str

class ViewportAuditResult(BaseModel):
    device: DeviceProfile
    device_label: str
    width: int
    height: int
    scale_factor: float = 1.0
    is_mobile: bool
    has_touch: bool
    score: int = 100  # 0 - 100
    horizontal_overflow_px: int = 0
    total_touch_targets_checked: int = 0
    small_touch_targets_count: int = 0
    small_fonts_count: int = 0
    screenshot_b64: Optional[str] = None
    defects: List[ResponsiveDefectItem] = []

class MultiViewportReport(BaseModel):
    overall_responsive_score: int = 100  # 0 - 100
    meta_viewport_tag_found: bool = True
    meta_viewport_content: Optional[str] = None
    pinch_to_zoom_allowed: bool = True
    total_defects: int = 0
    tested_viewports: List[ViewportAuditResult] = []
    compliance_standards: List[str] = [
        "WCAG 2.1 Reflow (1.4.10)",
        "WCAG 2.5.5 Target Size (44x44px)",
        "Google Mobile-Friendly Standards",
        "Apple iOS HIG & Android Touch Targets"
    ]
    audited_at: datetime = Field(default_factory=datetime.utcnow)

# ── API Sözleşme ve Şema Sapması Modelleri (API Contract & Schema Drift) ──

class SchemaDriftType(str, Enum):
    TYPE_MISMATCH = "TYPE_MISMATCH"                      # Beklenen veri tipi ile gerçek tip uyuşmazlığı
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"    # Şemada zorunlu tanımlanan alan yanıtta eksik
    UNEXPECTED_FIELD = "UNEXPECTED_FIELD"                # Dokümante edilmemiş ekstra alan
    STATUS_CODE_UNSPECIFIED = "STATUS_CODE_UNSPECIFIED"  # Şartnamede tanımlanmamış HTTP yanıt kodu
    UNDOCUMENTED_SHADOW_API = "UNDOCUMENTED_SHADOW_API"  # Şartnamede yer almayan gölge API çağrısı
    DEPRECATED_ENDPOINT_ACTIVE = "DEPRECATED_ENDPOINT_ACTIVE"  # Kullanımdan kaldırılmış (deprecated) uç noktaya istek

class SchemaDriftItem(BaseModel):
    endpoint: str
    method: str
    drift_type: SchemaDriftType
    severity: Severity
    field_path: Optional[str] = None
    expected_contract: str
    actual_runtime: str
    description: str
    recommended_fix: str

class APIEndpointContract(BaseModel):
    path: str
    method: str
    summary: Optional[str] = None
    documented_in_spec: bool = True
    runtime_status_code: Optional[int] = None
    is_deprecated: bool = False
    drift_count: int = 0

class APIContractDriftReport(BaseModel):
    contract_compatibility_score: int = 100  # 0 - 100
    spec_detected: bool = False
    spec_url: Optional[str] = None
    spec_title: Optional[str] = None
    spec_version: Optional[str] = None
    total_endpoints_evaluated: int = 0
    documented_endpoints_count: int = 0
    shadow_endpoints_count: int = 0
    total_drifts_detected: int = 0
    endpoints: List[APIEndpointContract] = []
    drifts: List[SchemaDriftItem] = []
    compliance_frameworks: List[str] = [
        "OpenAPI 3.0 / 3.1 Specification",
        "OWASP API8:2023 Lack of Protection from Improper Asset Management",
        "OWASP API9:2023 Improper Inventory Management",
        "JSON Schema Core Draft 2020-12"
    ]
    audited_at: datetime = Field(default_factory=datetime.utcnow)

# ── Güvenlik Açığı Otomatik Doğrulama Modelleri (DAST Verification & False-Positive Elimination) ──

class DASTVerificationStatus(str, Enum):
    CONFIRMED = "CONFIRMED"                              # Güvenlik açığı sentetik kanarya ile kesin doğrulandı (Gerçek Zafiyet)
    POTENTIAL_RISK = "POTENTIAL_RISK"                    # Şüpheli davranış / kısmi yansıma (Potansiyel Risk)
    SAFE_OR_FALSE_POSITIVE = "SAFE_OR_FALSE_POSITIVE"    # Yanlış pozitif / sistem tarafından güvenli şekilde reddedildi

class DASTTestCategory(str, Enum):
    REFLECTED_INPUT_SANITIZATION = "REFLECTED_INPUT_SANITIZATION"    # Girdi filtreleme ve XSS yansıma teyidi
    SENSITIVE_EXPOSURE = "SENSITIVE_EXPOSURE"                        # Hassas yapılandırma / kaynak dosyası ifşası (.env, .git)
    CORS_MISCONFIGURATION = "CORS_MISCONFIGURATION"                  # Güvensiz CORS ve yetkisiz Origin yansıması
    OPEN_REDIRECT = "OPEN_REDIRECT"                                  # Açık yönlendirme (Open Redirect) doğrulaması
    SSRF_FILTER_RESILIENCE = "SSRF_FILTER_RESILIENCE"                # Sunucu taraflı istek sahteciliği (SSRF) filtre direnci

class DASTVerificationItem(BaseModel):
    test_id: str
    category: DASTTestCategory
    test_name: str
    target_endpoint: str
    parameter_tested: Optional[str] = None
    verification_status: DASTVerificationStatus
    severity: Severity
    canary_payload: str
    evidence_response_snippet: Optional[str] = None
    confidence_percentage: int = 100  # 0 - 100
    description: str
    remediation: str

class DASTVerificationReport(BaseModel):
    dast_confidence_score: int = 100  # 0 - 100 (100 = hiç teyit edilmiş zafiyet yok, sistem temiz)
    total_tests_executed: int = 0
    confirmed_vulnerabilities_count: int = 0
    potential_risks_count: int = 0
    false_positives_filtered_count: int = 0
    verifications: List[DASTVerificationItem] = []
    compliance_standards: List[str] = [
        "OWASP Top 10:2021 (A01 Broken Access Control, A03 Injection, A05 Security Misconfiguration)",
        "CWE-79 Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')",
        "CWE-200 Exposure of Sensitive Information to an Unauthorized Actor",
        "CWE-918 Server-Side Request Forgery (SSRF)",
        "CWE-601 URL Redirection to Untrusted Site ('Open Redirect')"
    ]
    audited_at: datetime = Field(default_factory=datetime.utcnow)

# ── Kullanıcı Oturum Kaydı & Isı Haritası Modelleri (Session Replay & Heatmap) ──

class SessionEventType(str, Enum):
    CLICK = "CLICK"                      # Normal tıklama
    RAGE_CLICK = "RAGE_CLICK"            # Kızgın tıklama (kullanıcının aynı noktaya üst üste tıklaması)
    DEAD_CLICK = "DEAD_CLICK"            # Ölü tıklama (etkileşimsiz öğeye tıklama)
    SCROLL = "SCROLL"                    # Kaydırma olayı
    MOUSE_MOVE = "MOUSE_MOVE"            # Fare hareketi
    NAVIGATION = "NAVIGATION"            # Sayfa geçişi
    INPUT_MASKED = "INPUT_MASKED"        # KVKK/GDPR uyumlu maskeli veri girişi

class SessionEvent(BaseModel):
    timestamp_ms: int
    event_type: SessionEventType
    x_pct: float                         # 0.0 - 100.0 (Viewport yüzdesi)
    y_pct: float                         # 0.0 - 100.0
    selector: Optional[str] = None
    element_text: Optional[str] = None
    scroll_depth_pct: Optional[float] = None

class ClickHotspot(BaseModel):
    x_pct: float
    y_pct: float
    intensity: float = 0.5               # 0.1 - 1.0 (Isı yoğunluğu)
    click_count: int = 1
    selector: Optional[str] = None
    element_text: Optional[str] = None
    is_rage_click: bool = False

class ScrollDepthMilestone(BaseModel):
    depth_percentage: int                # 25, 50, 75, 100
    visitors_reached_pct: float          # Bu derinliğe ulaşan kullanıcı yüzdesi (örn: %85)
    avg_time_spent_seconds: float        # Bu bölümde geçirilen ortalama süre

class SessionReplayReport(BaseModel):
    session_id: str
    duration_seconds: float
    total_clicks: int = 0
    rage_clicks_count: int = 0
    dead_clicks_count: int = 0
    max_scroll_depth_pct: float = 100.0
    ux_friction_score: int = 100         # 0 - 100 (100 = Sıfır sürtünme / akıcı UX)
    events: List[SessionEvent] = []
    click_hotspots: List[ClickHotspot] = []
    scroll_milestones: List[ScrollDepthMilestone] = []
    page_screenshot_b64: Optional[str] = None
    compliance_notes: List[str] = [
        "KVKK / GDPR Madde 5 Uyumlu Otomatik Veri Maskeleme",
        "W3C Pointer Events Standardı",
        "WCAG 2.1 Operable - Girdi Mekanizmaları"
    ]
    recorded_at: datetime = Field(default_factory=datetime.utcnow)

# ── Veritabanı ve Yavaş Sorgu Sızıntı Denetimi Modelleri (Database Leak & Slow Query Prober) ──

class DatabaseLeakType(str, Enum):
    SQL_SYNTAX_ERROR = "SQL_SYNTAX_ERROR"          # Yanıtta ham SQL hata mesajı (PostgreSQL, MySQL, SQLite vb.)
    STACK_TRACE_EXPOSURE = "STACK_TRACE_EXPOSURE"  # ORM / DB sürücüsü stack trace ifşası
    CONNECTION_STRING = "CONNECTION_STRING"        # Kimlik bilgisi / bağlantı dizesi sızıntısı (postgres://, mysql://, redis://)
    DATABASE_NAME_LEAK = "DATABASE_NAME_LEAK"      # Tablo, sütun veya şema adı ifşası
    DEBUG_METRIC_LEAK = "DEBUG_METRIC_LEAK"        # X-Debug-Query-Count, X-Database-Time vb. başlık sızıntıları

class SlowQuerySeverity(str, Enum):
    CRITICAL = "CRITICAL"  # > 2500ms
    HIGH = "HIGH"          # > 1500ms
    MEDIUM = "MEDIUM"      # > 800ms
    LOW = "LOW"            # > 400ms

class DatabaseLeakItem(BaseModel):
    leak_type: DatabaseLeakType
    severity: Severity  # CRITICAL, HIGH, MEDIUM, LOW
    endpoint: str
    parameter_or_header: Optional[str] = None
    detected_engine: str  # PostgreSQL, MySQL, SQLite, MSSQL, Oracle, MongoDB, Redis, Unknown
    leak_sample: str      # Sızıntının sansürlü/özet kesiti
    description: str
    remediation: str

class SlowQueryCandidate(BaseModel):
    endpoint: str
    method: str
    observed_latency_ms: float
    status_code: int
    severity: SlowQuerySeverity
    suspected_cause: str  # "N+1 Query Pattern", "Unindexed Table Scan", "Heavy Cartesian Join", "Unbounded Collection Fetch"
    query_pattern_hint: Optional[str] = None
    orm_fix_recommendation: str

class TimeProbeResult(BaseModel):
    endpoint: str
    probe_name: str
    baseline_latency_ms: float
    probed_latency_ms: float
    latency_delta_ms: float
    is_time_delay_suspect: bool
    status: str  # "SAFE", "SUSPICIOUS_DELAY", "TIMED_OUT"
    detail: str

class DatabaseLeakReport(BaseModel):
    db_health_score: int = 100  # 0 - 100
    detected_engines: List[str] = []  # ["PostgreSQL", "Redis"]
    total_leaks_count: int = 0
    slow_queries_count: int = 0
    n_plus_one_suspects_count: int = 0
    leaks: List[DatabaseLeakItem] = []
    slow_queries: List[SlowQueryCandidate] = []
    time_probes: List[TimeProbeResult] = []
    orm_recommendations: List[str] = []
    compliance_standards: List[str] = [
        "OWASP Top 10 A05:2021 Security Misconfiguration",
        "CWE-209: Generation of Error Message Containing Sensitive Information",
        "CWE-200: Exposure of Sensitive Information to an Unauthorized Actor",
        "PCI-DSS v4.0 Requirement 6.4 (Public-facing Web Applications)",
        "BDDK Madde 31 Bilgi Güvenliği ve Sistem Sağlığı"
    ]
    audited_at: datetime = Field(default_factory=datetime.utcnow)

# ── Çok Dilli / i18n & Lokalizasyon Kusurları Denetim Modelleri ──────────────

class LocalizationDefectType(str, Enum):
    UNTRANSLATED_KEY_LEAK = "UNTRANSLATED_KEY_LEAK"          # Çevrilmemiş i18n anahtarı (auth.login.title, common.submit vb.)
    MISSING_LANG_ATTRIBUTE = "MISSING_LANG_ATTRIBUTE"        # <html lang="..."> eksik veya BCP 47 standart dışı
    RTL_BIDI_DEFECT = "RTL_BIDI_DEFECT"                      # Sağdan sola (Arapça vb.) dillerde dir="rtl" eksikliği
    HARDCODED_LOCALE_FORMAT = "HARDCODED_LOCALE_FORMAT"      # Para birimi, tarih veya sayı yerelleştirme kusuru
    HREFLANG_MISCONFIGURATION = "HREFLANG_MISCONFIGURATION"  # hreflang alternatif dil bağıntısı hatası
    TEXT_EXPANSION_OVERFLOW = "TEXT_EXPANSION_OVERFLOW"      # Çeviri metin uzaması sebebiyle arayüzde taşma

class LocalizationDefectItem(BaseModel):
    defect_type: LocalizationDefectType
    severity: Severity  # HIGH, MEDIUM, LOW, INFO
    element_or_selector: Optional[str] = None
    detected_snippet: str
    expected_standard: str
    description: str
    remediation: str

class HreflangEntry(BaseModel):
    locale: str
    url: str
    is_valid: bool = True

class LocalizationAuditReport(BaseModel):
    l10n_score: int = 100  # 0 - 100
    declared_lang: Optional[str] = None
    detected_languages: List[str] = []
    has_rtl_support: bool = False
    untranslated_keys_count: int = 0
    formatting_defects_count: int = 0
    total_defects_count: int = 0
    hreflang_tags: List[HreflangEntry] = []
    defects: List[LocalizationDefectItem] = []
    supported_locales_detected: List[str] = []
    compliance_standards: List[str] = [
        "W3C Internationalization (i18n) Standards",
        "WCAG 2.1 Success Criterion 3.1.1 Language of Page",
        "ISO 639-1 / BCP 47 Language Tags",
        "Google Search Central hreflang Guidelines"
    ]
    audited_at: datetime = Field(default_factory=datetime.utcnow)

# ── SPA Bellek ve DOM Sızıntı Radarı Modelleri (Memory & DOM Leak Profiler) ──

class MemoryLeakType(str, Enum):
    DETACHED_DOM_NODES = "DETACHED_DOM_NODES"               # DOM ağacından silinmiş ama bellekte referansı kalan düğümler
    DANGLING_EVENT_LISTENER = "DANGLING_EVENT_LISTENER"     # useEffect içinde temizlenmemiş (removeEventListener eksik) dinleyiciler
    UNBOUNDED_HEAP_GROWTH = "UNBOUNDED_HEAP_GROWTH"         # Tekrarlı gezinmede JS Heap şişmesi (bloat)
    UNRELEASED_TIMER_INTERVAL = "UNRELEASED_TIMER_INTERVAL" # Temizlenmemiş setInterval / setTimeout
    UNCLEANED_OBSERVER = "UNCLEANED_OBSERVER"               # ResizeObserver, MutationObserver, IntersectionObserver .disconnect() eksik
    GLOBAL_WINDOW_POLLUTION = "GLOBAL_WINDOW_POLLUTION"     # window nesnesine eklenip sızıntı yapan veriler

class DetachedDOMCluster(BaseModel):
    tag_name: str
    class_or_id: Optional[str] = None
    count: int
    retained_size_bytes_est: int
    suspected_component: Optional[str] = None
    description: str

class DanglingListenerItem(BaseModel):
    target_object: str  # "window", "document", "element"
    event_type: str     # "resize", "scroll", "keydown", "message", "storage"
    detected_count: int
    suspected_pattern: str
    remediation_code: str

class JSHeapMetric(BaseModel):
    total_js_heap_size_mb: float
    used_js_heap_size_mb: float
    js_heap_size_limit_mb: float
    heap_utilization_pct: float
    heap_growth_delta_mb: float  # Navigasyon veya eylemler sonrası artış
    growth_rate_status: str      # "HEALTHY", "MODERATE_RISK", "CRITICAL_GROWTH"

class MemoryLeakItem(BaseModel):
    leak_type: MemoryLeakType
    severity: Severity
    title: str
    component_or_symbol: Optional[str] = None
    metric_snippet: str
    impact_explanation: str
    remediation: str
    code_fix_template: Optional[str] = None

class MemoryLeakReport(BaseModel):
    memory_health_score: int = 100       # 0 - 100 (100 = Sıfır sızıntı, optimize heap)
    heap_metrics: JSHeapMetric
    total_leaks_count: int = 0
    detached_dom_nodes_count: int = 0
    dangling_listeners_count: int = 0
    uncleaned_timers_count: int = 0
    detached_clusters: List[DetachedDOMCluster] = []
    dangling_listeners: List[DanglingListenerItem] = []
    leaks: List[MemoryLeakItem] = []
    remediation_recipes: List[str] = []
    compliance_standards: List[str] = [
        "W3C Web Performance & Memory Specification",
        "Chrome DevTools Memory Profiler & Detached DOM Trees",
        "React & Next.js Lifecycle Memory Cleanup Best Practices (RFC 0021)",
        "WCAG 2.1 Principle 4: Robustness (Client-side Crash Prevention)"
    ]
    audited_at: datetime = Field(default_factory=datetime.utcnow)

ScanResult.model_rebuild()


