# 🛡️ WebGuard - Proje Durumu ve Devir Özeti (Handover Document)

Bu belge, WebGuard projesinin mevcut mimarisini, tamamlanan tüm modülleri, kurumsal standart uyumluluklarını ve bir sonraki oturumda eksiksiz devam edebilmek için gereken bağlamı içerir.

---

## 📌 Genel Proje Bilgileri
- **Proje Adı:** WebGuard (Enterprise Autonomous Security, Performance & UX Quality Assurance Platform)
- **Teknoloji Yığını:**
  - **Backend:** FastAPI (Python 3.12), Playwright, HTTPX, Pydantic V2, Pytest
  - **Frontend:** Next.js 16 (App Router / Turbopack), React 19, TypeScript, Tailwind CSS
- **Git Durumu:** `main` branch, commit `8164834` (Çalışma dizini temiz, tüm testler geçiyor, GitHub senkronize).

---

## 🚀 Tamamlanan ve Canlıda Olan Modüller

### 1. Bütünsel Kod Tabanı ve Mimari Zeka (`CodebaseIntelligenceEngine`)
- Python AST ile tüm backend ve frontend kodlarını analiz eder.
- Mimari katmanları (`API_CONTROLLER`, `SERVICE_LOGIC`, `SECURITY_GUARD`, `DATA_MODEL`, `FRONTEND_UI`) tespit eder.
- Semboller arası bağımlılık grafını, etki yarıçapını (Blast Radius) ve uçtan uca veri akışlarını (FullStackFlows) çıkarır.
- **Arayüz:** `CodebaseIntelligenceView.tsx`

### 2. Core Web Vitals ve Sayfa Yükleme Performansı (`PlaywrightQAScanner` & `PerformanceBenchmarkEngine`)
- FCP (First Contentful Paint), LCP (Largest Contentful Paint), DOM Yükleme Süresi, TTFB, DOM Düğüm Sayısı ve Ağır Kaynakları (Heavy Assets) gerçek tarayıcı seviyesinde ölçer.
- Virgosol tarzı yük ve gecikme SLA testi (p50, p90, p95, p99, throughput).
- **Arayüz:** `PerformanceView.tsx`

### 3. WAF ve Hata Sızıntısı Direnç Testi (`WAFLeakageProbingEngine`)
- 8 temel sentetik saldırı probu (SQLi, XSS, Path Traversal, Bozuk JSON vb.) ile sunucu tepkilerini ölçer.
- WAF sağlayıcısını (Cloudflare, AWS WAF, Akamai, Imperva vb.) parmak izinden saptar.
- 500 çöküşleri ve kritik stack trace / veritabanı hata sızıntılarını yakalar.
- **Arayüz:** `WAFResilienceView.tsx`

### 4. Kaos Mühendisliği ve Ağ Hata Enjeksiyonu (`ChaosFaultInjectionEngine`)
- Tarayıcı seviyesinde ağ arızaları enjekte eder (HTTP 500, Latency Spike, Network Abort, Malformed JSON).
- Arayüzün zarafetle toparlanıp toparlanmadığını veya Beyaz Ekran Çöküşü (WSOD) yaşayıp yaşamadığını belirler.
- **Arayüz:** `ChaosEngineeringView.tsx`

### 5. Hız Sınırı ve Kaba Kuvvet Direnci (`RateLimitingAuditor`)
- OWASP API4:2023, BDDK Madde 34 ve PCI-DSS 8.3.4 kurumsal standartlarında.
- Kimlik doğrulama rotalarına zararsız sentetik istek patlamaları (burst requests) gönderir.
- HTTP 429 Too Many Requests, `Retry-After` ve standart `RateLimit-*` başlıklarını denetler.
- FastAPI (SlowAPI), Nginx (`limit_req_zone`) ve Express için hazır kod şablonları sunar.
- **Arayüz:** `RateLimitResilienceView.tsx`

### 6. Çoklu Cihaz ve Duyarlı Tasarım Denetimi (`ResponsiveLayoutAuditor`)
- Web sitelerini Mobil (390x844), Tablet (768x1024) ve Masaüstü (1920x1080) çözünürlüklerinde inceler.
- Yatay kaydırma çubuğu taşmasını (horizontal overflow) piksel bazında tespit eder.
- WCAG 2.5.5 ve Apple HIG gereğince 44x44px'den küçük dokunma hedeflerini işaretler.
- Her cihaz için görsel ekran görüntüsü (base64) yakalayarak cihaz mockup çerçevesi içinde sergiler.
- **Arayüz:** `MultiViewportView.tsx`

### 7. API Sözleşme ve Şema Sapması Denetimi (`APIContractDriftAuditor`)
- OpenAPI 3.0/3.1 ve Swagger spesifikasyonlarını otomatik keşfeder.
- Ön yüzün arka planla yaptığı gerçek zamanlı XHR/Fetch API çağrılarını (`network_traces`) sözleşmeyle karşılaştırır.
- Tip uyuşmazlıkları (Type Mismatch), zorunlu alan eksiklikleri (Missing Required Field) ve belgelenmemiş Gölge API'leri (Shadow APIs - OWASP API9) tespit eder.
- **Arayüz:** `APIContractDriftView.tsx`

### 8. Güvenlik Açığı Otomatik Doğrulaması (`DASTExploitVerifier`)
- OWASP Top 10 ve CWE standartlarında zararsız sentetik kanaryalar (benign canaries) koşturur.
- Yanlış pozitifleri (False Positives) güvenli şekilde ayıklar:
  * Reflected Input / Sanitizasyon ve XSS yansıması (CWE-79)
  * Hassas Dosya ve Konfigürasyon İfşası (.env, .git, backup, actuator - CWE-200)
  * Güvensiz CORS / Arbitrary Origin Yansıması (CWE-942)
  * Açık Yönlendirme (Open Redirect - CWE-601)
  * SSRF İç Ağ Filtreleme Direnci (CWE-918)
- **Arayüz:** `DASTVerificationView.tsx`

### 9. Canlı Yayın Paneli & CDP Screencast (`live_hub` & `CDPScreencastManager`)
- Chrome DevTools Protocol (CDP) üzerinden tarayıcının form doldurma, tıklama ve tarama anlarını WebSocket ile canlı yayınlar.
- **Arayüz:** `LiveScreencastPanel.tsx`

### 10. Otonom E2E Auto-Heal & Flaky Test İyileştirici (`SelfHealingEngine`)
- Kırılgan DOM seçicilerini (ID/XPath) semantik ve çok katmanlı akıllı alternatiflerle onarır.
- **Arayüz:** `AutoHealView.tsx`

### 11. PRD Zekası & Otomatik Test Üretimi (`analyze_prd_and_generate_tests`)
- Ürün gereksinim dokümanından (PRD) sentetik kullanıcı senaryoları ve Playwright `.spec.ts` kodu üretir.
- **Arayüz:** `PrdIntelligenceCard.tsx`

### 12. Otonom Tarayıcı ve Site Ağacı Grafı (`AutonomousCrawler`)
- Derinlik bazlı sayfa tarama, iç bağlantı keşfi ve site rotaları ağaç görselleştirmesi.
- **Arayüz:** `CrawlGraphView.tsx`

### 13. 4 Katmanlı Kök Neden Analizi (RCA) ve Ekip Ataması
- Tüm bulguları `REAL_BUG`, `ENV_ISSUE`, `TEST_FRAGILITY`, `EXPECTED_BEHAVIOR` sınıflarına ayırır ve ilgili ekibe (Dev, QA, DevOps, Uyum) yönlendirir.

### 14. Kullanıcı Oturum Kaydı & Isı Haritası (`SessionHeatmapEngine`)
- **Hotjar & FullStory Kurumsal Standardı / KVKK & GDPR Uyumlu.**
- Kullanıcı oturumundaki imleç koordinatlarını, tıklamaları, kaydırma derinliğini ve form etkileşimlerini zaman damgalı kaydeder.
- **Kızgın Tıklama (Rage Click):** 800ms içinde aynı koordinat veya öğeye yapılan 3+ ardışık tıklamaları kümeleyip `UX_RAGE_CLICK_DETECTED` bulgusu üretir.
- **Ölü Tıklama (Dead Click):** Tıklanabilir olmayan (div, p vb.) statik metinlere yapılan yanıtsız tıklamaları `UX_DEAD_CLICK_DETECTED` olarak işaretler.
- **Radyal Tıklama Isı Haritası (Click Heatmap):** Yoğunluk derecelendirmesi (0.1 - 1.0) ile görsel sıcak noktalar oluşturur.
- **Kaydırma Şelalesi (Scroll Waterfall):** %25, %50, %75, %100 derinlik basamaklarında ziyaretçi tutunma ve düşüş analizini sunar.
- **Arayüz:** `SessionReplayHeatmapView.tsx` (İnteraktif Sanal Tarayıcı Oynatıcı, Hız Ayarı, Isı Haritası ve Sürtünme Raporu).

### 15. Veritabanı ve Yavaş Sorgu Sızıntı Denetimi (`DatabaseLeakSlowQueryProber`)
- **OWASP Top 10 A05:2021, CWE-209, CWE-200, PCI-DSS v4.0 ve BDDK Madde 31 Kurumsal Standardı.**
- **SQL / ORM Hata Sızıntıları:** PostgreSQL, MySQL/MariaDB, SQLite, MSSQL, Oracle ve MongoDB hata sözdizimlerinin HTTP yanıtlarına sızmasını denetler.
- **Bağlantı Dizesi (Connection URI) İfşası:** Yanıt gövdesinde sızan veritabanı bağlantı URI'lerini yakalar ve şifreleri maskeler (`postgres://admin:*****@host/db`).
- **Yavaş Sorgu & SLA İhlalleri:** >800ms (Medium), >1500ms (High), >2500ms (Critical) API uç noktalarını tespit eder.
- **N+1 Sorgu Patern Şüphesi:** Bir sayfa yükünde ilişkili alt rotalara gönderilen ardışık tekil istekleri saptar ve Eager Loading / Toplu API tavsiyesi üretir.
- **Zaman Bazlı Gecikme Problama (Time-Delay Probing):** Sentetik hesaplama yükleriyle sunucunun zaman sapmasını (drift) ve Blind SQLi direncini ölçer.
- **Arayüz:** `DatabaseSlowQueryView.tsx` (Sızıntı Listesi, Yavaş Sorgu & N+1 Paternleri, Zaman Probu ve ORM/İndeks Çözüm Rehberi).

### 16. Çok Dilli (i18n) ve Lokalizasyon Kusurları Denetimi (`LocalizationI18nAuditor`)
- **W3C Internationalization, WCAG 2.1 SC 3.1.1 (Language of Page), BCP 47 ve Google Search Central hreflang Standardı.**
- **Çevrilmemiş Anahtar Sızıntıları (Key Leaks):** Kullanıcıya yansıyan `auth.login.title`, `common.buttons.submit` gibi ham i18n anahtarlarını ve `{{ username }}` şablon kalıntılarını yakalar.
- **HTML lang ve BCP 47 Denetimi:** `<html lang="...">` eksikliği veya geçersizliği (WCAG Seviye A kusuru).
- **RTL & Çift Yönlü Metin (BiDi):** Arapça, İbranice, Farsça gibi dillerde `dir="rtl"` ve CSS ayna simetrisi gereksinimini denetler.
- **Hreflang Bölgesel SEO:** `<link rel="alternate" hreflang="xx">` etiketlerini ve `x-default` yapılandırmasını doğrular.
- **Arayüz:** `LocalizationAuditView.tsx` (Kusur Listesi, Hreflang Tablosu, Desteklenen Diller ve Modern i18n Kod Rehberi).

### 17. SPA Bellek ve DOM Sızıntı Radarı (`MemoryLeakProfilerEngine`)
- **W3C Web Performance & Memory, Chrome DevTools Memory Profiler & Detached DOM Trees, React RFC 0021 Standardı.**
- **Yetim Event Listener'lar (Dangling Listeners):** `window.addEventListener('resize')`, `scroll`, `keydown` gibi dinleyicilerin bileşen unmount olduğunda temizlenmemesini tespit eder.
- **Kopuk DOM Ağaçları (Detached DOM Nodes):** Modal, dialog, drawer, portal ve Canvas öğelerinin DOM'dan kaldırıldıktan sonra JS closure'larında asılı kalmasını saptar.
- **Zamanlayıcılar & Gözlemciler (Timers & Observers):** Açık bırakılan `setInterval` ve `.disconnect()` çağrılmamış `ResizeObserver` / `MutationObserver` nesnelerini yakalar.
- **JavaScript Heap Metrikleri & Büyüme Hızı:** V8 Heap kullanımını (Used / Total / Limit MB) ve sayfa geçişleri sonrası +MB büyüme deltasını izler; bellek şişmesini (Bloat) raporlar.
- **Arayüz:** `MemoryLeakView.tsx` (Bellek Sağlık Skoru, Heap Çubuğu, Detached Ağaçlar, Yetim Dinleyiciler, Hazır `useEventListener` ve `WeakMap` Kod Rehberi).

### 18. Üçüncü Taraf Script, İzleyici ve CSP Sandbox Denetimi (`ThirdPartySecurityAuditor`)
- **W3C Content Security Policy Level 3 (CSP3), Subresource Integrity (SRI), KVKK Madde 5-7, GDPR Madde 6 ve PCI-DSS v4.0 Req 6.4.3 Standardı.**
- **İzleyici & Piksel Envanteri:** Meta (Facebook) Pixel, Google Tag Manager, Google Analytics 4, TikTok Pixel, Criteo ve LinkedIn etiketlerini sınıflandırır.
- **Oturum Kayıt & Keylogger Riski:** Hotjar, FullStory, Clarity ve Yandex Metrica gibi form girdilerini ve hassas kullanıcı hareketlerini kaydeden araçları ve PII riskini belirler.
- **Tedarik Zinciri Koruması (SRI):** Harici CDN'lerden (cdnjs, jsdelivr, unpkg) yüklenen script'lerde `integrity="sha384-..."` hash ve `crossorigin="anonymous"` eksikliklerini tespit eder.
- **CSP Sandbox Direktif Analizi:** `script-src`, `object-src`, `base-uri` direktiflerini inceler; `'unsafe-inline'`, `'unsafe-eval'` ve `*` açıklarını denetleyip A+, A, B, C, F derecelendirmesi yapar.
- **KVKK & GDPR Çerez Rızası:** OneTrust, Cookiebot vb. CMP olmaksızın rıza öncesi (Pre-consent) tetiklenen izleyicileri raporlar.
- **Arayüz:** `ThirdPartySecurityView.tsx` (Güvenlik Skoru, CSP Derecesi, İzleyici Listesi, Direktif Analizi, CMP Uyumu, Next.js Middleware ve Nginx CSP Şablonu).

---

## 🧪 Doğrulama ve Test Durumu
- **Backend Testleri:** 48/48 birim testi aktif ve başarılı (`test_third_party_security_auditor`, `test_memory_leak_profiler`, `test_localization_auditor`, `test_database_leak_prober`, `test_session_heatmap_engine`, `test_dast_verifier`, `test_api_contract_auditor`, `test_responsive_auditor`, `test_rate_limit_auditor`, `test_waf_leakage_prober`, `test_chaos_engine`).
- **Frontend Derlemesi:** `npm run build` Turbopack ve TypeScript doğrulaması 0 hata ile derlenmektedir.

---

## 💡 Sıradaki Olası Adımlar:
1. **SSL/TLS Sertifika Zinciri ve Modern Şifreleme Sağlığı (TLS/SSL Handshake & Cipher Suite Auditor):** TLS 1.3/1.2 desteği, eski şifreleme süitleri (RC4/3DES), sertifika geçerlilik bitiş süresi ve HSTS preload denetimi (PCI-DSS 4.0 Madde 4, NIST SP 800-52r2).
2. **Otonom Olay Köprüsü ve Webhook Entegrasyon Merkezi (Automated Incident & Webhook Integration Hub):** Kritik (CRITICAL/HIGH) RCA güvenlik ve performans bulgularını Slack, Microsoft Teams, Discord, Jira veya GitHub Issues formatında zengin kartlara dönüştürme.

