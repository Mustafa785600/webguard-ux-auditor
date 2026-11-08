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

ScanResult.model_rebuild()


