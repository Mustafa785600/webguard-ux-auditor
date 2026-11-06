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

class PRDAnalysisResponse(BaseModel):
    target_url: str
    summary: str
    user_roles: List[str]
    scenarios: List[PRDScenario]
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

class ScanResult(BaseModel):
    scan_id: str
    target_url: str
    status: ScanStatus
    security_score: int = 100
    ux_score: int = 100
    compliance_score: int = 100
    selected_sector: Optional[SectorType] = SectorType.AUTO
    detected_sector: Optional[SectorType] = None
    findings: List[Finding] = []
    network_traces: List[NetworkRequestTrace] = []
    prd_analysis: Optional[PRDAnalysisResponse] = None
    self_healing_events: Optional[List[Dict[str, Any]]] = None
    crawl_graph: Optional[List[CrawlNode]] = None
    crawled_pages_count: int = 1
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
