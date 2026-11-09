import pytest
import httpx
from app.services.localization_auditor import LocalizationI18nAuditor
from app.models.schema import (
    LocalizationDefectType,
    Severity,
    Category,
)

@pytest.mark.asyncio
async def test_detect_missing_html_lang_attribute():
    """HTML lang özniteliğinin eksik olması durumunu (WCAG 3.1.1) test eder."""
    auditor = LocalizationI18nAuditor()
    html = "<html><head><title>Test</title></head><body><h1>Merhaba Dünya</h1></body></html>"

    report, findings = await auditor.audit_localization("https://test.local", html_content=html)
    assert report.total_defects_count >= 1
    assert any(d.defect_type == LocalizationDefectType.MISSING_LANG_ATTRIBUTE for d in report.defects)
    assert any("3.1.1" in (f.compliance_standard or "") for f in findings)
    assert report.l10n_score < 100


@pytest.mark.asyncio
async def test_detect_untranslated_key_leaks():
    """Arayüzde sızan ham çeviri anahtarlarının (i18n key leaks) tespitini test eder."""
    auditor = LocalizationI18nAuditor()
    html = """
    <html lang="tr">
    <head><title>Giriş</title></head>
    <body>
        <h1>auth.login.header</h1>
        <p>Lütfen bilgilerinizi giriniz.</p>
        <button>common.buttons.submit</button>
        <span>Hoş geldiniz {{ user_full_name }}</span>
    </body>
    </html>
    """

    report, findings = await auditor.audit_localization("https://test.local", html_content=html)

    assert report.untranslated_keys_count >= 2
    assert any(d.defect_type == LocalizationDefectType.UNTRANSLATED_KEY_LEAK for d in report.defects)
    assert any("auth.login.header" in d.detected_snippet for d in report.defects)
    assert any("common.buttons.submit" in d.detected_snippet for d in report.defects)
    assert any("Çevrilmemiş" in f.title for f in findings)


@pytest.mark.asyncio
async def test_detect_rtl_missing_dir_attribute():
    """Sağdan sola (RTL) dillerde dir='rtl' eksikliğinin tespitini test eder."""
    auditor = LocalizationI18nAuditor()
    # Arapça (ar) dili tanımlanmış ancak dir='rtl' konulmamış
    html = """
    <html lang="ar">
    <head><title>مرحبا</title></head>
    <body>
        <h1>أهلا وسهلا</h1>
    </body>
    </html>
    """

    report, findings = await auditor.audit_localization("https://test.local", html_content=html)

    assert report.has_rtl_support is True
    assert any(d.defect_type == LocalizationDefectType.RTL_BIDI_DEFECT for d in report.defects)
    rtl_defect = [d for d in report.defects if d.defect_type == LocalizationDefectType.RTL_BIDI_DEFECT][0]
    assert rtl_defect.severity == Severity.HIGH


@pytest.mark.asyncio
async def test_hreflang_and_valid_bcp47_tags():
    """Hreflang alternatif dil bağlantılarının ve geçerli BCP 47 etiketlerinin testidir."""
    auditor = LocalizationI18nAuditor()
    html = """
    <html lang="en-US">
    <head>
        <title>Global Portal</title>
        <link rel="alternate" hreflang="tr" href="https://test.local/tr" />
        <link rel="alternate" hreflang="de-DE" href="https://test.local/de" />
        <link rel="alternate" hreflang="x-default" href="https://test.local/" />
    </head>
    <body>
        <p>Welcome to our global platform.</p>
    </body>
    </html>
    """

    report, findings = await auditor.audit_localization("https://test.local", html_content=html)

    assert len(report.hreflang_tags) == 3
    assert all(tag.is_valid for tag in report.hreflang_tags)
    assert "tr" in report.detected_languages
    assert "de-de" in report.detected_languages or "de-DE" in report.detected_languages
    assert report.declared_lang == "en-us"
    assert report.total_defects_count == 0
    assert report.l10n_score == 100


@pytest.mark.asyncio
async def test_clean_localized_page_full_score():
    """Kusursuz yerelleştirilmiş Türkçe sayfanın 100 tam puan almasını test eder."""
    auditor = LocalizationI18nAuditor()
    html = """
    <html lang="tr">
    <head><title>WebGuard Güvenlik</title></head>
    <body>
        <h1>WebGuard Denetim Paneline Hoş Geldiniz</h1>
        <p>Tüm sistemler aktif ve güvenli.</p>
    </body>
    </html>
    """

    report, findings = await auditor.audit_localization("https://test.local", html_content=html)

    assert report.declared_lang == "tr"
    assert report.total_defects_count == 0
    assert report.l10n_score == 100
    assert len(findings) == 0
