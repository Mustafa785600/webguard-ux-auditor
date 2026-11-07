import re
from typing import List, Optional
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import httpx
from app.models.schema import Finding, Category, Severity, SectorType
from app.scanners.base import BaseScanner

# Known Tracker Signatures
TRACKER_SIGNATURES = [
    "googletagmanager.com/gtm.js",
    "google-analytics.com/analytics.js",
    "google-analytics.com/ga.js",
    "connect.facebook.net",
    "static.ads-twitter.com",
    "analytics.tiktok.com",
    "static.hotjar.com",
    "clarity.ms/tag",
    "mc.yandex.ru/metrika",
    "criteo.net",
]

# Advertising / Social Pixels specifically sensitive under HIPAA / Health Privacy
HEALTHCARE_SENSITIVE_TRACKERS = [
    ("connect.facebook.net", "Meta Pixel (Facebook)"),
    ("fbq('init'", "Meta Pixel SDK"),
    ("analytics.tiktok.com", "TikTok Pixel"),
    ("snap.licdn.com", "LinkedIn Insight Tag"),
    ("static.ads-twitter.com", "Twitter / X Pixel"),
]

# Common Cookie Consent Banner Signatures
COOKIE_BANNER_SIGNATURES = [
    "cookiebot",
    "onetrust",
    "klaro",
    "axeptio",
    "cookieyes",
    "cookie-consent",
    "cookie-banner",
    "cookieconsent",
    "cookiebanner",
    "cerez-politikasi",
    "cerez-uyari",
    "cerez-onay",
    "cookie_notice",
    "cookies-eu",
]

class ComplianceScanner(BaseScanner):
    """
    Sektörel Uyumluluk ve Yasal Güvenlik Protokolü Tarayıcısı:
    - E-Ticaret & Finans: PCI-DSS v4.0 (SRI Bütünlüğü, Ödeme Formu Güvenliği, Açıkta Kalan API Anahtarları)
    - Kurumsal & Kamu: KVKK / GDPR (Aydınlatma Metni & Gizlilik Politikası, Çerez Onay Mekanizması)
    - Sağlık & Medikal: HIPAA / FTC (Hasta Gizliliği ve Üçüncü Taraf Reklam Takipçisi Tespiti)
    - SaaS & Teknoloji: OWASP API Security Top 10 (CORS Wildcard & Swagger/OpenAPI Sızıntısı)
    """

    def __init__(self, requested_sector: SectorType = SectorType.AUTO):
        self.requested_sector = requested_sector
        self.detected_sector: Optional[SectorType] = None

    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []
        try:
            response = await client.get(target_url, timeout=12.0)
        except Exception:
            return findings

        html_text = response.text or ""
        headers = response.headers
        soup = BeautifulSoup(html_text, "html.parser")

        # 1. Sektör Tespiti (Auto-Detection)
        self.detected_sector = self.detect_sector(soup, target_url, html_text)
        active_sector = (
            self.detected_sector
            if self.requested_sector == SectorType.AUTO or not self.requested_sector
            else self.requested_sector
        )

        # 2. PCI-DSS Denetimleri (E-Ticaret veya Harici Scriptlerin/Ödeme Formlarının Varlığı)
        findings.extend(self._check_pci_dss_sri(soup, target_url))
        findings.extend(self._check_exposed_payment_keys(html_text))
        findings.extend(self._check_insecure_payment_form(soup, target_url))

        # 3. KVKK & GDPR Denetimleri (Genel Web, Kurumsal ve E-Ticaret)
        findings.extend(self._check_kvkk_privacy_policy(soup, html_text))
        findings.extend(self._check_cookie_consent(soup, html_text))

        # 4. HIPAA & Sağlık Gizliliği Denetimleri (Sağlık veya Sektör Sağlık Seçilmişse)
        if active_sector == SectorType.HEALTHCARE or self.detected_sector == SectorType.HEALTHCARE:
            findings.extend(self._check_hipaa_trackers(soup, html_text))

        # 5. SaaS & OWASP API Denetimleri (CORS & Docs)
        findings.extend(self._check_cors_wildcard(headers))
        api_findings = await self._check_exposed_api_docs(target_url, client)
        findings.extend(api_findings)

        # 6. BDDK & Fintek Uyumluluk Denetimleri (Virgosol Standardı)
        findings.extend(self._check_bddk_session_security(response))
        findings.extend(self._check_bddk_financial_data_masking(html_text))
        if active_sector == SectorType.FINTECH_BANKING or self.detected_sector == SectorType.FINTECH_BANKING:
            findings.extend(self._check_bddk_mfa_login_security(soup, target_url))
            bddk_api_findings = await self._check_bddk_open_banking_api(target_url, client)
            findings.extend(bddk_api_findings)

        return findings

    def detect_sector(self, soup: BeautifulSoup, url: str, text: str) -> SectorType:
        """Sayfa içeriği ve URL sinyallerine göre hedef sektörünü otomatik tahmin eder."""
        lower_url = url.lower()
        lower_text = text.lower()

        scores = {
            SectorType.ECOMMERCE: 0,
            SectorType.HEALTHCARE: 0,
            SectorType.CORPORATE_GOV: 0,
            SectorType.SAAS_API: 0,
            SectorType.FINTECH_BANKING: 0,
        }

        # Fintech & Banking Signals (Virgosol Standard)
        fintech_keywords = [
            "banka", "bankacılık", "banking", "iban", "mevduat", "kredi",
            "havale", "eft", "fast", "pos", "fintek", "fintech", "cüzdan",
            "wallet", "açık bankacılık", "open banking", "bkm", "bddk",
            "swift", "kart başvurusu", "faiz", "bireysel emeklilik", "yatırım"
        ]
        for kw in fintech_keywords:
            if kw in lower_text:
                scores[SectorType.FINTECH_BANKING] += 1
        if any(term in lower_url for term in ("bank", "finans", "fintech", "cuzdan", "credit", "kredi", "garanti", "isbank", "akbank")):
            scores[SectorType.FINTECH_BANKING] += 3

        # E-Commerce Signals
        ecom_keywords = [
            "sepet", "cart", "checkout", "odeme", "ödeme", "siparis", "sipariş",
            "fiyat", "ürün", "urun", "add to cart", "add-to-cart", "kredi kartı",
            "kredi karti", "credit card", "magaza", "mağaza", "shopping", "ecommerce"
        ]
        for kw in ecom_keywords:
            if kw in lower_text:
                scores[SectorType.ECOMMERCE] += 1

        # Healthcare Signals
        health_keywords = [
            "hasta", "randevu", "doktor", "hekim", "klinik", "tedavi",
            "poliklinik", "hastane", "hospital", "patient", "appointment",
            "medical", "sağlık", "saglik", "muayene", "tıp"
        ]
        for kw in health_keywords:
            if kw in lower_text:
                scores[SectorType.HEALTHCARE] += 1

        # Corporate & Gov Signals
        gov_keywords = [
            "belediye", "bakanlık", "bakanlik", "gov.tr", "kurumsal",
            "faaliyet raporu", "vizyon", "misyon", "başkan", "baskan", "mevzuat"
        ]
        if ".gov." in lower_url or ".edu." in lower_url:
            scores[SectorType.CORPORATE_GOV] += 3
        for kw in gov_keywords:
            if kw in lower_text:
                scores[SectorType.CORPORATE_GOV] += 1

        # SaaS & Tech Signals
        tech_keywords = [
            "developer", "api-docs", "swagger", "documentation", "sdk",
            "pricing tier", "dashboard", "api reference", "cloud platform"
        ]
        for kw in tech_keywords:
            if kw in lower_text:
                scores[SectorType.SAAS_API] += 1

        best_sector, max_score = max(scores.items(), key=lambda item: item[1])
        if max_score >= 2:
            return best_sector
        return SectorType.GENERAL

    def _check_pci_dss_sri(self, soup: BeautifulSoup, target_url: str) -> List[Finding]:
        """
        PCI-DSS v4.0 Requirement 6.4.3:
        Dış kaynaklardan veya CDN üzerinden yüklenen JavaScript dosyalarında
        Subresource Integrity (SRI) doğrulaması bulunmalıdır.
        """
        findings: List[Finding] = []
        target_domain = urlparse(target_url).netloc.lower()

        external_scripts_without_sri = []

        for script in soup.find_all("script", src=True):
            src = script.get("src", "").strip()
            if not src:
                continue

            # Harici / CDN script tespiti
            is_external = False
            if src.startswith("//") or src.startswith("http://") or src.startswith("https://"):
                script_domain = urlparse(src if not src.startswith("//") else f"https:{src}").netloc.lower()
                if script_domain and script_domain != target_domain:
                    is_external = True
            elif any(cdn in src.lower() for cdn in ["cdnjs.", "jsdelivr.", "unpkg.", "bootstrapcdn.", "googleapis."]):
                is_external = True

            if is_external:
                integrity = script.get("integrity", "").strip()
                if not integrity:
                    external_scripts_without_sri.append(src)

        if external_scripts_without_sri:
            sample_src = external_scripts_without_sri[0]
            findings.append(
                Finding(
                    id="SEC_PCI_MISSING_SRI",
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title=f"Harici Scriptlerde Subresource Integrity (SRI) Eksikliği ({len(external_scripts_without_sri)} Script)",
                    description=(
                        f"Dış kaynaklardan veya CDN üzerinden yüklenen {len(external_scripts_without_sri)} adet JavaScript dosyasında "
                        "'integrity' özniteliği bulunamadı. PCI-DSS v4.0 Requirement 6.4.3 kuralı, istemci tarafında çalışan tüm harici "
                        "scriptlerin kriptografik hash ile bütünlük denetiminden geçmesini şart koşar (Magecart / E-skimming saldırılarına karşı)."
                    ),
                    remediation=(
                        "Dış CDN veya üçüncü taraf alan adlarından yüklenen <script> etiketlerine kriptografik SRI hash değeri "
                        "(integrity='sha384-...') ve 'crossorigin=\"anonymous\"' özniteliklerini ekleyin."
                    ),
                    evidence={
                        "missing_sri_count": len(external_scripts_without_sri),
                        "sample_scripts": external_scripts_without_sri[:5],
                    },
                    risk_impact=(
                        "Saldırganlar dışarıdan çekilen CDN sunucusunu ele geçirirse veya DNS zehirlemesi yaparsa, web sayfanıza "
                        "zararlı JavaScript enjekte ederek kullanıcıların kredi kartı ve oturum bilgilerini kopyalayabilir (Magecart)."
                    ),
                    code_example=(
                        f'<script src="{sample_src}"\n'
                        '        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"\n'
                        '        crossorigin="anonymous"></script>'
                    ),
                    target_location="index.html (<script> etiketleri)",
                    problematic_code=f'<script src="{sample_src}"></script>',
                    compliance_standard="PCI-DSS v4.0 Req 6.4.3",
                    sector_relevance=[SectorType.ECOMMERCE, SectorType.GENERAL]
                )
            )
        return findings

    def _check_exposed_payment_keys(self, html_text: str) -> List[Finding]:
        """Sayfa kaynak kodunda açıkta bırakılmış Stripe veya ödeme sağlayıcı anahtarları."""
        findings: List[Finding] = []

        # Secret Keys (Critical)
        secret_keys = re.findall(r"sk_live_[0-9a-zA-Z]{24,99}", html_text)
        if secret_keys:
            findings.append(
                Finding(
                    id="SEC_PCI_EXPOSED_SECRET_KEY",
                    category=Category.SECURITY,
                    severity=Severity.CRITICAL,
                    title="Açıkta Bırakılmış Canlı Ödeme Gizli Anahtarı (Stripe Live Secret Key)",
                    description="HTML kaynak kodunda canlı üretim ortamına ait gizli ödeme API anahtarı (sk_live_...) tespit edildi!",
                    remediation="Gizli anahtarı derhal iptal edin (revoke) ve yeni anahtarı yalnızca sunucu tarafında (environment variable) saklayın.",
                    evidence={"exposed_key_prefix": secret_keys[0][:12] + "..." },
                    risk_impact="Saldırganlar gizli anahtarı kullanarak müşteri ödeme verilerine erişebilir, hesap bakiyesini boşaltabilir veya yetkisiz işlemler gerçekleştirebilir.",
                    code_example="// ASLA frontend kodunda saklamayın:\n// const stripe = Stripe('sk_live_...'); // YANLIŞ\n// Sunucuda saklayın: process.env.STRIPE_SECRET_KEY",
                    target_location="HTML Source Code",
                    problematic_code=f"sk_live_{secret_keys[0][8:16]}...",
                    compliance_standard="PCI-DSS v4.0 Req 3.3 & 6.4",
                    sector_relevance=[SectorType.ECOMMERCE]
                )
            )

        # Test Keys in Production (Medium)
        test_keys = re.findall(r"pk_test_[0-9a-zA-Z]{24,99}|sk_test_[0-9a-zA-Z]{24,99}", html_text)
        if test_keys and not secret_keys:
            findings.append(
                Finding(
                    id="SEC_PCI_EXPOSED_TEST_KEY",
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title="Canlı Ortamda Unutulmuş Test Ödeme Anahtarı (Test Payment Key)",
                    description="Web sayfası kaynak kodunda test ortamına ait ödeme API anahtarı tespit edildi.",
                    remediation="Canlı üretim ortamında test anahtarları yerine canlı public anahtarları güvenli şekilde yapılandırın.",
                    evidence={"test_key_sample": test_keys[0][:12] + "..."},
                    risk_impact="Test anahtarlarının açıkta olması işlemlerin yanlışlıkla test modunda yapılmasına veya ortam ayrımının ihlal edilmesine yol açabilir.",
                    code_example="const stripe = Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);",
                    target_location="HTML Source Code",
                    problematic_code=f"{test_keys[0][:14]}...",
                    compliance_standard="PCI-DSS v4.0 Req 6.4",
                    sector_relevance=[SectorType.ECOMMERCE]
                )
            )

        return findings

    def _check_insecure_payment_form(self, soup: BeautifulSoup, target_url: str) -> List[Finding]:
        """Kredi kartı formunun şifresiz HTTP endpoint'e post edilmesi veya şifresiz aktarım riski."""
        findings: List[Finding] = []
        is_https = target_url.lower().startswith("https://")

        for form in soup.find_all("form"):
            action = form.get("action", "").strip()
            # Kredi kartı inputları var mı?
            card_inputs = form.find_all("input", attrs={"name": re.compile(r"card|cc-|cvv|cvc", re.IGNORECASE)})

            if card_inputs:
                if not is_https or action.lower().startswith("http://"):
                    findings.append(
                        Finding(
                            id="SEC_PCI_INSECURE_PAYMENT_FORM",
                            category=Category.SECURITY,
                            severity=Severity.CRITICAL,
                            title="Güvensiz Kredi Kartı Ödeme Formu İletimi",
                            description="Kredi kartı verisi toplayan form HTTPS üzerinden iletilmiyor veya şifresiz HTTP hedefine yönleniyor.",
                            remediation="Ödeme formunun barındığı sayfayı ve form 'action' hedefini daima geçerli HTTPS üzerinden çalıştırın.",
                            evidence={"action": action, "is_https": is_https},
                            risk_impact="Kullanıcıların kart numaraları ve CVV kodları ağ üzerindeki saldırganlar tarafından açık metin olarak dinlenebilir (MitM).",
                            code_example='<form action="https://odeme.example.com/checkout" method="POST">',
                            target_location="Payment <form>",
                            problematic_code=str(form)[:140],
                            compliance_standard="PCI-DSS v4.0 Req 4.1",
                            sector_relevance=[SectorType.ECOMMERCE]
                        )
                    )
                    break
        return findings

    def _check_kvkk_privacy_policy(self, soup: BeautifulSoup, html_text: str) -> List[Finding]:
        """KVKK Madde 10 & GDPR Art. 13: Aydınlatma Metni / Gizlilik Politikası varlığı."""
        findings: List[Finding] = []

        privacy_keywords = [
            "gizlilik", "kvkk", "aydinlatma metni", "aydınlatma metni",
            "kisisel veri", "kişisel veri", "privacy policy", "terms of service",
            "gizlilik politikasi", "gizlilik politikası", "privacy notice"
        ]

        found_privacy_link = False
        # Linkleri ve butonları tara
        for a in soup.find_all(["a", "button"]):
            text = (a.get_text() or "").lower()
            href = (a.get("href") or "").lower()
            if any(kw in text or kw in href for kw in privacy_keywords):
                found_privacy_link = True
                break

        if not found_privacy_link:
            findings.append(
                Finding(
                    id="SEC_KVKK_PRIVACY_POLICY_MISSING",
                    category=Category.SECURITY,
                    severity=Severity.LOW,
                    title="Yasal Aydınlatma Metni / Gizlilik Politikası Bağlantısı Bulunamadı",
                    description=(
                        "Web sitesinde 6698 sayılı KVKK Madde 10 ve GDPR Madde 13 uyarınca zorunlu olan "
                        "Aydınlatma Metni veya Gizlilik Politikası bağlantısı tespit edilemedi."
                    ),
                    remediation=(
                        "Sayfanızın alt bilgi (footer) veya navigasyon alanına kullanıcıların kolayca erişebileceği "
                        "bir 'KVKK Aydınlatma Metni' ve 'Gizlilik Sözleşmesi' bağlantısı ekleyin."
                    ),
                    evidence={"privacy_link_found": False},
                    risk_impact=(
                        "Kişisel Verileri Koruma Kurulu (KVKK) ve GDPR denetimlerinde aydınlatma yükümlülüğünün yerine getirilmemesi "
                        "nedeniyle idari para cezası riski doğurur."
                    ),
                    code_example='<footer>\n  <a href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</a>\n  <a href="/gizlilik">Gizlilik Politikası</a>\n</footer>',
                    target_location="Footer / Navigation",
                    problematic_code="<footer> (Eksik KVKK / Gizlilik Bağlantısı)",
                    compliance_standard="KVKK Madde 10 & GDPR Art. 13",
                    sector_relevance=[SectorType.CORPORATE_GOV, SectorType.GENERAL, SectorType.ECOMMERCE]
                )
            )

        return findings

    def _check_cookie_consent(self, soup: BeautifulSoup, html_text: str) -> List[Finding]:
        """KVKK & ePrivacy Direktifi: Takip çerezleri varsa Çerez Onay Banner'ı bulunmalı."""
        findings: List[Finding] = []
        lower_html = html_text.lower()

        # Takipçi var mı?
        has_trackers = any(tracker in lower_html for tracker in TRACKER_SIGNATURES)
        if not has_trackers:
            return findings

        # Çerez onay mekanizması var mı?
        has_consent = any(sig in lower_html for sig in COOKIE_BANNER_SIGNATURES)

        # ID veya Class kontrolleri
        if not has_consent:
            consent_elements = soup.find_all(
                attrs={"class": re.compile(r"cookie|cerez|consent", re.IGNORECASE)}
            ) or soup.find_all(
                attrs={"id": re.compile(r"cookie|cerez|consent", re.IGNORECASE)}
            )
            if consent_elements:
                has_consent = True

        if not has_consent:
            findings.append(
                Finding(
                    id="SEC_KVKK_COOKIE_CONSENT_MISSING",
                    category=Category.SECURITY,
                    severity=Severity.LOW,
                    title="Takip Çerezleri İçin Çerez Onay Bildirimi (Cookie Consent) Bulunamadı",
                    description=(
                        "Sitede Google Analytics, Meta Pixel veya benzeri üçüncü taraf takipçiler tespit edildi, "
                        "ancak kullanıcılardan açık rıza alan bir Çerez Onay Bildirimi (Cookie Banner) bulunamadı."
                    ),
                    remediation=(
                        "KVKK ve ePrivacy kuralları doğrultusunda, pazarlama ve analiz çerezleri çalıştırılmadan önce "
                        "kullanıcıdan onay alan bir Çerez Yönetim Aracı (Cookiebot, OneTrust vb.) entegre edin."
                    ),
                    evidence={"trackers_detected": True, "consent_banner_detected": False},
                    risk_impact=(
                        "Ziyaretçilerin rızası olmaksızın pazarlama/analitik çerezleri yerleştirmek KVKK ve GDPR kapsamında "
                        "hukuka aykırı veri işleme sayılabilir."
                    ),
                    code_example='<!-- Örnek Çerez Bildirimi Bileşeni -->\n<div id="cookie-banner" class="cookie-consent">\n  <p>Bu sitede analiz çerezleri kullanılmaktadır. <button id="accept-cookies">Kabul Et</button></p>\n</div>',
                    target_location="index.html (Cookie Consent Component)",
                    problematic_code="<!-- Takipçiler aktif ancak Çerez Bildirimi eksik -->",
                    compliance_standard="KVKK & ePrivacy Direktifi (Madde 5/3)",
                    sector_relevance=[SectorType.CORPORATE_GOV, SectorType.GENERAL, SectorType.ECOMMERCE]
                )
            )

        return findings

    def _check_hipaa_trackers(self, soup: BeautifulSoup, html_text: str) -> List[Finding]:
        """HIPAA & FTC Hasta Gizliliği: Sağlık sayfalarında reklam takipçisi bulunmamalı."""
        findings: List[Finding] = []
        lower_html = html_text.lower()

        detected_sensitive = []
        for sig, label in HEALTHCARE_SENSITIVE_TRACKERS:
            if sig.lower() in lower_html:
                detected_sensitive.append(label)

        if detected_sensitive:
            findings.append(
                Finding(
                    id="SEC_HIPAA_TRACKER_LEAKAGE",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="Sağlık Sayfalarında Üçüncü Taraf Reklam Takipçisi Tespiti",
                    description=(
                        f"Sağlık hizmeti sunan sitede {', '.join(set(detected_sensitive))} reklam/izleme kodu tespit edildi. "
                        "ABD FTC ve HIPAA düzenleyicileri, randevu ve hasta etkileşimi içeren platformlarda üçüncü taraf reklam pikselleriyle "
                        "kullanıcı IP/davranış verisi paylaşılmasını hasta gizliliği ihlali saymaktadır."
                    ),
                    remediation=(
                        "Hasta randevu, muayene, poliklinik ve sağlık şikayeti sayfalarından Meta Pixel, TikTok Pixel vb. üçüncü taraf "
                        "reklam piksellerini tamamen kaldırın veya hassas veri iletimini engelleyin."
                    ),
                    evidence={"detected_trackers": list(set(detected_sensitive))},
                    risk_impact=(
                        "Hasta sağlık arayışları, poliklinik tercihleri ve randevu verileri sosyal medya devlerine iletilebilir; "
                        "bu durum ağır cezai yaptırımlara ve hasta gizliliği davalarına yol açar."
                    ),
                    code_example="// Sağlık ve randevu sayfalarında reklam piksellerini devre dışı bırakın:\nif (!isMedicalOrAppointmentPage()) {\n  initMetaPixel();\n}",
                    target_location="<head> / Analytics Scripts",
                    problematic_code=f"Tespit Edilen Reklam Takipçileri: {', '.join(set(detected_sensitive))}",
                    compliance_standard="HIPAA Privacy Rule & FTC Sağlık Rehberi",
                    sector_relevance=[SectorType.HEALTHCARE]
                )
            )
        return findings

    def _check_cors_wildcard(self, headers: httpx.Headers) -> List[Finding]:
        """OWASP API Security: Wildcard CORS kontrolü."""
        findings: List[Finding] = []
        acao = headers.get("Access-Control-Allow-Origin", "").strip()
        acac = headers.get("Access-Control-Allow-Credentials", "").strip().lower()

        if acao == "*":
            findings.append(
                Finding(
                    id="SEC_API_WILDCARD_CORS",
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title="Vahşi Kart CORS Yapılandırması (Access-Control-Allow-Origin: *)",
                    description="Web uygulaması tüm harici alan adlarından gelen çapraz kaynak (CORS) isteklerine sınırsız izin veriyor.",
                    remediation="Access-Control-Allow-Origin başlığında '*' yerine yalnızca güvenilir kaynak alan adlarını beyaz listeye alın.",
                    evidence={"Access-Control-Allow-Origin": acao, "Access-Control-Allow-Credentials": acac},
                    risk_impact="Kullanıcı oturum açıkken zararlı bir web sitesini ziyaret ederse, o site kurbanın tarayıcısını kullanarak bu API'ye yetkisiz istekler gönderebilir.",
                    code_example='// Güvenli CORS Başlığı:\nAccess-Control-Allow-Origin: https://app.example.com',
                    target_location="HTTP Response Headers",
                    problematic_code="Access-Control-Allow-Origin: *",
                    compliance_standard="OWASP API Security Top 10 (API7:2023)",
                    sector_relevance=[SectorType.SAAS_API, SectorType.GENERAL]
                )
            )
        return findings

    async def _check_exposed_api_docs(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        """OWASP API Security: Korumasız Swagger / OpenAPI UI Dokümantasyonu."""
        findings: List[Finding] = []
        doc_paths = ["/swagger-ui.html", "/api-docs", "/openapi.json"]

        for path in doc_paths:
            probe_url = urljoin(target_url, path)
            try:
                resp = await client.get(probe_url, timeout=3.0)
                if resp.status_code == 200:
                    text_lower = resp.text.lower()
                    if "swagger" in text_lower or "openapi" in text_lower:
                        findings.append(
                            Finding(
                                id="SEC_API_EXPOSED_DOCS",
                                category=Category.SECURITY,
                                severity=Severity.MEDIUM,
                                title=f"Korumasız API Dokümantasyonu ({path})",
                                description=f"Dışarıya açık ve kimlik doğrulaması gerektirmeyen API dokümantasyonu tespit edildi: {path}",
                                remediation="Üretim (production) ortamında Swagger/OpenAPI dokümantasyonunu kapatın veya IP/Basic Auth ile sınırlandırın.",
                                evidence={"doc_url": probe_url, "status_code": resp.status_code},
                                risk_impact="Saldırganlar tüm backend uç noktalarını, parametrelerini ve veri modellerini keşfederek hedefli saldırılar planlayabilir.",
                                code_example="// FastAPI / Swagger Dokümantasyonunu production'da kapatın:\napp = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)",
                                target_location=path,
                                problematic_code=f"{probe_url} (HTTP 200 OK)",
                                compliance_standard="OWASP API Security Top 10 (API9:2023)",
                                sector_relevance=[SectorType.SAAS_API]
                            )
                        )
                        break
            except Exception:
                continue

        return findings

    # ── Virgosol Tarzı BDDK & Açık Bankacılık Standartları Denetimleri ──

    def _check_bddk_session_security(self, response: httpx.Response) -> List[Finding]:
        """
        BDDK Bilgi Sistemleri ve Elektronik Bankacılık Hizmetleri Yönetmeliği (Madde 31 - Oturum Yönetimi):
        Oturum çerezleri mutlak surette 'Secure', 'HttpOnly' ve 'SameSite=Strict' veya 'Lax' olmalıdır.
        """
        findings: List[Finding] = []
        set_cookie_headers = response.headers.get_list("set-cookie") if hasattr(response.headers, "get_list") else [response.headers.get("set-cookie", "")]

        insecure_cookies = []
        session_keywords = ["session", "token", "auth", "sid", "phpsessid", "jsessionid", "connect.sid", "jwt", "bank"]

        for cookie_str in set_cookie_headers:
            if not cookie_str:
                continue
            lower_c = cookie_str.lower()
            cookie_name = cookie_str.split("=")[0].strip()

            is_session = any(k in cookie_name.lower() for k in session_keywords)
            if not is_session:
                continue

            missing_flags = []
            if "secure" not in lower_c:
                missing_flags.append("Secure")
            if "httponly" not in lower_c:
                missing_flags.append("HttpOnly")
            if "samesite=strict" not in lower_c and "samesite=lax" not in lower_c:
                missing_flags.append("SameSite=Strict/Lax")

            if missing_flags:
                insecure_cookies.append(f"{cookie_name} (Eksik: {', '.join(missing_flags)})")

        if insecure_cookies:
            findings.append(
                Finding(
                    id="BDDK_INSECURE_SESSION_COOKIE",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="BDDK Md. 31: Güvensiz Oturum Çerezi Yapılandırması",
                    description=(
                        "BDDK Bilgi Sistemleri Yönetmeliği Madde 31 gereğince oturum yönetimi çerezlerinde "
                        f"'Secure', 'HttpOnly' ve 'SameSite=Strict' bayrakları zorunludur. Tespit edilen eksik çerezler: {', '.join(insecure_cookies)}"
                    ),
                    remediation=(
                        "Set-Cookie başlığında 'Secure; HttpOnly; SameSite=Strict' direktiflerini zorunlu kılın. "
                        "Çerezlerin yalnızca HTTPS üzerinden iletildiğinden ve JavaScript (XSS) ile erişilemediğinden emin olun."
                    ),
                    risk_impact=(
                        "Oturum çerezinde HttpOnly eksikliği XSS saldırılarında oturum çalınmasına (Session Hijacking), "
                        "SameSite eksikliği ise CSRF yoluyla yetkisiz para transferi veya talimat verilmesine yol açar."
                    ),
                    evidence={"insecure_cookies": insecure_cookies},
                    code_example=(
                        "# Güvenli BDDK Uyumlu Çerez Örneği\n"
                        "Set-Cookie: session_token=abcd1234efgh; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800"
                    ),
                    target_location="Set-Cookie Header",
                    compliance_standard="BDDK Bilgi Sistemleri Yönetmeliği (Md. 31)",
                    sector_relevance=[SectorType.FINTECH_BANKING, SectorType.ECOMMERCE],
                )
            )

        return findings

    def _check_bddk_financial_data_masking(self, html_text: str) -> List[Finding]:
        """
        BDDK Bilgi Sistemleri Yönetmeliği (Madde 34) & KVKK:
        Hassas finansal ve kimlik verilerinin (IBAN, TCKN, Kredi Kartı) maskelenmeden açıkta gösterimi yasaktır.
        """
        findings: List[Finding] = []

        # 1. Unmasked Turkish IBAN Check (TR + 24 digits = 26 total)
        iban_pattern = re.compile(r"\b(TR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2})\b", re.IGNORECASE)
        unmasked_ibans = []
        for match in iban_pattern.finditer(html_text):
            raw_iban = match.group(1).replace(" ", "")
            if len(raw_iban) == 26 and "*" not in raw_iban and "X" not in raw_iban:
                unmasked_ibans.append(f"{raw_iban[:4]}...{raw_iban[-4:]} (Açıkta: {raw_iban})")

        if unmasked_ibans:
            findings.append(
                Finding(
                    id="BDDK_UNMASKED_IBAN_EXPOSURE",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="BDDK Md. 34: Maskelenmemiş IBAN Bilgisi Tespit Edildi",
                    description=(
                        f"Sayfa içeriğinde {len(unmasked_ibans)} adet maskelenmemiş açık Türk IBAN numarası tespit edildi. "
                        "Finansal mevzuata göre müşteri hesap ve IBAN bilgileri maskelenmelidir."
                    ),
                    remediation=(
                        "Arayüzde gösterilen tüm IBAN numaralarını yalnızca ilk 4 hane (ülke ve kontrol kodu) "
                        "ile son 4 hanesi görünür olacak şekilde (örn. TR33 ********** 1234) maskeleyin."
                    ),
                    risk_impact=(
                        "Açık IBAN bilgileri kimlik avı (phishing), sosyal mühendislik ve BDDK/KVKK denetimlerinde "
                        "ağır idari para cezalarına yol açar."
                    ),
                    evidence={"samples": unmasked_ibans[:3]},
                    code_example=(
                        "// IBAN Maskeleme Fonksiyonu\n"
                        "function maskIBAN(iban) {\n"
                        "    const clean = iban.replace(/\\s/g, '');\n"
                        "    return clean.slice(0, 4) + ' ' + '*'.repeat(16) + ' ' + clean.slice(-4);\n"
                        "}"
                    ),
                    target_location="HTML Response Body",
                    compliance_standard="BDDK Bilgi Sistemleri Yönetmeliği (Md. 34)",
                    sector_relevance=[SectorType.FINTECH_BANKING, SectorType.ECOMMERCE],
                )
            )

        # 2. Algorithmic Turkish Citizenship ID (TCKN) Check
        tckn_pattern = re.compile(r"\b([1-9]\d{10})\b")
        unmasked_tckns = []
        for match in tckn_pattern.finditer(html_text):
            candidate = match.group(1)
            # Algorithmic validation
            digits = [int(c) for c in candidate]
            if len(set(digits)) == 1:
                continue  # Skip dummy like 11111111111
            d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7 - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
            d11 = sum(digits[:10]) % 10
            if digits[9] == d10 and digits[10] == d11:
                unmasked_tckns.append(f"{candidate[:3]}*****{candidate[-2:]}")

        if unmasked_tckns:
            findings.append(
                Finding(
                    id="BDDK_UNMASKED_TCKN_EXPOSURE",
                    category=Category.SECURITY,
                    severity=Severity.CRITICAL,
                    title="Kritik Veri Sızıntısı: Maskelenmemiş T.C. Kimlik Numarası",
                    description=(
                        f"Sayfa kaynak kodunda resmi TCKN algoritma doğrulamasını geçen {len(unmasked_tckns)} adet açık kimlik numarası tespit edildi."
                    ),
                    remediation=(
                        "Kullanıcı TCKN bilgilerini veritabanında şifreli (AES-256) saklayın ve web arayüzlerinde "
                        "yalnızca ilk 3 ve son 2 hane hariç tüm haneleri maskeleyin (örn. 123******89)."
                    ),
                    risk_impact=(
                        "TCKN sızıntısı KVKK Madde 12 ve BDDK Bilgi Sistemleri düzenlemelerine göre en üst düzey kritik güvenlik ihlalidir."
                    ),
                    evidence={"masked_samples": unmasked_tckns[:3]},
                    target_location="HTML Response Body",
                    compliance_standard="BDDK Bilgi Sistemleri & KVKK (Md. 12)",
                    sector_relevance=[SectorType.FINTECH_BANKING, SectorType.CORPORATE_GOV],
                )
            )

        return findings

    def _check_bddk_mfa_login_security(self, soup: BeautifulSoup, target_url: str) -> List[Finding]:
        """
        BDDK Elektronik Bankacılık Hizmetleri (Kimlik Doğrulama & Çift Faktör Standartları):
        Kimlik doğrulama formları HTTPS üzerinde olmalı ve CSRF koruması içermelidir.
        """
        findings: List[Finding] = []

        password_inputs = soup.find_all("input", attrs={"type": lambda t: t and t.lower() == "password"})
        if not password_inputs:
            return findings

        for pwd in password_inputs:
            form = pwd.find_parent("form")
            if not form:
                continue

            action = form.get("action", "").strip()
            # Insecure cleartext action
            if action.lower().startswith("http://"):
                findings.append(
                    Finding(
                        id="BDDK_INSECURE_AUTH_TRANSMISSION",
                        category=Category.SECURITY,
                        severity=Severity.CRITICAL,
                        title="BDDK Kritik İhlal: Parola Formunun Şifresiz HTTP ile İletimi",
                        description=f"Kimlik doğrulama formu verileri şifresiz HTTP uç noktasına ({action}) postalanıyor.",
                        remediation="Form action hedefini mutlaka TLS 1.3 / HTTPS korumalı bir uç noktaya çevirin.",
                        risk_impact="Yerel ağ dinleyicileri ve ortadaki adam (MitM) saldırganları bankacılık parolalarını açık metin olarak ele geçirebilir.",
                        target_location="<form action='...'>",
                        compliance_standard="BDDK Elektronik Bankacılık Hizmetleri (Kimlik Doğrulama)",
                        sector_relevance=[SectorType.FINTECH_BANKING],
                    )
                )
                break

            # Anti-CSRF token check in authentication / financial transaction forms
            csrf_inputs = form.find_all(
                "input",
                attrs={"name": lambda n: n and any(k in n.lower() for k in ("csrf", "token", "_token", "authenticity_token"))}
            )
            if not csrf_inputs:
                findings.append(
                    Finding(
                        id="BDDK_MISSING_CSRF_PROTECTION",
                        category=Category.SECURITY,
                        severity=Severity.HIGH,
                        title="BDDK Uyumsuzluğu: Kimlik Doğrulama Formunda Eksik CSRF Koruması",
                        description="Kritik giriş veya işlem formunda anti-CSRF token doğrulama parametresi tespit edilemedi.",
                        remediation="Her oturum veya istek için kriptografik olarak güvenli bir CSRF token üretin ve form submit edildiğinde doğrulayın.",
                        risk_impact="Saldırganlar kullanıcı adına yetkisiz finansal işlemler veya talimatlar tetikleyebilir.",
                        target_location="<form>",
                        compliance_standard="BDDK Bilgi Sistemleri Yönetmeliği (Md. 33)",
                        sector_relevance=[SectorType.FINTECH_BANKING],
                    )
                )
                break

        return findings

    async def _check_bddk_open_banking_api(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        """
        BKM Açık Bankacılık GEÇİT & BDDK Standartları:
        Açık Bankacılık API uç noktalarında yetkisiz erişim, mTLS gereksinimi ve CORS politikası denetimi.
        """
        findings: List[Finding] = []
        open_banking_paths = ["/open-banking/v1", "/bkm/gecit", "/api/v1/accounts", "/api/psd2"]

        for path in open_banking_paths:
            probe_url = urljoin(target_url, path)
            try:
                resp = await client.get(probe_url, timeout=3.0)
                # If an open banking endpoint responds with 200 OK without authentication
                if resp.status_code == 200:
                    acao = resp.headers.get("access-control-allow-origin", "")
                    if acao == "*":
                        findings.append(
                            Finding(
                                id="BDDK_OPEN_BANKING_PERMISSIVE_CORS",
                                category=Category.SECURITY,
                                severity=Severity.HIGH,
                                title="BKM Açık Bankacılık Standart İhlali: API'de Wildcard CORS",
                                description=(
                                    f"Açık bankacılık uç noktası ({path}) herkese açık 'Access-Control-Allow-Origin: *' başlığı dönüyor. "
                                    "BKM GEÇİT standartlarına göre finansal API'lerde wildcard CORS kesinlikle yasaktır."
                                ),
                                remediation="Açık bankacılık API uç noktalarında yalnızca yetkilendirilmiş Fintek (ÖHS/YHB) sertifikalı alan adlarına izin verin.",
                                risk_impact="Kötü amaçlı web siteleri kullanıcının açık oturumunu sömürerek hesap veya bakiye bilgilerini okuyabilir.",
                                evidence={"endpoint": probe_url, "access_control_allow_origin": acao},
                                target_location=path,
                                compliance_standard="BKM Açık Bankacılık & BDDK API Standartları",
                                sector_relevance=[SectorType.FINTECH_BANKING],
                            )
                        )
                        break
            except Exception:
                continue

        return findings

