"""
WebGuard - Üçüncü Taraf Script, İzleyici ve CSP Sandbox Denetleyicisi (Third-Party Tracker & CSP Sandbox Auditor)
Kurumsal Standartlar: W3C Content Security Policy Level 3 (CSP3),
W3C Subresource Integrity (SRI), KVKK Madde 5, 6, 7 & GDPR Madde 6,
OWASP Top 10 A05:2021 Security Misconfiguration, PCI-DSS v4.0 Requirement 6.4.3.
"""

import re
from typing import List, Dict, Any, Optional, Tuple, Set
from urllib.parse import urlparse
import httpx

from app.models.schema import (
    NetworkRequestTrace,
    ThirdPartyCategory,
    ThirdPartyScriptItem,
    CSPDirectiveAudit,
    ConsentComplianceStatus,
    ThirdPartySecurityReport,
    Finding,
    Severity,
    Category,
    RCACategory,
)


class ThirdPartySecurityAuditor:
    """
    Sayfaya dahil edilen üçüncü taraf script'leri (izleyiciler, reklam pikselleri, oturum kayıt araçları),
    SRI bütünlük doğrulamalarını, CMP çerez rıza uyumluluğunu ve CSP sandbox başlıklarını denetler.
    """

    # Bilinen İzleyici ve 3. Taraf Kütüphane Veritabanı
    KNOWN_TRACKERS: Dict[str, Dict[str, Any]] = {
        "connect.facebook.net": {
            "name": "Meta (Facebook) Pixel",
            "category": ThirdPartyCategory.ADVERTISING_TRACKER,
            "pii_risk": True,
            "desc": "Kullanıcı etkileşimlerini, satın alma olaylarını ve hedef kitle verilerini Meta sunucularına aktarır.",
        },
        "analytics.tiktok.com": {
            "name": "TikTok Pixel",
            "category": ThirdPartyCategory.ADVERTISING_TRACKER,
            "pii_risk": True,
            "desc": "Kullanıcı davranışlarını ve reklam dönüşümlerini TikTok platformuna raporlar.",
        },
        "googletagmanager.com": {
            "name": "Google Tag Manager (GTM)",
            "category": ThirdPartyCategory.ANALYTICS,
            "pii_risk": False,
            "desc": "Sayfaya dinamik olarak rastgele üçüncü taraf script enjekte edebilen etiket yönetim kapsayıcısı.",
        },
        "google-analytics.com": {
            "name": "Google Analytics (GA4 / Universal)",
            "category": ThirdPartyCategory.ANALYTICS,
            "pii_risk": False,
            "desc": "Ziyaretçi trafiğini ve sayfa gezinme telemetrisini toplar.",
        },
        "static.hotjar.com": {
            "name": "Hotjar Session Recorder",
            "category": ThirdPartyCategory.SESSION_RECORDING,
            "pii_risk": True,
            "desc": "Kullanıcı fare hareketlerini, tıklamalarını ve form girdilerini video gibi kaydeder (Keylogger/PII riski).",
        },
        "clarity.ms": {
            "name": "Microsoft Clarity",
            "category": ThirdPartyCategory.SESSION_RECORDING,
            "pii_risk": True,
            "desc": "Oturum kayıtları ve ısı haritaları oluşturur; kullanıcı giriş alanlarını izler.",
        },
        "fullstory.com": {
            "name": "FullStory",
            "category": ThirdPartyCategory.SESSION_RECORDING,
            "pii_risk": True,
            "desc": "Yüksek çözünürlüklü kullanıcı oturum oynatımı ve DOM mutasyon kaydı gerçekleştirir.",
        },
        "mc.yandex.ru": {
            "name": "Yandex Metrica",
            "category": ThirdPartyCategory.SESSION_RECORDING,
            "pii_risk": True,
            "desc": "Oturum kaydı (WebVisor) ve analiz verilerini Yandex sunucularına iletir.",
        },
        "static.criteo.net": {
            "name": "Criteo Retargeting",
            "category": ThirdPartyCategory.ADVERTISING_TRACKER,
            "pii_risk": True,
            "desc": "Yeniden pazarlama amacıyla kullanıcı tarayıcı profilini takip eder.",
        },
        "snap.licdn.com": {
            "name": "LinkedIn Insight Tag",
            "category": ThirdPartyCategory.ADVERTISING_TRACKER,
            "pii_risk": True,
            "desc": "B2B dönüşüm takibi ve LinkedIn reklam optimizasyonu için veri toplar.",
        },
        "widget.intercom.io": {
            "name": "Intercom Live Chat",
            "category": ThirdPartyCategory.CUSTOMER_SUPPORT_CHAT,
            "pii_risk": False,
            "desc": "Canlı destek ve kullanıcı mesajlaşma widget'ı.",
        },
    }

    # Bilinen CDN Sağlayıcıları (SRI bütünlük denetimi gerektiren kütüphaneler)
    CDN_DOMAINS = {
        "cdnjs.cloudflare.com",
        "cdn.jsdelivr.net",
        "unpkg.com",
        "code.jquery.com",
        "stackpath.bootstrapcdn.com",
        "ajax.googleapis.com",
        "cdn.tailwindcss.com",
    }

    # CMP (Çerez Rıza Yönetimi Platformu) Belirteçleri
    CMP_SIGNATURES = [
        ("OneTrust", r"(onetrust|ot-sdk|OptanonConsent)"),
        ("Cookiebot", r"(cookiebot|CookieConsent)"),
        ("Klaro", r"(klaro|klaro-cookie)"),
        ("Didomi", r"(didomi|didomi-consent)"),
        ("CookieYes", r"(cookieyes|cky-consent)"),
        ("Usercentrics", r"(usercentrics)"),
        ("Generic Cookie Banner", r"(cookie-banner|cerez-politikasi|kvkk-aydinlatma|consent-modal)"),
    ]

    SCRIPT_TAG_PATTERN = re.compile(
        r'<script\b([^>]*?)>(.*?)</script>',
        re.IGNORECASE | re.DOTALL,
    )
    SRC_ATTR_PATTERN = re.compile(r'src=["\']([^"\']+)["\']', re.IGNORECASE)
    INTEGRITY_ATTR_PATTERN = re.compile(r'integrity=["\']([^"\']+)["\']', re.IGNORECASE)

    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout

    async def audit_third_party_and_csp(
        self,
        target_url: str,
        html_content: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        network_traces: Optional[List[NetworkRequestTrace]] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[ThirdPartySecurityReport, List[Finding]]:
        """
        Üçüncü taraf script'leri, SRI hash doğrulamalarını, CSP sandbox yapılandırmasını ve CMP rıza durumunu denetler.
        """
        scripts: List[ThirdPartyScriptItem] = []
        findings: List[Finding] = []
        csp_directives: List[CSPDirectiveAudit] = []

        target_host = urlparse(target_url).hostname or ""

        # 1. HTML ve HTTP Başlıkları yoksa çek
        if not html_content or headers is None:
            html_content, fetched_headers = await self._fetch_page_and_headers(target_url, client)
            if headers is None:
                headers = fetched_headers

        headers_lower = {k.lower(): v for k, v in (headers or {}).items()}

        # ── 1. Script ve Tracker Envanteri Analizi ────────────────────────────
        total_scripts_count = 0
        third_party_count = 0
        trackers_count = 0
        missing_sri_count = 0
        session_recording_count = 0

        for match in self.SCRIPT_TAG_PATTERN.finditer(html_content):
            total_scripts_count += 1
            attrs = match.group(1) or ""
            src_match = self.SRC_ATTR_PATTERN.search(attrs)
            if not src_match:
                continue

            script_src = src_match.group(1).strip()
            parsed_src = urlparse(script_src)
            script_domain = parsed_src.hostname or ""

            # Dahili veya göreceli script ise üçüncü taraf sayılmaz
            if not script_domain or script_domain == target_host or script_domain.endswith(f".{target_host}"):
                continue

            third_party_count += 1

            # SRI Kontrolü
            integrity_match = self.INTEGRITY_ATTR_PATTERN.search(attrs)
            has_sri = bool(integrity_match)
            sri_hash = integrity_match.group(1) if integrity_match else None

            # Bilinen tracker mı?
            tracker_info = None
            for known_domain, info in self.KNOWN_TRACKERS.items():
                if known_domain in script_domain:
                    tracker_info = info
                    break

            is_cdn = any(cdn in script_domain for cdn in self.CDN_DOMAINS)

            if tracker_info:
                trackers_count += 1
                cat = tracker_info["category"]
                if cat == ThirdPartyCategory.SESSION_RECORDING:
                    session_recording_count += 1

                severity = Severity.HIGH if tracker_info["pii_risk"] else Severity.MEDIUM

                item = ThirdPartyScriptItem(
                    tracker_name=tracker_info["name"],
                    category=cat,
                    script_url=script_src,
                    domain=script_domain,
                    has_sri=has_sri,
                    sri_hash=sri_hash,
                    severity=severity,
                    pii_leak_risk=tracker_info["pii_risk"],
                    description=tracker_info["desc"],
                    remediation="Kullanıcıdan açık çerez rızası (Opt-in) alınana kadar bu izleyicinin yüklenmesini engelleyin.",
                )
                scripts.append(item)

            elif is_cdn:
                if not has_sri:
                    missing_sri_count += 1
                    item = ThirdPartyScriptItem(
                        tracker_name=f"CDN Library ({script_domain})",
                        category=ThirdPartyCategory.CDN_LIBRARY,
                        script_url=script_src,
                        domain=script_domain,
                        has_sri=False,
                        sri_hash=None,
                        severity=Severity.HIGH,
                        pii_leak_risk=False,
                        description="Dış CDN kaynağından çekilen JavaScript kütüphanesinde Subresource Integrity (SRI) doğrulaması eksik. CDN ele geçirilirse siteniz doğrudan kötü niyetli kod çalıştırabilir (Magecart saldırısı).",
                        remediation=f"Script etiketine 'integrity=\"sha384-...\" crossorigin=\"anonymous\"' özniteliklerini ekleyin.",
                    )
                    scripts.append(item)
                else:
                    item = ThirdPartyScriptItem(
                        tracker_name=f"Verified CDN ({script_domain})",
                        category=ThirdPartyCategory.CDN_LIBRARY,
                        script_url=script_src,
                        domain=script_domain,
                        has_sri=True,
                        sri_hash=sri_hash,
                        severity=Severity.INFO,
                        pii_leak_risk=False,
                        description="Harici CDN kütüphanesi geçerli SRI hash imzası ile güvenceye alınmış.",
                        remediation="Mevcut güvenli yapılandırmayı koruyun.",
                    )
                    scripts.append(item)
            else:
                item = ThirdPartyScriptItem(
                    tracker_name=f"Harici Script ({script_domain})",
                    category=ThirdPartyCategory.UNKNOWN_THIRD_PARTY,
                    script_url=script_src,
                    domain=script_domain,
                    has_sri=has_sri,
                    sri_hash=sri_hash,
                    severity=Severity.MEDIUM if not has_sri else Severity.LOW,
                    pii_leak_risk=False,
                    description=f"Sınıflandırılmamış üçüncü taraf script ({script_domain}). Sayfa DOM ve ağ erişim haklarına sahiptir.",
                    remediation="Kütüphanenin güvenilirliğini teyit edin ve SRI hash ile yükleyin.",
                )
                scripts.append(item)

        # Eksik SRI bulgusu oluştur
        if missing_sri_count > 0:
            findings.append(
                Finding(
                    id="FINDING-SEC-MISSING-SRI",
                    title=f"Tedarik Zinciri Riski: {missing_sri_count} Adet Harici Script'te SRI (Subresource Integrity) Eksik",
                    description=(
                        f"Harici CDN üzerinden yüklenen {missing_sri_count} adet JavaScript dosyasında 'integrity' hash özniteliği bulunmuyor. "
                        f"Üçüncü taraf CDN sunucusuna yapılabilecek bir siber saldırıda siteniz habersizce zararlı kod çalıştırabilir (Polyfill.io / British Airways vakası)."
                    ),
                    severity=Severity.HIGH,
                    category=Category.SECURITY,
                    rca_category=RCACategory.REAL_BUG,
                    page_url=target_url,
                    remediation="Tüm harici CDN script'lerine SRI hash ekleyin (örn: <script src='...' integrity='sha384-...' crossorigin='anonymous'>).",
                    risk_impact="Kullanıcı kredi kartı, şifre veya oturum verilerinin üçüncü taraf saldırganlara sızdırılması (Magecart / XSS).",
                    compliance_standard="W3C Subresource Integrity (SRI) & PCI-DSS v4.0 Req 6.4.3",
                    team_assignment="Güvenlik & DevSecOps Ekibi",
                )
            )

        # ── 2. Content Security Policy (CSP) Sandbox Analizi ─────────────────
        raw_csp = headers_lower.get("content-security-policy", "")
        csp_report_only = headers_lower.get("content-security-policy-report-only", "")
        csp_configured = bool(raw_csp or csp_report_only)
        csp_grade = "F"

        if not csp_configured:
            findings.append(
                Finding(
                    id="FINDING-SEC-MISSING-CSP",
                    title="Kritik Güvenlik Eksikliği: Content-Security-Policy (CSP) Başlığı Bulunamadı",
                    description=(
                        "Sunucu yanıtında 'Content-Security-Policy' başlığı tanımlanmamış. Bu durum tarayıcının kötü niyetli XSS enjeksiyonlarını, "
                        "onaysız veri sızdırma (data exfiltration) bağlantılarını ve tünel script'leri engellemesini imkansız kılar."
                    ),
                    severity=Severity.HIGH,
                    category=Category.SECURITY,
                    rca_category=RCACategory.REAL_BUG,
                    page_url=target_url,
                    remediation="HTTP yanıt başlıklarına veya Next.js middleware'e sıkı bir Content-Security-Policy kuralı ekleyin.",
                    risk_impact="Siteler arası komut çalıştırma (XSS), sahte form gönderimleri ve veri hırsızlığı.",
                    compliance_standard="W3C Content Security Policy Level 3 & OWASP Top 10 A05:2021",
                    team_assignment="Güvenlik & Altyapı Ekibi",
                )
            )
        else:
            # CSP direktiflerini ayrıştır
            directives_str = raw_csp or csp_report_only
            directive_pairs = [d.strip() for d in directives_str.split(";") if d.strip()]
            parsed_directives: Dict[str, str] = {}
            for pair in directive_pairs:
                parts = pair.split(None, 1)
                d_name = parts[0].lower()
                d_val = parts[1] if len(parts) > 1 else ""
                parsed_directives[d_name] = d_val

            warnings_count = 0

            # script-src analizi
            script_src_val = parsed_directives.get("script-src", parsed_directives.get("default-src", ""))
            script_warnings = []
            if "'unsafe-inline'" in script_src_val and "nonce-" not in script_src_val:
                script_warnings.append("'unsafe-inline' direktifi XSS korumasını devre dışı bırakır. Nonce veya Hash tabanlı korumaya geçin.")
                warnings_count += 1
            if "'unsafe-eval'" in script_src_val:
                script_warnings.append("'unsafe-eval' string ifadelerin kod olarak çalıştırılmasına izin verir (eval/Function riski).")
                warnings_count += 1
            if "*" in script_src_val:
                script_warnings.append("script-src '*' genel joker karakteri içeriyor; herhangi bir kaynaktan script yüklenmesine izin verir.")
                warnings_count += 1

            csp_directives.append(
                CSPDirectiveAudit(
                    directive="script-src",
                    raw_value=script_src_val or "Tanımsız",
                    is_secure=len(script_warnings) == 0 and bool(script_src_val),
                    warnings=script_warnings,
                    recommendation="script-src 'self' 'nonce-...' https:; şeklinde sıkılaştırın.",
                )
            )

            # object-src analizi
            obj_src_val = parsed_directives.get("object-src", "")
            obj_warnings = []
            if obj_src_val != "'none'":
                obj_warnings.append("object-src 'none' olarak yapılandırılmalıdır (Flash/Java/Plugin exploitlerini engeller).")
                warnings_count += 1
            csp_directives.append(
                CSPDirectiveAudit(
                    directive="object-src",
                    raw_value=obj_src_val or "Tanımsız",
                    is_secure=obj_src_val == "'none'",
                    warnings=obj_warnings,
                    recommendation="object-src 'none';",
                )
            )

            # base-uri analizi
            base_uri_val = parsed_directives.get("base-uri", "")
            base_warnings = []
            if base_uri_val != "'self'":
                base_warnings.append("base-uri 'self' eksik. Saldırganlar <base> etiketi ile göreceli URL'leri yönlendirebilir.")
                warnings_count += 1
            csp_directives.append(
                CSPDirectiveAudit(
                    directive="base-uri",
                    raw_value=base_uri_val or "Tanımsız",
                    is_secure=base_uri_val == "'self'",
                    warnings=base_warnings,
                    recommendation="base-uri 'self';",
                )
            )

            # Notlama
            if warnings_count == 0 and "script-src" in parsed_directives and "default-src" in parsed_directives:
                csp_grade = "A+"
            elif warnings_count <= 1:
                csp_grade = "A"
            elif warnings_count <= 2:
                csp_grade = "B"
            else:
                csp_grade = "C"

        # ── 3. Çerez Rıza / CMP & KVKK/GDPR Analizi ─────────────────────────
        detected_cmp = None
        for cmp_name, pattern in self.CMP_SIGNATURES:
            if re.search(pattern, html_content, re.IGNORECASE):
                detected_cmp = cmp_name
                break

        has_consent_banner = detected_cmp is not None
        unconsented_trackers = 0

        # Eğer reklam veya oturum izleyici var ama CMP yoksa:
        if not has_consent_banner and trackers_count > 0:
            unconsented_trackers = trackers_count
            findings.append(
                Finding(
                    id="FINDING-COMP-UNCONSENTED-TRACKERS",
                    title=f"Mevzuat İhlali: Kullanıcı Rızası Alınmadan {trackers_count} Adet İzleyici Çalıştırılıyor (KVKK & GDPR)",
                    description=(
                        f"Sayfada kullanıcıya açık çerez rıza banner'ı (CMP) sunulmadan {trackers_count} adet reklam/analiz izleyicisi "
                        f"otomatik olarak başlatıldı. KVKK Madde 5 ve GDPR Madde 6 gereğince zorunlu olmayan çerezler rıza öncesi yüklenemez."
                    ),
                    severity=Severity.HIGH,
                    category=Category.SECURITY,
                    rca_category=RCACategory.REAL_BUG,
                    page_url=target_url,
                    remediation="OneTrust, Cookiebot veya açık kaynaklı bir CMP entegre ederek kullanıcı onayı gelene kadar izleyici etiketlerini bekletin.",
                    risk_impact="Kişisel Verileri Koruma Kurumu (KVKK) ve Avrupa Veri Koruma Kurulu (EDPB) idari para cezaları.",
                    compliance_standard="KVKK Madde 5-7 & GDPR Madde 6 Rıza Şartı",
                    team_assignment="Uyum & Hukuk / Frontend Ekibi",
                )
            )

        consent_detail = (
            f"Sitede '{detected_cmp}' rıza yönetim sistemi aktif."
            if has_consent_banner
            else (
                f"Sitede çerez rıza banner'ı bulunamadı. {trackers_count} izleyici rıza alınmadan çalışıyor."
                if trackers_count > 0
                else "Sitede harici izleyici bulunmuyor, rıza gereksinimi asgari seviyede."
            )
        )

        consent_status = ConsentComplianceStatus(
            has_consent_banner=has_consent_banner,
            detected_cmp_vendor=detected_cmp,
            unconsented_trackers_count=unconsented_trackers,
            gdpr_kvkk_compliant=has_consent_banner or (trackers_count == 0),
            detail=consent_detail,
        )

        # ── 4. Skorlama ve Önerilen CSP Header'ı ─────────────────────────────
        score = 100
        if not csp_configured:
            score -= 25
        elif csp_grade in {"C", "F"}:
            score -= 15
        elif csp_grade == "B":
            score -= 8

        if missing_sri_count > 0:
            score -= min(25, missing_sri_count * 10)

        if not consent_status.gdpr_kvkk_compliant:
            score -= 15

        if session_recording_count > 0:
            score -= 8

        score = max(20, min(100, score))

        # Önerilen Güvenli CSP Header Şablonu
        allowed_domains = sorted(list(set(s.domain for s in scripts if s.has_sri or s.category == ThirdPartyCategory.ANALYTICS)))
        domains_joined = " ".join([f"https://{d}" for d in allowed_domains[:4]])
        recommended_csp = (
            f"default-src 'self'; "
            f"script-src 'self' 'nonce-rAnd0m123' {domains_joined}; "
            f"style-src 'self' 'unsafe-inline'; "
            f"img-src 'self' data: https:; "
            f"connect-src 'self' {domains_joined}; "
            f"font-src 'self' https: data:; "
            f"object-src 'none'; "
            f"base-uri 'self'; "
            f"form-action 'self'; "
            f"frame-ancestors 'none';"
        )

        remediation_recipes = [
            "Tüm CDN kütüphanelerine SRI hash (integrity=\"sha384-...\") ve crossorigin=\"anonymous\" ekleyin.",
            "Sunucuya sıkı bir Content-Security-Policy başlığı ekleyerek 'unsafe-inline' yerine Nonce/Hash kullanımına geçin.",
            "Kullanıcı rıza onayı (Opt-in) vermeden önce Meta Pixel ve Hotjar gibi oturum kaydedicilerin tetiklenmesini engelleyin.",
            "Bilinmeyen veya artık kullanılmayan üçüncü taraf script'leri HTML kodundan temizleyin (Attack Surface Reduction).",
            "Next.js middleware.ts içerisinde dinamik 'crypto.randomUUID()' ile CSP Nonce enjeksiyonu yapın."
        ]

        report = ThirdPartySecurityReport(
            security_score=score,
            total_scripts_count=total_scripts_count,
            third_party_scripts_count=third_party_count,
            trackers_count=trackers_count,
            missing_sri_count=missing_sri_count,
            session_recording_count=session_recording_count,
            csp_configured=csp_configured,
            csp_grade=csp_grade,
            consent_status=consent_status,
            scripts=scripts,
            csp_directives=csp_directives,
            recommended_csp_header=recommended_csp,
            remediation_recipes=remediation_recipes,
        )

        return report, findings

    async def _fetch_page_and_headers(
        self,
        target_url: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[str, Dict[str, str]]:
        """
        Hedef web sayfasının HTML kaynak kodunu ve HTTP yanıt başlıklarını güvenle çeker.
        """
        should_close = False
        if client is None:
            client = httpx.AsyncClient(timeout=self.timeout, verify=False)
            should_close = True

        try:
            resp = await client.get(target_url, headers={"User-Agent": "WebGuard-ThirdParty-Auditor/1.0"})
            return resp.text, dict(resp.headers)
        except Exception:
            return "<html><head><title>WebGuard Local</title></head><body>Third Party Audit Fallback</body></html>", {}
        finally:
            if should_close:
                await client.aclose()

