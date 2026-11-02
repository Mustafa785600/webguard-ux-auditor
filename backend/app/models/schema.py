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

class ScanRequest(BaseModel):
    url: str = Field(..., example="https://example.com")

class ScanResult(BaseModel):
    scan_id: str
    target_url: str
    status: ScanStatus
    security_score: int = 100
    ux_score: int = 100
    findings: List[Finding] = []
    network_traces: List[NetworkRequestTrace] = []
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
