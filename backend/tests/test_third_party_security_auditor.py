import pytest
from app.services.third_party_security_auditor import ThirdPartySecurityAuditor
from app.models.schema import (
    ThirdPartyCategory,
    Severity,
    Category,
)

@pytest.mark.asyncio
async def test_detect_unvetted_trackers_and_session_recorders():
    """Meta Pixel ve Hotjar gibi oturum kaydedicilerin ve PII risklerinin tespitini test eder."""
    auditor = ThirdPartySecurityAuditor()
    html = """
    <html>
    <head>
        <title>E-Ticaret Mağazası</title>
        <!-- Meta Pixel -->
        <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
        <!-- Hotjar Session Recording -->
        <script src="https://static.hotjar.com/c/hotjar-12345.js"></script>
    </head>
    <body><h1>Ödeme Sayfası</h1></body>
    </html>
    """

    report, findings = await auditor.audit_third_party_and_csp(
        "https://example.com",
        html_content=html,
        headers={"Content-Security-Policy": "default-src 'self'; script-src 'self' https://connect.facebook.net https://static.hotjar.com; object-src 'none'; base-uri 'self';"},
    )

    assert report.trackers_count >= 2
    assert report.session_recording_count >= 1
    assert any(s.category == ThirdPartyCategory.SESSION_RECORDING for s in report.scripts)
    assert any(s.tracker_name == "Meta (Facebook) Pixel" for s in report.scripts)
    assert any(s.pii_leak_risk is True for s in report.scripts)


@pytest.mark.asyncio
async def test_detect_missing_subresource_integrity_sri():
    """Harici CDN kütüphanelerinde eksik SRI (Subresource Integrity) tespitini test eder."""
    auditor = ThirdPartySecurityAuditor()
    html = """
    <html>
    <head>
        <!-- SRI Eksik CDN Kütüphanesi -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
        <!-- SRI Mevcut CDN Kütüphanesi -->
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js" integrity="sha384-xyz123" crossorigin="anonymous"></script>
    </head>
    <body><h1>Dashboard</h1></body>
    </html>
    """

    report, findings = await auditor.audit_third_party_and_csp(
        "https://example.com",
        html_content=html,
        headers={"Content-Security-Policy": "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self';"},
    )

    assert report.missing_sri_count == 1
    assert any(f.id == "FINDING-SEC-MISSING-SRI" for f in findings)
    assert any(s.has_sri is False and "cdnjs" in s.domain for s in report.scripts)
    assert any(s.has_sri is True and "jsdelivr" in s.domain for s in report.scripts)


@pytest.mark.asyncio
async def test_detect_missing_and_weak_csp_header():
    """Eksik CSP ve 'unsafe-inline' içeren zayıf CSP direktiflerinin analizini test eder."""
    auditor = ThirdPartySecurityAuditor()
    html = "<html><body><h1>WebGuard</h1></body></html>"

    # 1. Hiç CSP olmayan durum
    rep_missing, findings_missing = await auditor.audit_third_party_and_csp(
        "https://example.com",
        html_content=html,
        headers={},
    )
    assert rep_missing.csp_configured is False
    assert rep_missing.csp_grade == "F"
    assert any(f.id == "FINDING-SEC-MISSING-CSP" for f in findings_missing)
    assert rep_missing.security_score <= 75

    # 2. Zayıf ve 'unsafe-inline' içeren CSP
    weak_headers = {
        "content-security-policy": "default-src *; script-src 'self' 'unsafe-inline' 'unsafe-eval' *; object-src *;"
    }
    rep_weak, _ = await auditor.audit_third_party_and_csp(
        "https://example.com",
        html_content=html,
        headers=weak_headers,
    )
    assert rep_weak.csp_configured is True
    assert rep_weak.csp_grade in {"C", "F"}
    script_audit = [d for d in rep_weak.csp_directives if d.directive == "script-src"][0]
    assert script_audit.is_secure is False
    assert len(script_audit.warnings) >= 2


@pytest.mark.asyncio
async def test_detect_unconsented_trackers_gdpr_kvkk():
    """Çerez rıza banner'ı (CMP) olmadan izleyici çalıştırılmasının KVKK & GDPR ihlali olarak yakalanmasını test eder."""
    auditor = ThirdPartySecurityAuditor()
    # CMP banner yok ve TikTok Pixel yüklü
    html = """
    <html>
    <head>
        <script src="https://analytics.tiktok.com/i18n/pixel/events.js"></script>
    </head>
    <body><h1>Sosyal Mağaza</h1></body>
    </html>
    """

    report, findings = await auditor.audit_third_party_and_csp(
        "https://example.com",
        html_content=html,
        headers={"Content-Security-Policy": "default-src 'self'; script-src 'self' https://analytics.tiktok.com; object-src 'none'; base-uri 'self';"},
    )

    assert report.consent_status.has_consent_banner is False
    assert report.consent_status.gdpr_kvkk_compliant is False
    assert report.consent_status.unconsented_trackers_count >= 1
    assert any(f.id == "FINDING-COMP-UNCONSENTED-TRACKERS" for f in findings)


@pytest.mark.asyncio
async def test_clean_hardened_site_perfect_score():
    """SRI hash'li CDN, OneTrust CMP ve A+ dereceli CSP'ye sahip kurumsal sitenin 100 tam puan almasını test eder."""
    auditor = ThirdPartySecurityAuditor()
    html = """
    <html>
    <head>
        <title>Kurumsal Portal</title>
        <!-- OneTrust Çerez Rıza Banner'ı -->
        <script src="/js/onetrust.js" id="ot-sdk"></script>
        <!-- SRI ile korunmuş CDN -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/react.production.min.js"
                integrity="sha384-xyzVerified123" crossorigin="anonymous"></script>
    </head>
    <body>
        <main><h1>Güvenli Bankacılık Portalı</h1></main>
    </body>
    </html>
    """

    strict_headers = {
        "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-rAnd0m' https://cdnjs.cloudflare.com; object-src 'none'; base-uri 'self';"
    }

    report, findings = await auditor.audit_third_party_and_csp(
        "https://example.com",
        html_content=html,
        headers=strict_headers,
    )

    assert report.csp_configured is True
    assert report.csp_grade in {"A+", "A"}
    assert report.missing_sri_count == 0
    assert report.consent_status.has_consent_banner is True
    assert report.consent_status.gdpr_kvkk_compliant is True
    assert report.security_score == 100
    assert len(findings) == 0

