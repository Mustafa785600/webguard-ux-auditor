import type { Finding, Severity, Category, RCACategory, SectorType } from "@/types/scan";

export type Language = "en" | "tr";

export const SECTOR_LABELS: Record<
  Language,
  Record<SectorType, { name: string; standard: string; icon: string }>
> = {
  tr: {
    AUTO: { name: "Otomatik Tespit", standard: "Akıllı Sektör Analizi", icon: "✨" },
    GENERAL: { name: "Genel Web", standard: "Standart Güvenlik", icon: "🌐" },
    ECOMMERCE: { name: "E-Ticaret & Finans", standard: "PCI-DSS v4.0", icon: "🛒" },
    HEALTHCARE: { name: "Sağlık & Medikal", standard: "HIPAA & Hasta Gizliliği", icon: "🏥" },
    CORPORATE_GOV: { name: "Kurumsal & Kamu", standard: "KVKK & GDPR", icon: "🏛️" },
    SAAS_API: { name: "SaaS & Teknoloji", standard: "OWASP API Top 10", icon: "⚡" },
    FINTECH_BANKING: { name: "Bankacılık & Fintek", standard: "BDDK & Açık Bankacılık", icon: "🏦" },
  },
  en: {
    AUTO: { name: "Auto-Detect", standard: "Smart Sector Analysis", icon: "✨" },
    GENERAL: { name: "General Web", standard: "Baseline Security", icon: "🌐" },
    ECOMMERCE: { name: "E-Commerce & Finance", standard: "PCI-DSS v4.0", icon: "🛒" },
    HEALTHCARE: { name: "Healthcare & MedTech", standard: "HIPAA & Health Privacy", icon: "🏥" },
    CORPORATE_GOV: { name: "Corporate & Gov", standard: "GDPR & KVKK", icon: "🏛️" },
    SAAS_API: { name: "SaaS & Technology", standard: "OWASP API Top 10", icon: "⚡" },
    FINTECH_BANKING: { name: "Banking & Fintech", standard: "BDDK & Open Banking", icon: "🏦" },
  },
};

export const UI_STRINGS: Record<Language, Record<string, string>> = {
  en: {
    heroBadge: "🛡️ Security & UX Audit Platform",
    heroTitle: "Scan. Detect. Remediate.",
    heroSubtitle:
      "Instantly audit any website for security vulnerabilities, UX deficiencies, accessibility issues, and autonomous E2E workflows.",
    urlPlaceholder: "https://example.com",
    btnScan: "Scan",
    btnScanning: "Scanning…",
    recentAudits: "Recent Audits",
    quickTargets: "Quick Test Targets",
    clear: "Clear",
    scanningMsg: "Running all security, UX and network checks in parallel",
    scanned: "Scanned:",
    exportJson: "📥 Export JSON",
    printPdf: "🖨️ Print / PDF",
    securityScore: "Security Score",
    uxScore: "UX Score",
    filterCategory: "Category:",
    filterSeverity: "Severity:",
    filterRca: "Root Cause (RCA):",
    findingsSection: "Findings",
    showing: "Showing",
    of: "of",
    issues: "issue(s)",
    noIssues: "No issues match the selected filters.",
    // FindingCard
    riskLabel: "RISK & IMPACT ANALYSIS",
    deficientLabel: "CURRENT DEFICIENT CODE",
    fixLabel: "RECOMMENDED FIX (SOLUTION)",
    remediationLabel: "REMEDIATION GUIDANCE",
    rawLog: "Technical Evidence (Raw Log)",
    copyCode: "📋 Copy Code",
    copied: "✓ Copied",
    serverBlock: "Server Block Context",
    line: "Line",
    targetFile: "Target File",
    interactionLog: "Autonomous Agent Interaction Log",
    beforeInteraction: "📸 Before Interaction",
    afterInteraction: "📸 After Interaction",
    // TestSprite Failure Diagnostic Bundle
    diagnosticBundleTitle: "TestSprite Failure Diagnostic Bundle",
    diagnosticBundleSubtitle: "Before/After visual evidence, reproduction trace, and AI root cause hypothesis.",
    beforeState: "📸 Before (Baseline)",
    afterState: "💥 After (Anomaly / Triggered)",
    reproductionTrace: "👣 Step-by-Step Reproduction Trace",
    domSnapshot: "🧬 Offending Element / Network Trigger",
    rootCauseHypothesis: "🧠 AI Root Cause Hypothesis",
    copyForIde: "📋 Copy Diagnostic Bundle for Cursor / Claude Code",
    copiedForIde: "✓ Copied Diagnostic JSON! (Paste directly to AI IDE)",
    viewSideBySide: "Side-by-Side (Split)",
    viewTabbed: "Tabbed",
    zoomInspect: "🔍 Zoom & Inspect",
    // PRD Card
    prdTitle: "TestSprite PRD-Driven AI Test Intelligence",
    prdSubtitle: "Synthesize user roles, edge cases, and executable Playwright test suites directly from specifications.",
    generateSuite: "✨ Generate Playwright E2E Suite",
    generatingSuite: "Synthesizing AI Scenarios…",
    // Network Waterfall
    waterfallTitle: "Network Activity & API Contract Waterfall",
    requests: "Requests",
    avgLatency: "Avg:",
    slow: "Slow",
    failed: "Failed",
    // Crawler & Site Graph
    crawlerToggle: "🕸️ Autonomous Deep Crawler",
    crawlerSubtitle: "Multi-page route discovery, form interaction & site graph",
    pageBudget: "Page Budget",
    crawlDepth: "Depth",
    tabFindings: "Findings & Issues",
    tabPrd: "TestSprite PRD Intelligence",
    tabCrawlGraph: "Site Map & Route Graph",
    tabAutoHeal: "Auto-Heal & Flaky Tests",
    tabPerformance: "⚡ Load & Performance (SLA)",
    pagesExplored: "Pages Explored",
    routesDiscovered: "Internal Routes",
    formsButtonsTested: "Forms & Controls Tested",
    routeFailures: "Route Failures",
    filterByRoute: "Filter findings for this route",
    allRoutes: "All Routes",
    crawlEmptyNotice: "Autonomous Deep Crawler was not enabled for this scan. Toggle 'Autonomous Deep Crawler' before scanning to explore multiple pages and generate a live route graph.",
  },
  tr: {
    heroBadge: "🛡️ Güvenlik & UX Denetim Platformu",
    heroTitle: "Tara. Tespit Et. Çöz.",
    heroSubtitle:
      "Herhangi bir web sitesini güvenlik açıkları, kullanıcı deneyimi (UX) eksiklikleri, erişilebilirlik ve otonom E2E testleri için anında denetleyin.",
    urlPlaceholder: "https://ornek-site.com",
    btnScan: "Taramayı Başlat",
    btnScanning: "Taranıyor…",
    recentAudits: "Son Denetimler",
    quickTargets: "Hızlı Test Hedefleri",
    clear: "Temizle",
    scanningMsg: "Tüm güvenlik, UX ve ağ denetimleri eş zamanlı çalıştırılıyor",
    scanned: "Taranan:",
    exportJson: "📥 JSON Olarak İndir",
    printPdf: "🖨️ Yazdır / PDF",
    securityScore: "Güvenlik Skoru",
    uxScore: "UX Skoru",
    filterCategory: "Kategori:",
    filterSeverity: "Önem Derecesi:",
    filterRca: "Kök Neden (RCA):",
    findingsSection: "Bulgular ve Açıklar",
    showing: "Gösterilen:",
    of: "/",
    issues: "bulgu",
    noIssues: "Seçili filtrelere uygun bulgu bulunamadı.",
    // FindingCard
    riskLabel: "RİSK VE ETKİ ANALİZİ",
    deficientLabel: "MEVCUT EKSİK / HATALI KOD",
    fixLabel: "ÖNERİLEN DÜZELTME (ÇÖZÜM)",
    remediationLabel: "ÇÖZÜM VE İYİLEŞTİRME REHBERİ",
    rawLog: "Teknik Kanıt (Ham Log Kaydı)",
    copyCode: "📋 Kodu Kopyala",
    copied: "✓ Kopyalandı",
    serverBlock: "Sunucu Yapılandırma Bloğu",
    line: "Satır",
    targetFile: "Hedef Dosya",
    interactionLog: "Otonom Ajan Etkileşim Günlüğü",
    beforeInteraction: "📸 Etkileşim Öncesi",
    afterInteraction: "📸 Etkileşim Sonrası",
    // TestSprite Failure Diagnostic Bundle
    diagnosticBundleTitle: "TestSprite Zengin Hata Teşhis Paketi (Diagnostic Bundle)",
    diagnosticBundleSubtitle: "Öncesi / Sonrası ekran görüntüleri, adım adım hata izi ve yapay zeka kök neden teşhisi.",
    beforeState: "📸 Öncesi (Temel Durum)",
    afterState: "💥 Sonrası (Hata / Anomali Tetiklendi)",
    reproductionTrace: "👣 Adım Adım Yeniden Üretim İzi (Reproduction Trace)",
    domSnapshot: "🧬 Hatalı DOM Düğümü / Ağ Tetikleyicisi",
    rootCauseHypothesis: "🧠 Yapay Zeka Kök Neden Hipotezi (RCA Hypothesis)",
    copyForIde: "📋 Cursor / Claude Code İçin Teşhis Paketini Kopyala",
    copiedForIde: "✓ JSON Teşhis Paketi Kopyalandı! (IDE promptuna yapıştırın)",
    viewSideBySide: "Yan Yana (Split)",
    viewTabbed: "Sekmeli",
    zoomInspect: "🔍 Büyüt & İncele",
    // PRD Card
    prdTitle: "TestSprite PRD Destekli Yapay Zeka Test Zekası",
    prdSubtitle: "İş gereksinimlerinden (PRD) kullanıcı rollerini, uç durumları ve çalıştırılabilir Playwright test paketlerini otonom üretin.",
    generateSuite: "✨ Playwright E2E Test Paketini Üret",
    generatingSuite: "Yapay Zeka Senaryoları Derleniyor…",
    // Network Waterfall
    waterfallTitle: "Ağ İletişimi & API Sözleşme Şelalesi (Waterfall)",
    requests: "İstek",
    avgLatency: "Ortalama:",
    slow: "Yavaş",
    failed: "Hatalı",
    // Crawler & Site Graph
    crawlerToggle: "🕸️ Otonom Site Gezgini (Deep Crawler)",
    crawlerSubtitle: "Çok sayfalı gezinme, form etkileşimleri ve rota haritası analizi",
    pageBudget: "Sayfa Limiti",
    crawlDepth: "Derinlik",
    tabFindings: "Bulgular & Açıklar",
    tabPrd: "TestSprite PRD Zekası",
    tabCrawlGraph: "Site Haritası & Rota Ağacı",
    tabAutoHeal: "Otonom E2E Auto-Heal",
    tabPerformance: "⚡ Yük & Performans (SLA)",
    pagesExplored: "Taranan Sayfa",
    routesDiscovered: "Dahili Rota",
    formsButtonsTested: "Test Edilen Form & Buton",
    routeFailures: "Kritik Rota Hatası",
    filterByRoute: "Bu rotadaki bulguları filtrele",
    allRoutes: "Tüm Rotalar",
    crawlEmptyNotice: "Otonom Gezgin bu taramada etkinleştirilmedi. Sitedeki çok sayfalı rotaları keşfetmek ve interaktif site haritası çıkarmak için tarama öncesi 'Otonom Site Gezgini' seçeneğini işaretleyiniz.",
  },
};

export const CATEGORY_LABELS: Record<Language, Record<"ALL" | Category, string>> = {
  en: { ALL: "ALL", SECURITY: "SECURITY", UX: "UX" },
  tr: { ALL: "TÜMÜ", SECURITY: "GÜVENLİK", UX: "KULLANICI DENEYİMİ (UX)" },
};

export const SEVERITY_LABELS: Record<Language, Record<"ALL" | Severity, string>> = {
  en: { ALL: "ALL", CRITICAL: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", INFO: "INFO" },
  tr: { ALL: "TÜMÜ", CRITICAL: "KRİTİK", HIGH: "YÜKSEK", MEDIUM: "ORTA", LOW: "DÜŞÜK", INFO: "BİLGİ" },
};

export const RCA_LABELS: Record<Language, Record<"ALL" | RCACategory, string>> = {
  en: {
    ALL: "ALL",
    REAL_BUG: "REAL BUG",
    TEST_FRAGILITY: "TEST FRAGILITY",
    ENV_ISSUE: "ENV ISSUE",
    EXPECTED_BEHAVIOR: "EXPECTED BEHAVIOR",
  },
  tr: {
    ALL: "TÜMÜ",
    REAL_BUG: "GERÇEK UYGULAMA HATASI",
    TEST_FRAGILITY: "TEST KIRILGANLIĞI",
    ENV_ISSUE: "ORTAM / SUNUCU SORUNU",
    EXPECTED_BEHAVIOR: "BEKLENEN DAVRANIŞ",
  },
};

// Turkish Translations for Scan Findings
interface FindingTranslation {
  title: string;
  description: string;
  risk_impact?: string;
  remediation: string;
}

const FINDING_TRANSLATIONS_TR: Record<string, FindingTranslation> = {
  SEC_HSTS_MISSING: {
    title: "Eksik HTTP Sıkı Aktarım Güvenliği (HSTS)",
    description: "Web sunucusu, Strict-Transport-Security başlığı aracılığıyla HTTPS bağlantılarını zorunlu kılmıyor.",
    risk_impact:
      "HSTS olmadan yerel ağdaki (örneğin halka açık Wi-Fi) saldırganlar SSL stripping saldırısı yaparak bağlantıyı şifresiz HTTP'ye düşürebilir ve oturum çerezleri ile kullanıcı parolalarını ele geçirebilir.",
    remediation:
      "HTTPS kullanımını zorunlu kılmak ve protokol düşürme saldırılarını önlemek için tüm sunucu yanıtlarına Strict-Transport-Security başlığını ekleyin.",
  },
  SEC_CSP_MISSING: {
    title: "Eksik İçerik Güvenlik Politikası (CSP)",
    description: "İçerik Güvenlik Politikası (CSP) başlığı tanımlanmamış; bu durum XSS ve veri enjeksiyonu açıklarının etkisini artırır.",
    risk_impact:
      "CSP olmadan tarayıcı sayfaya enjekte edilen tüm betikleri çalıştırır, bu da XSS açıklarının etkisini, oturum hırsızlığını ve veri sızıntısı riskini katlar.",
    remediation:
      "Betiklerin, stillerin ve diğer kaynakların hangi güvenilir kaynaklardan yüklenebileceğini belirten kısıtlayıcı bir Content-Security-Policy başlığı tanımlayın.",
  },
  SEC_CLICKJACKING_RISK: {
    title: "Eksik Clickjacking Koruması",
    description: "Sayfanın iframe içine gömülmesini önleyecek X-Frame-Options veya CSP frame-ancestors direktifi yapılandırılmamış.",
    risk_impact:
      "Saldırganlar bu siteyi kötü niyetli bir etki alanında şeffaf bir <iframe> içine gömerek kullanıcıları gizli butonlara tıklatabilir veya istem dışı işlemler yaptırabilir (UI Redressing).",
    remediation:
      "X-Frame-Options başlığını DENY veya SAMEORIGIN olarak ayarlayın ya da CSP içinde frame-ancestors direktifini tanımlayın.",
  },
  SEC_NOSNIFF_MISSING: {
    title: "Eksik X-Content-Type-Options Başlığı",
    description: "Eksik veya hatalı yapılandırılmış 'nosniff' direktifi, MIME türü koklama (sniffing) saldırılarına izin verir.",
    risk_impact:
      "Tarayıcılar dosyanın içeriğine bakarak MIME türünü tahmin etmeye çalışabilir ve çalıştırılamaz dosyaları (örneğin resimleri) zararlı JavaScript olarak yorumlayıp çalıştırabilir.",
    remediation:
      "Tarayıcıların bildirilen MIME türlerine kesinlikle uymasını sağlamak için X-Content-Type-Options başlığını 'nosniff' olarak ayarlayın.",
  },
  SEC_REFERRER_POLICY_MISSING: {
    title: "Eksik Referrer-Policy Başlığı",
    description: "Sunucu bir Referrer-Policy başlığı tanımlamamış; bu durum hassas URL yollarının ve sorgu parametrelerinin üçüncü taraf etki alanlarına sızmasına neden olabilir.",
    risk_impact:
      "Açık bir politika olmadığında kullanıcılar dış bağlantılara tıkladığında oturum token'ları, e-posta adresleri veya dahili parametreleri içeren tam URL yolları Referer başlığıyla harici sunuculara sızdırılabilir.",
    remediation:
      "Referans bilgilerini sınırlandırmak için 'Referrer-Policy' başlığını 'strict-origin-when-cross-origin' veya 'no-referrer' olarak yapılandırın.",
  },
  SEC_INSECURE_REFERRER_POLICY: {
    title: "Güvensiz Referrer-Policy ('unsafe-url')",
    description: "Referrer-Policy değeri 'unsafe-url' olarak ayarlanmış; protokol güvenliğine bakılmaksızın tüm hedeflere tam URL yolu ve parametreleri gönderilir.",
    risk_impact:
      "'unsafe-url' ayarı, şifresiz HTTP bağlantıları dahil tüm çapraz etki alanı isteklerinde gizli URL parametrelerini açıkça ifşa eder.",
    remediation:
      "Referrer-Policy değerini güvenli olan 'strict-origin-when-cross-origin' veya 'no-referrer' ile değiştirin.",
  },
  SEC_PERMISSIONS_POLICY_MISSING: {
    title: "Eksik Permissions-Policy Başlığı",
    description: "Web sunucusu, hassas tarayıcı yeteneklerini (kamera, mikrofon, konum) kısıtlayacak bir Permissions-Policy başlığı sunmuyor.",
    risk_impact:
      "Permissions-Policy başlığı olmadan sayfaya gömülen iframe'ler veya ele geçirilmiş üçüncü taraf kütüphaneler kamera, mikrofon veya coğrafi konum gibi yüksek yetkili API'lere kontrolsüz erişim talep edebilir.",
    remediation:
      "Hassas tarayıcı API'lerine erişimi kısıtlayan bir Permissions-Policy başlığı ekleyin (örneğin: camera=(), microphone=(), geolocation=()).",
  },
  SEC_SERVER_INFO_LEAK: {
    title: "Sunucu Sürümü / Teknoloji Sızıntısı",
    description: "Sunucu, yanıt başlıklarında teknoloji ve sürüm imzalarını ifşa ediyor.",
    risk_impact:
      "Sunucu yazılımı ve kesin sürüm numaralarının ifşa edilmesi, otomatik tarayıcıların ve saldırganların yamalanmamış CVE açıklarını tespit edip hedef almasını kolaylaştırır.",
    remediation: "Web sunucusu yapılandırmasında 'Server' ve 'X-Powered-By' başlıklarını gizleyin veya kaldırın.",
  },
  SEC_INSECURE_COOKIE: {
    title: "Güvensiz Çerez Yapılandırması",
    description: "Tarayıcıya gönderilen çerezlerde 'Secure', 'HttpOnly' veya 'SameSite' güvenlik bayrakları eksik veya hatalı yapılandırılmış.",
    risk_impact:
      "'Secure' bayrağı olmayan çerezler şifresiz HTTP trafiğinde dinlenebilir. 'HttpOnly' olmayan çerezler XSS saldırılarında JavaScript ile çalınabilir. 'SameSite' bayrağı eksik veya uygunsuz çerezler ise siteler arası istek sahteciliği (CSRF) saldırılarına kapı aralar.",
    remediation:
      "Tüm oturum ve kimlik doğrulama çerezlerinde 'Secure', 'HttpOnly' ve 'SameSite=Lax' veya 'SameSite=Strict' bayraklarını zorunlu kılın.",
  },
  SEC_EXPOSED_DB_DUMP: {
    title: "Açıkta Veritabanı Dökümü (.sql)",
    description: "Web kök dizininde herkese açık SQL veritabanı dökümü tespit edildi; tüm tablolar ve kayıtlar ifşa durumdadır.",
    risk_impact:
      "Saldırganlar doğrudan veritabanı dosyasını indirerek kullanıcı kimlik bilgilerine, parola özetlerine (hash), kişisel verilere (KVKK/GDPR) ve ticari sırlara anında erişebilir.",
    remediation:
      "Veritabanı döküm dosyalarını derhal sunucudan silin. Web sunucusunda .sql uzantılı dosyalara erişimi yasaklayın ve yedekleri sadece şifreli, izole depolama alanlarında tutun.",
  },
  SEC_EXPOSED_BACKUP_ARCHIVE: {
    title: "Açıkta Sıkıştırılmış Yedek Arşivi (.zip / .tar.gz)",
    description: "Web sunucusunda herkese açık sıkıştırılmış kaynak kod ve site yedek arşivi tespit edildi.",
    risk_impact:
      "Uygulamanın kaynak kodları, sunucu konfigürasyonları, gizli API anahtarları ve mimari yapısı saldırganlar tarafından indirilip incelenebilir.",
    remediation:
      "Arşiv dosyalarını web kök dizininden kaldırın ve web sunucusunda .zip, .tar, .gz gibi arşiv formatlarına HTTP üzerinden erişimi engelleyin.",
  },
  SEC_TABNABBING_RISK: {
    title: "Tersine Tabnabbing (Reverse Tabnabbing) Güvenlik Açığı",
    description: "Yeni sekmede açılan (target='_blank') bağlantılarda 'rel=\"noopener noreferrer\"' güvenlik özniteliği eksik.",
    risk_impact:
      "Yeni sekmede açılan hedef web sayfası 'window.opener' DOM nesnesine erişebilir ve kullanıcının arkada kalan orijinal sekmesini sahte bir kimlik avı (phishing) sayfasına gizlice yönlendirebilir.",
    remediation:
      "Yeni sekmede açılan tüm <a> bağlantılarına rel=\"noopener noreferrer\" özniteliğini ekleyerek çapraz pencere erişimini izole edin.",
  },
  SEC_HTTP_NO_REDIRECT: {
    title: "HTTP'den HTTPS'e Otomatik Yönlendirme Eksik",
    description: "Sunucu, port 80 üzerinden gelen düz metin HTTP isteklerini HTTPS'e yönlendirmeden doğrudan sunuyor.",
    risk_impact:
      "Kullanıcılar adresi 'https://' yazmadan girdiğinde trafik şifresiz iletilir; yerel ağdaki saldırganlar SSL stripping saldırısı yaparak kullanıcı parolalarını ve oturum çerezlerini kolayca çalabilir.",
    remediation:
      "Web sunucusunun 80 numaralı port yapılandırmasında tüm gelen istekleri '301 Moved Permanently' ile 'https://' protokolüne yönlendirin.",
  },
  SEC_HTTP_TEMPORARY_REDIRECT: {
    title: "HTTP'den HTTPS'e Geçici Yönlendirme (302/307)",
    description: "Sunucu, HTTP'den HTTPS'e yükseltme için kalıcı (301/308) yerine geçici (302/307) yönlendirme kodu kullanıyor.",
    risk_impact:
      "Geçici yönlendirmeler tarayıcılar tarafından önbelleğe alınmaz. Kullanıcıların her ziyaretinde tarayıcı ilk önce şifresiz HTTP isteği gönderir ve bu durum ağ dinleme saldırılarına açık kapı bırakır.",
    remediation:
      "Yönlendirme durum kodunu '301 Moved Permanently' veya '308 Permanent Redirect' olarak güncelleyin.",
  },
  SEC_STACK_TRACE_DISCLOSURE: {
    title: "Stack Trace / Hata ve Debug Ekranı Sızıntısı",
    description: "Sunucu hata yanıtlarında ayrıntılı kod yığın izleri (stack trace), veritabanı sürücü hataları veya framework hata ayıklama (debug) ekranlarını ifşa ediyor.",
    risk_impact:
      "Ayrıntılı hata ekranları; sunucudaki mutlak dosya yollarını, veritabanı tablo isimlerini, kaynak kod parçalarını ve kütüphane sürümlerini ifşa eder. Saldırganlar bu mimari haritayı kullanarak hedefe yönelik güvenlik açığı sömürüleri geliştirir.",
    remediation:
      "Canlı (production) ortamda hata ayıklama modunu tamamen kapatın (DEBUG=False, display_errors=Off). İstisnaları yakalayan ve yığın izi içermeyen genel, güvenli özel 500 hata sayfaları yapılandırın.",
  },
  QA_SLOW_API_ENDPOINT: {
    title: "Yavaş API Yanıtı Tespit Edildi (> 2000ms)",
    description: "Arka plan API isteği 2000ms eşiğini aşarak kullanıcı deneyiminde gecikmeye yol açtı.",
    risk_impact:
      "Yavaş API yanıtları kullanıcı arayüzünde donmalara, tamamlanmayan işlemlere ve yüksek terk oranlarına (bounce rate) neden olur.",
    remediation:
      "Sunucu tarafı önbelleğe alma (Redis), veritabanı sorgu indeksleme ve ağır hesaplamaları arka plan işçilerine devretme yöntemlerini uygulayın.",
  },
  QA_INSECURE_CORS_POLICY: {
    title: "API Yolunda Joker (*) Access-Control-Allow-Origin İzni",
    description:
      "API rotası 'Access-Control-Allow-Origin: *' ile yanıt vererek herhangi bir üçüncü taraf etki alanının çapraz istek yapmasına olanak tanıyor.",
    risk_impact:
      "Aşırı izinli CORS başlıkları, kullanıcı oturum açmışken zararlı sitelerin kullanıcının özel verilerini API'den okumasına yol açabilir.",
    remediation: "Joker '*' yerine yalnızca güvenilir etki alanlarını beyaz listeye alın.",
  },
  QA_RUNTIME_JS_CRASH: {
    title: "Tarayıcıda İşlenmemiş Çalışma Zamanı JavaScript Hatası",
    description: "Sayfa yürütülürken işlenmemiş bir JavaScript istisnası meydana geldi.",
    risk_impact: "Çalışma zamanı hataları istemci tarafı durumunu çökertir, butonları ve form gönderimlerini dondurur.",
    remediation: "Değişkenlere erişmeden önce null kontrolleri ekleyin ve React Error Boundary / try-catch blokları kullanın.",
  },
  QA_BROWSER_CONSOLE_ERRORS: {
    title: "Kritik Tarayıcı Konsol Hataları Kaydedildi",
    description: "Sayfa yüklenirken tarayıcı konsoluna kritik hata mesajları yazıldı.",
    risk_impact: "Sürekli konsol hataları bozuk alt modüllere ve sessiz arayüz çökmelerine işaret eder.",
    remediation: "İstemci betiklerini bozuk içe aktarmalar ve işlenmemiş Promise retleri açısından inceleyin.",
  },
  QA_FAILED_API_ENDPOINT: {
    title: "Dahili API İsteği Başarısız Oldu (5xx / 4xx)",
    description: "Arka planda yapılan fetch/XHR isteği sunucu hatasıyla sonuçlandı.",
    risk_impact: "API çağrıları başarısız olduğunda kullanıcılar sonsuz yüklenme çarkları veya bozuk tablolar görür.",
    remediation: "Başarısız uç nokta için arka plan sunucu günlüklerini inceleyin ve veritabanı bağlantılarını kontrol edin.",
  },
  QA_PLAYWRIGHT_E2E_SUITE: {
    title: "Otonom Playwright E2E Test Paketi Üretildi",
    description: "Otonom QA ajanı sayfayı keşfederek kullanıma hazır bir Playwright E2E test betiği üretti.",
    risk_impact: "Otomatik E2E testleri olmadan sonraki güncellemeler ve sürümler kullanıcı akışlarını sessizce bozabilir.",
    remediation: "Bu test dosyasını e2e test paketinize kaydedin ve CI/CD hattınızda 'npx playwright test' ile çalıştırın.",
  },
  QA_NETWORK_WATERFALL_SUMMARY: {
    title: "Ağ İletişimi Waterfall Analizi Tamamlandı",
    description: "Sayfadaki tüm ağ istekleri analiz edildi, ortalama gecikme ve başarısız istekler profillendi.",
    risk_impact: "Optimize edilmemiş ağ zincirleri sayfa yüklenme süresini (LCP) ve etkileşim hızını (TTI) geciktirir.",
    remediation: "Yüksek gecikmeli istekleri inceleyin, HTTP/2/3 çoğullamayı etkinleştirin ve kritik kaynakları önceden bağlayın.",
  },
  QA_SELF_HEALING_REPAIRED: {
    title: "Self-Healing: Kırılgan Seçici Otomatik Onarıldı",
    description: "Orijinal seçici DOM'da bulunamadı; otonom onarım motoru alternatif bir seçici ile testi başarıyla sürdürdü.",
    risk_impact: "Kırılgan seçiciler küçük CSS/tasarım değişikliklerinde CI/CD testlerinin yanlış alarmla kırılmasına neden olur.",
    remediation: "Bileşen işaretlemenize kalıcı data-testid veya aria-label öznitelikleri ekleyin.",
  },
  UX_VIEWPORT_MISSING: {
    title: "Eksik Viewport Meta Etiketi",
    description: "Mobil uyumlu duyarlı tasarımı sağlayan <meta name='viewport'> etiketi eksik.",
    risk_impact: "Mobil cihazlarda sayfa masaüstü ölçeğinde küçülerek okunamaz ve tıklanamaz hale gelir.",
    remediation: "HTML belgesinin <head> kısmına <meta name='viewport' content='width=device-width, initial-scale=1.0'> ekleyin.",
  },
  UX_TITLE_MISSING: {
    title: "Eksik Sayfa Başlığı (<title>)",
    description: "HTML belgesinde <title> etiketi bulunamadı.",
    risk_impact: "Eksik başlık, SEO sıralamalarını düşürür ve tarayıcı sekmelerinde sitenin tanınmasını zorlaştırır.",
    remediation: "<head> etiketi içine açıklayıcı bir <title> etiketi ekleyin.",
  },
  UX_IMG_ALT_MISSING: {
    title: "Görsellerde Eksik Alt Açıklama Etiketi",
    description: "Sayfadaki görsellerde görme engelliler ve SEO için gerekli alt='' özniteliği eksik.",
    risk_impact: "Ekran okuyucu kullanan engelli kullanıcılar görselin içeriğini anlayamaz ve WCAG erişilebilirlik standartları ihlal edilir.",
    remediation: "Tüm <img> etiketlerine anlamlı 'alt' öznitelikleri ekleyin.",
  },
  UX_BUTTON_EMPTY: {
    title: "Erişilebilirlik: İsimsiz / Boş Buton",
    description: "Ekran okuyucuların anlayabileceği metin veya aria-label içermeyen buton bulundu.",
    risk_impact: "Görme engelli kullanıcılar butonun ne işe yaradığını bilemez.",
    remediation: "Butonun içine metin veya 'aria-label' özniteliği ekleyin.",
  },
  UX_BROKEN_LINKS: {
    title: "Kırık Bağlantı / Yüklenemeyen Varlık",
    description: "Sayfada 404 dönen veya ulaşılamayan bağlantılar tespit edildi.",
    risk_impact: "Kırık bağlantılar kullanıcıların sitede kaybolmasına ve arama motoru puanlarının düşmesine neden olur.",
    remediation: "Tüm köprüleri ve resim kaynaklarını kontrol ederek geçerli URL'ler ile güncelleyin.",
  },
  PERF_LATENCY_SLA_BREACH: {
    title: "Kritik Yanıt Süresi (Latency SLA) İhlali",
    description: "Sunucu P95 yanıt süresi ve ortalama gecikme kurumsal SLA standardı olan 500ms sınırını aşıyor.",
    risk_impact: "Yüksek yanıt süresi e-ticaret ve fintek sistemlerinde kullanıcı terk oranını artırır ve BDDK yanıt süresi SLA taahhütlerinin ihlaline yol açar.",
    remediation: "Ters vekil (reverse proxy) önbellekleme (Nginx cache), veritabanı indekslemesi veya CDN kenar önbelleklemesini etkinleştirin.",
  },
  PERF_CONCURRENT_STRESS_FAILURE: {
    title: "Eşzamanlı Yük Altında İstek Hataları",
    description: "Hafif eşzamanlı yük altında isteklerin bir kısmı başarısız oldu veya zaman aşımına uğradı.",
    risk_impact: "Kullanıcı trafiği aniden arttığında sistem yanıt veremez hale gelir ve 502/504 hataları üretir.",
    remediation: "Web sunucusu bağlantı havuzunu artırın, rate-limiting ve auto-scaling yapılandırın.",
  },
  PERF_NO_COMPRESSION: {
    title: "Eksik Yanıt Sıkıştırması (Gzip / Brotli)",
    description: "Sunucu yanıtlarında Gzip veya Brotli içerik sıkıştırması (Content-Encoding) etkinleştirilmemiş.",
    risk_impact: "Sıkıştırılmamış metin yanıtları bant genişliğini tüketir ve mobil cihazlarda sayfa yükleme süresini uzatır.",
    remediation: "Nginx, Apache veya CDN seviyesinde Gzip/Brotli sıkıştırmasını etkinleştirin.",
  },
  BDDK_INSECURE_SESSION_COOKIE: {
    title: "BDDK Md. 31: Güvensiz Oturum Çerezi Yapılandırması",
    description: "Oturum yönetimi çerezlerinde Secure, HttpOnly ve SameSite bayrakları zorunludur.",
    risk_impact: "Oturum çerezinde HttpOnly eksikliği XSS ile oturum çalınmasına (Session Hijacking), SameSite eksikliği ise CSRF ile yetkisiz transfere yol açar.",
    remediation: "Set-Cookie başlığında 'Secure; HttpOnly; SameSite=Strict' direktiflerini zorunlu kılın.",
  },
  BDDK_UNMASKED_IBAN_EXPOSURE: {
    title: "BDDK Md. 34: Maskelenmemiş IBAN Bilgisi",
    description: "Sayfa içeriğinde maskelenmemiş açık Türk IBAN numarası tespit edildi.",
    risk_impact: "Açık IBAN bilgileri sosyal mühendislik ve BDDK/KVKK denetimlerinde ağır idari cezalara yol açar.",
    remediation: "Arayüzde gösterilen tüm IBAN numaralarını yalnızca ilk 4 ve son 4 hanesi görünecek şekilde maskeleyin.",
  },
  BDDK_UNMASKED_TCKN_EXPOSURE: {
    title: "Kritik Veri Sızıntısı: Maskelenmemiş T.C. Kimlik No",
    description: "Resmi TCKN algoritma doğrulamasını geçen açık kimlik numarası tespit edildi.",
    risk_impact: "TCKN sızıntısı KVKK Madde 12 ve BDDK Bilgi Sistemleri düzenlemelerine göre en üst düzey kritik güvenlik ihlalidir.",
    remediation: "Kullanıcı TCKN bilgilerini veritabanında şifreli saklayın ve web arayüzlerinde ilk 3 ve son 2 hane hariç maskeleyin.",
  },
  BDDK_INSECURE_AUTH_TRANSMISSION: {
    title: "BDDK Kritik: Parola Formunun Şifresiz İletimi",
    description: "Kimlik doğrulama formu verileri şifresiz HTTP uç noktasına postalanıyor.",
    risk_impact: "Ortadaki adam (MitM) saldırganları bankacılık parolalarını açık metin olarak ele geçirebilir.",
    remediation: "Form action hedefini mutlaka TLS 1.3 / HTTPS korumalı bir uç noktaya çevirin.",
  },
  BDDK_MISSING_CSRF_PROTECTION: {
    title: "BDDK Md. 33: Giriş Formunda Eksik CSRF Koruması",
    description: "Kritik giriş veya işlem formunda anti-CSRF token doğrulama parametresi tespit edilemedi.",
    risk_impact: "Saldırganlar kullanıcı adına yetkisiz finansal işlemler veya talimatlar tetikleyebilir.",
    remediation: "Her oturum veya istek için kriptografik olarak güvenli bir CSRF token üretin ve doğrulayın.",
  },
  BDDK_OPEN_BANKING_PERMISSIVE_CORS: {
    title: "BKM Açık Bankacılık İhlali: API'de Wildcard CORS",
    description: "Açık bankacılık uç noktası herkese açık Access-Control-Allow-Origin: * başlığı dönüyor.",
    risk_impact: "Kötü amaçlı web siteleri kullanıcının açık oturumunu sömürerek hesap veya bakiye bilgilerini okuyabilir.",
    remediation: "Yalnızca yetkilendirilmiş Fintek (ÖHS/YHB) lisanslı alan adlarını beyaz listeye alın.",
  },
};

export function localizeFinding(finding: Finding, lang: Language): Finding {
  if (lang === "en") return finding;

  const tr = FINDING_TRANSLATIONS_TR[finding.id];
  if (!tr) return finding;

  return {
    ...finding,
    title: tr.title,
    description: tr.description,
    risk_impact: tr.risk_impact || finding.risk_impact,
    remediation: tr.remediation,
  };
}

