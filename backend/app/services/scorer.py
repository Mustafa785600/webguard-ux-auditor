from typing import List
from app.models.schema import Finding, Category, Severity

SEVERITY_PENALTIES = {
    Severity.CRITICAL: 35,
    Severity.HIGH: 20,
    Severity.MEDIUM: 10,
    Severity.LOW: 5,
    Severity.INFO: 0,
}

def calculate_category_score(findings: List[Finding], category: Category) -> int:
    category_findings = [f for f in findings if f.category == category]
    total_penalty = sum(SEVERITY_PENALTIES.get(f.severity, 0) for f in category_findings)
    return max(0, 100 - total_penalty)
