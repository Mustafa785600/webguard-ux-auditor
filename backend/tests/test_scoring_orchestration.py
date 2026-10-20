import pytest
from app.models.schema import Finding, Category, Severity
from app.services.scorer import calculate_category_score, SEVERITY_PENALTIES

def test_perfect_score_when_no_findings():
    score = calculate_category_score([], Category.SECURITY)
    assert score == 100

def test_score_deductions_by_severity():
    findings = [
        Finding(id="F1", category=Category.SECURITY, severity=Severity.CRITICAL, title="T", description="", remediation=""),
        Finding(id="F2", category=Category.SECURITY, severity=Severity.HIGH, title="T", description="", remediation=""),
        Finding(id="F3", category=Category.SECURITY, severity=Severity.MEDIUM, title="T", description="", remediation=""),
        Finding(id="F4", category=Category.SECURITY, severity=Severity.LOW, title="T", description="", remediation=""),
        Finding(id="F5", category=Category.SECURITY, severity=Severity.INFO, title="T", description="", remediation=""),
    ]
    # Expected penalty: CRITICAL(35) + HIGH(20) + MEDIUM(10) + LOW(5) + INFO(0) = 70 -> 100 - 70 = 30
    score = calculate_category_score(findings, Category.SECURITY)
    assert score == 30

def test_score_bounded_at_zero():
    findings = [
        Finding(id=f"F{i}", category=Category.SECURITY, severity=Severity.CRITICAL, title="T", description="", remediation="")
        for i in range(5)
    ]
    # 5 * 35 = 175 penalty -> bounded at 0
    score = calculate_category_score(findings, Category.SECURITY)
    assert score == 0

def test_category_isolation_in_scoring():
    findings = [
        Finding(id="SEC1", category=Category.SECURITY, severity=Severity.CRITICAL, title="T", description="", remediation=""),
        Finding(id="UX1", category=Category.UX, severity=Severity.LOW, title="T", description="", remediation=""),
    ]
    sec_score = calculate_category_score(findings, Category.SECURITY)
    ux_score = calculate_category_score(findings, Category.UX)

    assert sec_score == 65 # 100 - 35
    assert ux_score == 95  # 100 - 5
