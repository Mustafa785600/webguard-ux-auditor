import pytest
from app.services.tls_crypto_auditor import TLSCryptoAuditor
from app.models.schema import (
    TLSProtocolVersion,
    CipherSecurityLevel,
    Severity,
    Category,
)

@pytest.mark.asyncio
async def test_detect_unencrypted_plaintext_http():
    """Şifrelenmemiş HTTP bağlantılarının F notu ve 0 puanla tespit edilmesini test eder."""
    auditor = TLSCryptoAuditor()
    report, findings = await auditor.audit_tls_crypto("http://example.com")

    assert report.crypto_score == 0
    assert report.ssl_labs_grade == "F"
    assert report.negotiated_protocol == TLSProtocolVersion.PLAINTEXT_HTTP
    assert any(f.id == "FINDING-TLS-UNENCRYPTED-HTTP" for f in findings)
    assert any(f.severity == Severity.CRITICAL for f in findings)


@pytest.mark.asyncio
async def test_detect_broken_legacy_cipher_suite():
    """Kırılmış eski RC4 ve 3DES şifrelerinin tespitini ve PCI-DSS ihlalini test eder."""
    auditor = TLSCryptoAuditor()
    mock_data = {
        "protocol": TLSProtocolVersion.TLS_1_2,
        "cipher": "RC4-SHA",
        "has_pfs": False,
        "supports_legacy_tls": True,
        "days_remaining": 120,
    }

    report, findings = await auditor.audit_tls_crypto(
        "https://legacy-bank.local",
        headers={"Strict-Transport-Security": "max-age=31536000"},
        mock_cert_details=mock_data,
    )

    assert report.crypto_score < 50
    assert report.ssl_labs_grade in {"C", "F"}
    assert any(c.security_level == CipherSecurityLevel.BROKEN_LEGACY for c in report.ciphers)
    assert any(f.id == "FINDING-TLS-BROKEN-CIPHER" for f in findings)


@pytest.mark.asyncio
async def test_detect_missing_and_imperfect_hsts():
    """Eksik HSTS başlığının ve yetersiz max-age / preload eksikliğinin tespitini test eder."""
    auditor = TLSCryptoAuditor()
    mock_data = {
        "protocol": TLSProtocolVersion.TLS_1_2,
        "cipher": "ECDHE-RSA-AES128-GCM-SHA256",
        "has_pfs": True,
        "days_remaining": 150,
    }

    # 1. Hiç HSTS olmayan durum
    rep_no_hsts, findings_no_hsts = await auditor.audit_tls_crypto(
        "https://example.com",
        headers={},
        mock_cert_details=mock_data,
    )
    assert rep_no_hsts.hsts_status.is_enabled is False
    assert any(f.id == "FINDING-TLS-MISSING-HSTS" for f in findings_no_hsts)

    # 2. Kısa max-age ve preload eksik HSTS
    rep_weak_hsts, _ = await auditor.audit_tls_crypto(
        "https://example.com",
        headers={"Strict-Transport-Security": "max-age=86400"},
        mock_cert_details=mock_data,
    )
    assert rep_weak_hsts.hsts_status.is_enabled is True
    assert rep_weak_hsts.hsts_status.preload_ready is False
    assert len(rep_weak_hsts.hsts_status.warnings) > 0


@pytest.mark.asyncio
async def test_detect_expiring_certificate_warnings():
    """Bitişine 5 gün ve 25 gün kalan sertifikaların kritik ve orta seviye uyarılar üretmesini test eder."""
    auditor = TLSCryptoAuditor()

    # 5 gün kalan kritik durum
    mock_critical = {
        "protocol": TLSProtocolVersion.TLS_1_3,
        "cipher": "TLS_AES_256_GCM_SHA384",
        "days_remaining": 5,
    }
    rep_crit, findings_crit = await auditor.audit_tls_crypto(
        "https://expiring-site.local",
        headers={"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"},
        mock_cert_details=mock_critical,
    )
    assert any(f.id == "FINDING-TLS-CERT-EXPIRING-SOON" for f in findings_crit)
    assert rep_crit.days_until_cert_expiry == 5

    # 25 gün kalan orta seviye planlı bakım durumu
    mock_warning = {
        "protocol": TLSProtocolVersion.TLS_1_3,
        "cipher": "TLS_AES_256_GCM_SHA384",
        "days_remaining": 25,
    }
    rep_warn, findings_warn = await auditor.audit_tls_crypto(
        "https://warning-site.local",
        headers={"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"},
        mock_cert_details=mock_warning,
    )
    assert any(f.id == "FINDING-TLS-CERT-RENEWAL-WARNING" for f in findings_warn)


@pytest.mark.asyncio
async def test_modern_hardened_tls13_perfect_a_plus_score():
    """TLS 1.3, AEAD şifre, HSTS preload ve 200+ gün geçerli sertifikaya sahip sitenin A+ ve 100 puan almasını test eder."""
    auditor = TLSCryptoAuditor()
    mock_data = {
        "protocol": TLSProtocolVersion.TLS_1_3,
        "cipher": "TLS_AES_256_GCM_SHA384",
        "has_pfs": True,
        "supports_tls13": True,
        "supports_legacy_tls": False,
        "days_remaining": 280,
        "issuer_name": "DigiCert Global Root G2",
        "key_size_bits": 4096,
    }

    report, findings = await auditor.audit_tls_crypto(
        "https://secure-bank.local",
        headers={"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"},
        mock_cert_details=mock_data,
    )

    assert report.crypto_score == 100
    assert report.ssl_labs_grade == "A+"
    assert report.negotiated_protocol == TLSProtocolVersion.TLS_1_3
    assert report.has_pfs is True
    assert report.hsts_status.preload_ready is True
    assert len(findings) == 0
    assert "ssl_protocols TLSv1.2 TLSv1.3;" in report.recommended_nginx_conf
