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

ScanResult.model_rebuild()


