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

class ScanRequest(BaseModel):
    url: str = Field(..., example="https://example.com")

class ScanResult(BaseModel):
    scan_id: str
    target_url: str
    status: ScanStatus
    security_score: int = 100
    ux_score: int = 100
    findings: List[Finding] = []
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
