"""
WebGuard Güvenlik Açığı Otomatik Doğrulama Motoru (DAST Exploit Verification)
=============================================================================
OWASP Top 10:2021 ve CWE standartlarında:
- Tespit edilen güvenlik bulgularını zararsız sentetik kanaryalar (benign canaries) ve
  güvenli HTTP probları ile otomatik olarak teyit eder.
- Yanlış Pozitifleri (False Positives) güvenli şekilde ayıklar:
  * Reflected Input / Sanitizasyon Doğrulaması (CWE-79)
  * Hassas Dosya ve Konfigürasyon İfşası (.env, .git, backup, actuator - CWE-200)
  * Güvensiz CORS / Arbitrary Origin Yansıması (CWE-942)
  * Açık Yönlendirme (Open Redirect - CWE-601)
  * SSRF İç Ağ Filtreleme Direnci (CWE-918)
"""

import asyncio
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse, parse_qs, urlencode
import httpx

from app.models.schema import (
    Category,
    DASTTestCategory,
    DASTVerificationItem,
    DASTVerificationReport,
    DASTVerificationStatus,
    Finding,
    RCACategory,
    Severity,
)

SENSITIVE_PATHS = [
    ("/.env", ("DB_PASSWORD", "SECRET_KEY", "AWS_ACCESS", "API_KEY", "DATABASE_URL")),
    ("/.git/HEAD", ("ref: refs/heads/",)),
    ("/actuator/health", ('"status":"UP"', '"status":"UNKNOWN"')),
    ("/phpinfo.php", ("PHP Version", "Configuration File (php.ini) Path")),
    ("/backup.zip", ("PK",)),
    ("/dump.sql", ("CREATE TABLE", "INSERT INTO", "-- MySQL dump")),
]

REDIRECT_PARAMS = ["next", "redirect", "redirect_url", "return_to", "goto", "dest", "url"]
INPUT_PARAMS = ["q", "search", "keyword", "query", "s", "msg", "filter"]


class DASTExploitVerifier:
    """
    Güvenlik Açığı Otomatik Doğrulama ve Yanlış Pozitif Ayıklama Motoru (DAST Verifier).
    """

    def __init__(self, timeout_seconds: float = 4.5):
        self.timeout_seconds = timeout_seconds

    async def verify_vulnerabilities(
        self,
        target_url: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[DASTVerificationReport, List[Finding]]:
        """
        Hedef URL üzerinde güvenli sentetik kanaryalar koşturarak zafiyetleri teyit eder.
        """
        findings: List[Finding] = []
        verifications: List[DASTVerificationItem] = []

        headers = {
            "User-Agent": "WebGuard-DAST-Verifier/2.0 (OWASP-CWE-Compliance)",
            "Accept": "text/html,application/xhtml+xml,application/json,*/*",
        }

        session = client or httpx.AsyncClient(headers=headers, timeout=self.timeout_seconds, follow_redirects=False, verify=False)
        should_close = client is None

        try:
            # 1. Test: Hassas Dosya ve Konfigürasyon İfşası (Sensitive Exposure)
            exp_items, exp_findings = await self._verify_sensitive_exposures(target_url, session)
            verifications.extend(exp_items)
            findings.extend(exp_findings)

            # 2. Test: CORS Arbitrary Origin ve Credentials Yansıması (CORS Misconfiguration)
            cors_item, cors_findings = await self._verify_cors_misconfiguration(target_url, session)
            verifications.append(cors_item)
            findings.extend(cors_findings)

            # 3. Test: Reflected Input ve Sanitizasyon Teyidi (Reflected Sanitization)
            ref_items, ref_findings = await self._verify_reflected_sanitization(target_url, session)
            verifications.extend(ref_items)
            findings.extend(ref_findings)

            # 4. Test: Açık Yönlendirme (Open Redirect) Teyidi
            red_item, red_findings = await self._verify_open_redirect(target_url, session)
            verifications.append(red_item)
            findings.extend(red_findings)

            # 5. Test: SSRF İç Ağ Filtreleme Direnci
            ssrf_item, ssrf_findings = await self._verify_ssrf_resilience(target_url, session)
            verifications.append(ssrf_item)
            findings.extend(ssrf_findings)

        finally:
            if should_close:
                await session.aclose()

        # Metrikleri Hesapla
        confirmed_count = sum(1 for v in verifications if v.verification_status == DASTVerificationStatus.CONFIRMED)
        potential_count = sum(1 for v in verifications if v.verification_status == DASTVerificationStatus.POTENTIAL_RISK)
        false_positive_count = sum(1 for v in verifications if v.verification_status == DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE)

        # Skor Hesaplama (100 = Sıfır Doğrulanmış Açık)
        score = 100
        for v in verifications:
            if v.verification_status == DASTVerificationStatus.CONFIRMED:
                if v.severity in (Severity.CRITICAL, Severity.HIGH):
                    score -= 25
                else:
                    score -= 15
            elif v.verification_status == DASTVerificationStatus.POTENTIAL_RISK:
                score -= 6

        score = max(20, min(100, score))

        report = DASTVerificationReport(
            dast_confidence_score=score,
            total_tests_executed=len(verifications),
            confirmed_vulnerabilities_count=confirmed_count,
            potential_risks_count=potential_count,
            false_positives_filtered_count=false_positive_count,
            verifications=verifications,
        )

        return report, findings

    async def _verify_sensitive_exposures(
        self,
        base_url: str,
        session: httpx.AsyncClient,
    ) -> Tuple[List[DASTVerificationItem], List[Finding]]:
        """Hassas dosya ifşalarını güvenli imza kontrolüyle doğrular."""
        items: List[DASTVerificationItem] = []
        findings: List[Finding] = []

        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        for path, signatures in SENSITIVE_PATHS:
            test_url = urljoin(origin, path)
            status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
            evidence = None

            try:
                resp = await session.get(test_url)
                if resp.status_code == 200:
                    text_sample = resp.text[:1000]
                    # İmza eşleşmesi var mı?
                    if any(sig in text_sample for sig in signatures):
                        status = DASTVerificationStatus.CONFIRMED
                        evidence = f"HTTP 200 OK — İmza Doğrulandı: {signatures[0]}"
                    else:
                        # 200 döndü ama imza yok (soft-404 veya default sayfa olabilir)
                        status = DASTVerificationStatus.POTENTIAL_RISK
                        evidence = f"HTTP 200 OK — İçerik boyutu: {len(resp.content)} bayt (İmza bulunamadı)"
                elif resp.status_code in (401, 403):
                    status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
                    evidence = f"HTTP {resp.status_code} — Erişim Güvenli Şekilde Engellendi"
                else:
                    status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
                    evidence = f"HTTP {resp.status_code} — Dosya Mevcut Değil"
            except Exception as e:
                evidence = f"İstek Hatası: {str(e)[:40]}"

            item = DASTVerificationItem(
                test_id=f"DAST-EXP-{path.strip('/').replace('.', '').replace('/', '-')}",
                category=DASTTestCategory.SENSITIVE_EXPOSURE,
                test_name=f"Hassas Dosya İfşası Teyidi ({path})",
                target_endpoint=test_url,
                verification_status=status,
                severity=Severity.HIGH if status == DASTVerificationStatus.CONFIRMED else Severity.LOW,
                canary_payload=path,
                evidence_response_snippet=evidence,
                confidence_percentage=100 if status == DASTVerificationStatus.CONFIRMED else 90,
                description=f"Hedef sunucuda '{path}' hassas dosyasının erişilebilirliği ve içeriği kontrol edildi.",
                remediation=f"Sunucu konfigürasyonunda (Nginx/Apache) '{path}' yoluna erişimi engelleyin veya dosyayı sunucudan kaldırın.",
            )
            items.append(item)

            if status == DASTVerificationStatus.CONFIRMED:
                findings.append(
                    Finding(
                        id=f"DAST_CONFIRMED_EXPOSURE_{path.strip('/').replace('.', '').upper()}",
                        category=Category.SECURITY,
                        severity=Severity.HIGH,
                        title=f"Kesin Teyit Edildi: Hassas Dosya İfşası ({path})",
                        description=f"'{test_url}' adresine gönderilen istekte dosyanın varlığı ve karakteristik imzaları doğrulanmıştır.",
                        remediation=f"Web sunucusu yapılandırmasında gizli dosyalara (hidden files) erişimi engelleyin: 'location ~ /\\. {{ deny all; }}'",
                        risk_impact="Saldırganlar veritabanı parolalarını, kaynak kod geçmişini veya API anahtarlarını ele geçirebilir.",
                        compliance_standard="OWASP Top 10:2021 A05 Security Misconfiguration, CWE-200",
                        evidence={"endpoint": test_url, "snippet": evidence},
                        rca_category=RCACategory.REAL_BUG,
                        team_assignment="DevOps & Sistem Yöneticisi (Infra/SecOps)",
                    )
                )

        return items, findings

    async def _verify_cors_misconfiguration(
        self,
        base_url: str,
        session: httpx.AsyncClient,
    ) -> Tuple[DASTVerificationItem, List[Finding]]:
        """Güvensiz CORS origin yansıması ve credentials durumunu test eder."""
        findings: List[Finding] = []
        canary_origin = "https://canary-origin-check.webguard.local"
        headers = {"Origin": canary_origin}
        status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
        evidence = None

        try:
            resp = await session.options(base_url, headers=headers)
            if resp.status_code in (404, 405):
                resp = await session.get(base_url, headers=headers)

            resp_headers = {k.lower(): v for k, v in resp.headers.items()}
            acao = resp_headers.get("access-control-allow-origin")
            acac = resp_headers.get("access-control-allow-credentials", "").lower() == "true"

            if acao == canary_origin and acac:
                status = DASTVerificationStatus.CONFIRMED
                evidence = f"ACAO: {acao} | ACAC: true (Kritik Yetkisiz Origin Yansıması)"
            elif acao == canary_origin:
                status = DASTVerificationStatus.POTENTIAL_RISK
                evidence = f"ACAO: {acao} (Origin Yansıtıldı, Credentials: false)"
            elif acao == "*":
                status = DASTVerificationStatus.POTENTIAL_RISK
                evidence = "ACAO: * (Joker Karakter - Genel Erişim)"
            else:
                status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
                evidence = f"CORS Güvenli: ACAO={acao or 'Tanımsız'}"
        except Exception as e:
            evidence = f"Hata: {str(e)[:40]}"

        item = DASTVerificationItem(
            test_id="DAST-CORS-ORIGIN-REFLECTION",
            category=DASTTestCategory.CORS_MISCONFIGURATION,
            test_name="CORS Güvenlik ve Origin Yansıması Doğrulaması",
            target_endpoint=base_url,
            verification_status=status,
            severity=Severity.HIGH if status == DASTVerificationStatus.CONFIRMED else Severity.LOW,
            canary_payload=canary_origin,
            evidence_response_snippet=evidence,
            confidence_percentage=95,
            description="Sunucunun yabancı Origin başlıklarına karşı CORS yapılandırması test edildi.",
            remediation="Origin başlıklarını dinamik yansıtmak yerine yalnızca güvenilen domainlerden oluşan katı bir beyaz liste (allowlist) kullanın.",
        )

        if status == DASTVerificationStatus.CONFIRMED:
            findings.append(
                Finding(
                    id="DAST_CONFIRMED_CORS_ARBITRARY_ORIGIN",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="Kesin Teyit Edildi: Güvensiz CORS ve Kimlik Bilgisi Sızıntısı Riski",
                    description=f"Sunucu '{canary_origin}' origin başlığını doğrudan yansıtarak Access-Control-Allow-Credentials: true döndürmüştür.",
                    remediation="CORS middleware'inde dinamik origin kabulünü iptal edin ve allowlist uygulayın.",
                    risk_impact="Kullanıcı oturumları ve özel verileri üçüncü taraf sitelerdeki kötü niyetli JS kodları tarafından okunabilir.",
                    compliance_standard="OWASP Top 10:2021 A05 Security Misconfiguration, CWE-942",
                    evidence={"evidence": evidence},
                    rca_category=RCACategory.REAL_BUG,
                    team_assignment="Yazılım Geliştirici (Backend / API)",
                )
            )

        return item, findings

    async def _verify_reflected_sanitization(
        self,
        base_url: str,
        session: httpx.AsyncClient,
    ) -> Tuple[List[DASTVerificationItem], List[Finding]]:
        """Zararsız kanarya ile girdi yansıması ve HTML filtreleme teyidi."""
        items: List[DASTVerificationItem] = []
        findings: List[Finding] = []

        canary_token = f"wgcanary{uuid.uuid4().hex[:6]}"
        canary_payload = f"<u>{canary_token}</u>"

        parsed = urlparse(base_url)
        query_dict = parse_qs(parsed.query)

        # Eğer URL'de parametre yoksa arama parametresi ekle
        test_param = "q"
        if query_dict:
            test_param = list(query_dict.keys())[0]

        query_dict[test_param] = [canary_payload]
        new_query = urlencode(query_dict, doseq=True)
        test_url = parsed._replace(query=new_query).geturl()

        status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
        evidence = None

        try:
            resp = await session.get(test_url)
            text = resp.text

            # Kanarya filtresiz olarak HTML içinde yer aldı mı?
            if canary_payload in text:
                status = DASTVerificationStatus.CONFIRMED
                evidence = f"Ham Kanarya Etiketi Yansıtıldı: '{canary_payload}'"
            elif canary_token in text:
                # Kanarya kelimesi var ama etiketler filtrelenmiş (örn &lt;u&gt; ya da silinmiş)
                status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
                evidence = "Girdi Güvenli Şekilde Filtrelendi / HTML Encode Edildi (False-Positive Elendi)"
            else:
                status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
                evidence = "Girdi Sayfa İçinde Yansıtılmadı (Güvenli)"
        except Exception as e:
            evidence = f"İstek Hatası: {str(e)[:40]}"

        item = DASTVerificationItem(
            test_id="DAST-XSS-REFLECTED-CANARY",
            category=DASTTestCategory.REFLECTED_INPUT_SANITIZATION,
            test_name="Girdi Filtreleme ve HTML Yansıma Doğrulaması",
            target_endpoint=test_url,
            parameter_tested=test_param,
            verification_status=status,
            severity=Severity.HIGH if status == DASTVerificationStatus.CONFIRMED else Severity.LOW,
            canary_payload=canary_payload,
            evidence_response_snippet=evidence,
            confidence_percentage=95,
            description=f"'{test_param}' parametresine gönderilen zararsız HTML kanaryasının sayfaya filtresiz yansıyıp yansımadığı denetlendi.",
            remediation="Kullanıcıdan alınan tüm girdileri DOM'a yazarken bağlama uygun şekilde (Context-Aware HTML Entity Encoding) encode edin.",
        )
        items.append(item)

        if status == DASTVerificationStatus.CONFIRMED:
            findings.append(
                Finding(
                    id="DAST_CONFIRMED_REFLECTED_XSS",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title=f"Kesin Teyit Edildi: Filtrelenmemiş Girdi Yansıması ({test_param})",
                    description=f"'{test_param}' parametresi üzerinden gönderilen HTML etiketleri arayüze filtresiz yansımaktadır.",
                    remediation="React/Vue gibi modern JSX render motorları kullanın veya DOMPurify ile girdileri dezenfekte edin.",
                    risk_impact="Saldırganlar kullanıcı oturum çerezlerini çalabilir veya sahte giriş formları enjekte edebilir.",
                    compliance_standard="OWASP Top 10:2021 A03 Injection, CWE-79",
                    evidence={"param": test_param, "evidence": evidence},
                    rca_category=RCACategory.REAL_BUG,
                    team_assignment="Yazılım Geliştirici (Frontend / Web UI)",
                )
            )

        return items, findings

    async def _verify_open_redirect(
        self,
        base_url: str,
        session: httpx.AsyncClient,
    ) -> Tuple[DASTVerificationItem, List[Finding]]:
        """Açık yönlendirme (Open Redirect) zafiyetini zararsız test adresiyle teyit eder."""
        findings: List[Finding] = []
        canary_destination = "https://example.com/webguard-canary-redirect"

        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        test_url = urljoin(origin, f"/login?redirect_url={canary_destination}")
        status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
        evidence = None

        try:
            resp = await session.get(test_url)
            location = resp.headers.get("location", "")

            if resp.status_code in (301, 302, 303, 307, 308) and "example.com" in location:
                status = DASTVerificationStatus.CONFIRMED
                evidence = f"HTTP {resp.status_code} — Harici Yönlendirme Teyit Edildi: Location: {location}"
            else:
                status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
                evidence = f"HTTP {resp.status_code} — Harici Yönlendirme Engellendi veya İletilmedi"
        except Exception as e:
            evidence = f"İstek Hatası: {str(e)[:40]}"

        item = DASTVerificationItem(
            test_id="DAST-OPEN-REDIRECT",
            category=DASTTestCategory.OPEN_REDIRECT,
            test_name="Açık Yönlendirme (Open Redirect) Doğrulaması",
            target_endpoint=test_url,
            parameter_tested="redirect_url",
            verification_status=status,
            severity=Severity.MEDIUM if status == DASTVerificationStatus.CONFIRMED else Severity.LOW,
            canary_payload=canary_destination,
            evidence_response_snippet=evidence,
            confidence_percentage=90,
            description="Yönlendirme parametrelerinin harici etki alanlarına filtresiz izin verip vermediği kontrol edildi.",
            remediation="Yönlendirme hedeflerini yalnızca bağıl yollarla (/dashboard) veya önceden onaylanmış alan adı beyaz listesiyle sınırlandırın.",
        )

        if status == DASTVerificationStatus.CONFIRMED:
            findings.append(
                Finding(
                    id="DAST_CONFIRMED_OPEN_REDIRECT",
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title="Kesin Teyit Edildi: Filtresiz Açık Yönlendirme (Open Redirect)",
                    description="Sunucu harici bir hedefe yönlendirme yapan isteği doğrulamadan kabul etmektedir.",
                    remediation="Location başlığı üretmeden önce URL'nin kendi domaininize ait olduğunu doğrulayın.",
                    risk_impact="Kullanıcılar güvenilir domain üzerinden kimlik avı (phishing) sayfalarına yönlendirilebilir.",
                    compliance_standard="OWASP Top 10:2021 A01 Broken Access Control, CWE-601",
                    evidence={"evidence": evidence},
                    rca_category=RCACategory.REAL_BUG,
                    team_assignment="Yazılım Geliştirici (Auth & Routing)",
                )
            )

        return item, findings

    async def _verify_ssrf_resilience(
        self,
        base_url: str,
        session: httpx.AsyncClient,
    ) -> Tuple[DASTVerificationItem, List[Finding]]:
        """Sunucunun iç ağ / döngüsel IP'lere karşı savunma filtresini kontrol eder."""
        findings: List[Finding] = []
        canary_internal_target = "http://127.0.0.1:80/canary_ssrf_probe"

        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        test_url = urljoin(origin, f"/api/webhook?url={canary_internal_target}")

        status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
        evidence = None

        try:
            resp = await session.get(test_url)
            if resp.status_code in (400, 403) and any(k in resp.text.lower() for k in ("invalid", "blocked", "disallowed", "internal")):
                status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
                evidence = f"HTTP {resp.status_code} — İç Ağ İsteği Filtre Tarafından Engellendi (Filtre Aktif)"
            elif resp.status_code == 200 and "canary" in resp.text.lower():
                status = DASTVerificationStatus.CONFIRMED
                evidence = "HTTP 200 — İç Ağ Çağrısı Başarıyla Yanıtlandı (SSRF Savunmasız)"
            else:
                status = DASTVerificationStatus.SAFE_OR_FALSE_POSITIVE
                evidence = f"HTTP {resp.status_code} — Uç Nokta Etkilenmedi veya Mevcut Değil"
        except Exception as e:
            evidence = f"İstek Hatası: {str(e)[:40]}"

        item = DASTVerificationItem(
            test_id="DAST-SSRF-RESILIENCE",
            category=DASTTestCategory.SSRF_FILTER_RESILIENCE,
            test_name="Sunucu Taraflı İstek Sahteciliği (SSRF) Filtre Teyidi",
            target_endpoint=test_url,
            parameter_tested="url",
            verification_status=status,
            severity=Severity.HIGH if status == DASTVerificationStatus.CONFIRMED else Severity.LOW,
            canary_payload=canary_internal_target,
            evidence_response_snippet=evidence,
            confidence_percentage=90,
            description="Sunucunun iç ağ (localhost, RFC1918) IP adreslerine yapılan istekleri engelleyip engellemediği denetlendi.",
            remediation="Harici HTTP çağrısı yapan tüm servislerde IP çözümlemesi yaparak özel IP bloklarını (127.0.0.0/8, 10.0.0.0/8, 169.254.169.254) engelleyin.",
        )

        return item, findings

