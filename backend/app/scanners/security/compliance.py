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
        }

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
