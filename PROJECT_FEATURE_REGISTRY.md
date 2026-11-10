# 📜 WebGuard - Proje Ana Özellik Kütüğü & Envanteri (Master Feature Registry)

> **Gizlilik ve Kullanım Notu:** Bu dosya proje kök dizininde yer alan ve yalnızca kullanıcı ile yapay zeka asistanının (Antigravity) erişimine açık olan özel bir bellek ve takip kütüğüdür. Sitede veya son kullanıcı arayüzünde yayınlanmaz. Her yeni özellik ekleme, refactoring veya güncelleme işleminde bu kütük güncellenerek hafıza kaybı ve halüsinasyon riski sıfıra indirilir.

---

## 📌 Master Mimari ve Modül Matrisi (19/19 Tamamlandı)

| # | Modül Adı | Kategori | Backend Servisi / Motor | Frontend Arayüzü | Birim Test Dosyası | Kurumsal Standart & Uyum |
|---|---|---|---|---|---|---|
| **1** | Kod Tabanı & Mimari Zeka | Mimari / Statik Analiz | `backend/app/services/codebase_intelligence.py` | `frontend/app/CodebaseIntelligenceView.tsx` | Entegre AST Motoru | Clean Architecture, AST Graph |
| **2** | Core Web Vitals & Performans | Performans / SLA | `backend/app/services/performance_tester.py` | `frontend/app/PerformanceView.tsx` | Entegre SLA Motoru | Google Web Vitals (LCP/FCP/CLS), BDDK SLA |
| **3** | WAF & Hata Sızıntısı Direnci | Güvenlik / Dayanıklılık | `backend/app/services/waf_leakage_prober.py` | `frontend/app/WAFResilienceView.tsx` | `test_waf_leakage_prober.py` (3 test) | OWASP A05:2021, WAF Parmak İzi |
| **4** | Kaos Mühendisliği & Ağ Hata Enjeksiyonu | Güvenilirlik / Kaos | `backend/app/services/chaos_engine.py` | `frontend/app/ChaosEngineeringView.tsx` | `test_chaos_engine.py` (4 test) | Netflix Chaos Monkey, WSOD Tespiti |
| **5** | Hız Sınırı & Kaba Kuvvet Direnci | Güvenlik / API | `backend/app/services/rate_limit_auditor.py` | `frontend/app/RateLimitResilienceView.tsx` | `test_rate_limit_auditor.py` (3 test) | OWASP API4:2023, BDDK Madde 34, PCI-DSS |
| **6** | Çoklu Cihaz & Duyarlı Tasarım | UX / A11y / Responsive | `backend/app/services/responsive_auditor.py` | `frontend/app/MultiViewportView.tsx` | `test_responsive_auditor.py` (5 test) | WCAG 2.5.5, Apple HIG, Mobil/Tablet/Desktop |
| **7** | API Sözleşme & Şema Sapması | API / Kalite | `backend/app/services/api_contract_auditor.py` | `frontend/app/APIContractDriftView.tsx` | `test_api_contract_auditor.py` (5 test) | OpenAPI 3.0/3.1, OWASP API8/API9, JSON Schema |
| **8** | DAST Güvenlik Açığı Otomatik Doğrulama | Güvenlik / DAST | `backend/app/services/dast_verifier.py` | `frontend/app/DASTVerificationView.tsx` | `test_dast_verifier.py` (5 test) | CWE-79, CWE-200, CWE-942, CWE-601, CWE-918 |
| **9** | Canlı Yayın & CDP Screencast | Canlı HUD / İzleme | `backend/app/services/live_screencast.py` | `frontend/app/LiveScreencastPanel.tsx` | WebSocket Canlı Hub | Chrome DevTools Protocol (CDP) |
| **10** | Otonom Auto-Heal & Flaky Test Onarımı | Test Mühendisliği | `backend/app/services/self_healing_engine.py` | `frontend/app/AutoHealView.tsx` | Regex & AST Repair | TestSprite Standardı, Akıllı Lokasyon |
| **11** | PRD Zekası & Otomatik Senaryo Üretimi | Ürün / QA | `backend/app/services/prd_agent.py` | `frontend/app/PrdIntelligenceCard.tsx` | E2E Spec Generator | LLM Tabanlı Sentetik Senaryo & Spec |
| **12** | Otonom Tarayıcı & Site Ağacı Grafı | Keşif / Tarama | `backend/app/services/crawler.py` | `frontend/app/CrawlGraphView.tsx` | Breadth-First Crawler | Network / DOM Graph Görselleştirmesi |
| **13** | 4 Katmanlı Kök Neden Analizi (RCA) | Triyaj / Yönetim | `backend/app/services/scorer.py` | `frontend/app/RcaTriageBar.tsx` | Entegre Triyaj | `REAL_BUG`, `ENV_ISSUE`, `TEST_FRAGILITY`, `EXPECTED` |
| **14** | Kullanıcı Oturum Kaydı & Isı Haritası | UX / Telemetri | `backend/app/services/session_heatmap_engine.py` | `frontend/app/SessionReplayHeatmapView.tsx` | `test_session_heatmap_engine.py` (4 test) | Hotjar / FullStory, KVKK/GDPR Madde 5 |
| **15** | Veritabanı & Yavaş Sorgu Sızıntı Denetimi | Veritabanı / Güvenlik | `backend/app/services/database_leak_prober.py` | `frontend/app/DatabaseSlowQueryView.tsx` | `test_database_leak_prober.py` (4 test) | OWASP A05, CWE-209, CWE-200, N+1 Analizi |
| **16** | Çok Dilli (i18n) & Lokalizasyon Denetimi | UX / L10n / Erişilebilirlik | `backend/app/services/localization_auditor.py` | `frontend/app/LocalizationAuditView.tsx` | `test_localization_auditor.py` (5 test) | W3C i18n, WCAG 3.1.1, BCP 47, hreflang |
| **17** | SPA Bellek & DOM Sızıntı Radarı | Performans / Bellek / UX | `backend/app/services/memory_leak_profiler.py` | `frontend/app/MemoryLeakView.tsx` | `test_memory_leak_profiler.py` (5 test) | W3C Memory Spec, Chrome Heap Profiler, Detached DOM |
| **18** | 3. Taraf Script, İzleyici & CSP Sandbox | Güvenlik / Gizlilik / Tedarik | `backend/app/services/third_party_security_auditor.py` | `frontend/app/ThirdPartySecurityView.tsx` | `test_third_party_security_auditor.py` (5 test) | W3C CSP3, SRI Hash, KVKK Madde 5-7, GDPR Madde 6, PCI-DSS |
| **19** | SSL/TLS Sertifika & Kriptografi Sağlığı | Kriptografi / Altyapı / Güvenlik | `backend/app/services/tls_crypto_auditor.py` | `frontend/app/TLSCryptoView.tsx` | `test_tls_crypto_auditor.py` (5 test) | PCI-DSS v4.0 Req 4, NIST SP 800-52r2, BDDK Tebliği, RFC 8446 |

---

## 🔍 Detaylı Modül Özellikleri ve Yetenek Tanımları

### 1. Bütünsel Kod Tabanı ve Mimari Zeka
- **Dosyalar:** `backend/app/services/codebase_intelligence.py` -> `frontend/app/CodebaseIntelligenceView.tsx`
- **Yetenek:** Projedeki Python AST ve frontend yapısını statik olarak tarar. Katmanları (`API_CONTROLLER`, `SERVICE_LOGIC`, `SECURITY_GUARD`, `DATA_MODEL`, `FRONTEND_UI`) tespit eder. Sembol bağımlılıklarını, etki yarıçapını (Blast Radius) ve uçtan uca akışları (FullStackFlow) görselleştirir.

### 2. Core Web Vitals ve Sayfa Performansı
- **Dosyalar:** `backend/app/services/performance_tester.py` -> `frontend/app/PerformanceView.tsx`
- **Yetenek:** LCP, FCP, TTFB, DOM düğüm sayısı ve ağır kaynakları ölçer. Eşzamanlı 10-50 istek ile p50, p90, p95, p99 gecikme SLA testlerini ve throughput değerini çıkarır.

### 3. WAF ve Hata Sızıntısı Direnç Testi
- **Dosyalar:** `backend/app/services/waf_leakage_prober.py` -> `frontend/app/WAFResilienceView.tsx`
- **Yetenek:** SQLi, XSS, Path Traversal, Bozuk JSON vb. 8 sentetik prob gönderir. WAF sağlayıcısını (Cloudflare, AWS WAF, Akamai vb.) parmak izinden tanır. 500 çöküşlerini ve stack trace sızıntılarını tespit eder.

### 4. Kaos Mühendisliği ve Ağ Hata Enjeksiyonu
- **Dosyalar:** `backend/app/services/chaos_engine.py` -> `frontend/app/ChaosEngineeringView.tsx`
- **Yetenek:** HTTP 500, Gecikme Sıçraması (Spike), Bağlantı Kesintisi (Abort) ve Bozuk JSON enjekte eder. Tarayıcıda Beyaz Ekran Çöküşü (WSOD) veya gracefully fallback olup olmadığını denetler.

### 5. Hız Sınırı ve Kaba Kuvvet Direnci
- **Dosyalar:** `backend/app/services/rate_limit_auditor.py` -> `frontend/app/RateLimitResilienceView.tsx`
- **Yetenek:** Kimlik doğrulama rotalarına sentetik istek patlamaları gönderir. HTTP 429, `Retry-After` ve `RateLimit-*` başlıklarını denetler. FastAPI, Nginx ve Express için hazır konfigürasyon üretir.

### 6. Çoklu Cihaz ve Duyarlı Tasarım Denetimi
- **Dosyalar:** `backend/app/services/responsive_auditor.py` -> `frontend/app/MultiViewportView.tsx`
- **Yetenek:** Mobil (390x844), Tablet (768x1024), Masaüstü (1920x1080) simülasyonu yapar. Yatay kaydırma taşmalarını (Horizontal Overflow) ve 44x44px'den küçük dokunma alanlarını (WCAG 2.5.5) tespit eder.

### 7. API Sözleşme ve Şema Sapması Denetimi
- **Dosyalar:** `backend/app/services/api_contract_auditor.py` -> `frontend/app/APIContractDriftView.tsx`
- **Yetenek:** OpenAPI/Swagger dokümanlarını keşfeder. Gerçek zamanlı ağ trafiğini (`network_traces`) sözleşmeyle karşılaştırarak tip uyumsuzluklarını ve belgelenmemiş gölge API'leri (Shadow API - OWASP API9) yakalar.

### 8. DAST Güvenlik Açığı Otomatik Doğrulaması
- **Dosyalar:** `backend/app/services/dast_verifier.py` -> `frontend/app/DASTVerificationView.tsx`
- **Yetenek:** Zararsız kanaryalarla Reflected XSS (CWE-79), Hassas Dosya (.env, .git - CWE-200), Güvensiz CORS (CWE-942), Açık Yönlendirme (CWE-601) ve SSRF (CWE-918) açıklarını doğrular; yanlış pozitifleri ayıklar.

### 9. Canlı Yayın Paneli & CDP Screencast
- **Dosyalar:** `backend/app/services/live_screencast.py` -> `frontend/app/LiveScreencastPanel.tsx`
- **Yetenek:** Chrome DevTools Protocol (CDP) üzerinden tarayıcının form doldurma, tıklama ve tarama anlarını WebSocket ile canlı yayınlar.

### 10. Otonom E2E Auto-Heal & Flaky Test İyileştirici
- **Dosyalar:** `backend/app/services/self_healing_engine.py` -> `frontend/app/AutoHealView.tsx`
- **Yetenek:** Kırılgan seçicileri (ID/XPath) semantik ve akıllı alternatiflerle onarır.

### 11. PRD Zekası & Otomatik Test Üretimi
- **Dosyalar:** `backend/app/services/prd_agent.py` -> `frontend/app/PrdIntelligenceCard.tsx`
- **Yetenek:** Ürün gereksinim dokümanından sentetik kullanıcı senaryoları ve Playwright `.spec.ts` kodu üretir.

### 12. Otonom Tarayıcı ve Site Ağacı Grafı
- **Dosyalar:** `backend/app/services/crawler.py` -> `frontend/app/CrawlGraphView.tsx`
- **Yetenek:** Derinlik bazlı sayfa tarama, iç bağlantı keşfi ve site rotaları ağaç görselleştirmesi.

### 13. 4 Katmanlı Kök Neden Analizi (RCA) ve Ekip Ataması
- **Dosyalar:** `backend/app/services/scorer.py` -> `frontend/app/RcaTriageBar.tsx`
- **Yetenek:** Tüm bulguları `REAL_BUG`, `ENV_ISSUE`, `TEST_FRAGILITY`, `EXPECTED_BEHAVIOR` sınıflarına ayırır ve ilgili ekibe yönlendirir.

### 14. Kullanıcı Oturum Kaydı & Isı Haritası
- **Dosyalar:** `backend/app/services/session_heatmap_engine.py` -> `frontend/app/SessionReplayHeatmapView.tsx`
- **Yetenek:** İmleç koordinatları, tıklamalar, kaydırma derinliği. Kızgın Tıklama (3+ tıklama / 800ms) ve Ölü Tıklama tespiti. Radyal ısı haritası ve kaydırma şelalesi. KVKK/GDPR veri maskeleme.

### 15. Veritabanı ve Yavaş Sorgu Sızıntı Denetimi
- **Dosyalar:** `backend/app/services/database_leak_prober.py` -> `frontend/app/DatabaseSlowQueryView.tsx`
- **Yetenek:** Ham SQL hata sızıntıları (PostgreSQL, MySQL, SQLite vb.), bağlantı URI'si ifşası (parola maskeli), >800ms yavaş sorgu tespiti, N+1 sorgu patern tespiti ve zaman bazlı hesaplama probu.

### 16. Çok Dilli (i18n) ve Lokalizasyon Kusurları Denetimi
- **Dosyalar:** `backend/app/services/localization_auditor.py` -> `frontend/app/LocalizationAuditView.tsx`
- **Yetenek:** Kullanıcıya yansıyan çevrilmemiş i18n anahtar sızıntıları (`auth.login.title`), eksik veya BCP-47 standart dışı `<html lang="...">` özniteliği (WCAG 3.1.1), sağdan sola dillerde (RTL) `dir="rtl"` ve BiDi metin uyumu, `hreflang` arama motoru bölgesel SEO etiketleri ve para birimi/tarih formatlama kusurları.

### 17. SPA Bellek ve DOM Sızıntı Radarı (Memory & DOM Leak Profiler)
- **Dosyalar:** `backend/app/services/memory_leak_profiler.py` -> `frontend/app/MemoryLeakView.tsx`
- **Yetenek:** React / Next.js SPA uygulamalarında unmount sonrası kopuk kalan DOM düğümlerini (Detached DOM Nodes), temizlenmemiş yetim event listener'ları (`window.addEventListener` cleanup eksikliği), periyodik zamanlayıcıları (`setInterval` leaks), kapatılmamış `ResizeObserver` / `MutationObserver` nesnelerini ve JavaScript Heap şişmesini (Bloat) otonom olarak profiller ve hazır React TypeScript kod çözümleri üretir.

### 18. Üçüncü Taraf Script, İzleyici ve CSP Sandbox Denetimi (Third-Party Tracker & CSP Sandbox Auditor)
- **Dosyalar:** `backend/app/services/third_party_security_auditor.py` -> `frontend/app/ThirdPartySecurityView.tsx`
- **Yetenek:** Sayfaya enjekte edilen tüm harici script ve izleyicileri (Meta Pixel, Google Tag Manager, Hotjar, TikTok Pixel vb.) envanterler. Dış CDN'lerde Subresource Integrity (SRI `integrity="sha384-..."`) eksikliklerini saptar. Sunucu Content-Security-Policy (CSP Level 3) sandbox başlıklarını directif bazlı ('unsafe-inline', wildcards) puanlar (A+, A, B, C, F). CMP çerez rıza banner'ı olmadan kullanıcı izleyen ihlalleri (KVKK Madde 5-7 ve GDPR Madde 6) raporlar ve üretime hazır sıkı CSP şablonları üretir.

### 19. SSL/TLS Sertifika Zinciri ve Modern Kriptografi Sağlığı (TLS/SSL Handshake & Cipher Suite Auditor)
- **Dosyalar:** `backend/app/services/tls_crypto_auditor.py` -> `frontend/app/TLSCryptoView.tsx`
- **Yetenek:** TLS 1.3 ve TLS 1.2 protokol desteğini, Perfect Forward Secrecy (PFS - ECDHE/DHE) anahtar değişimini, kırılmış/eski şifreleri (RC4, 3DES/Sweet32, CBC) denetler. Sertifika otoritesi (CA), RSA/ECC anahtar boyutu ve kalan gün sayısını (<7 gün acil uyarısı) izler. Strict-Transport-Security (HSTS) başlığını max-age, includeSubDomains ve Preload hazır bulunuşluğu açısından inceler; SSL Labs tarzı harf notu (A+, A, B, C, F) ve hazır Nginx/Apache modern SSL şablonları sunar (PCI-DSS v4.0 Req 4, NIST SP 800-52r2, BDDK Tebliği).

---

## 🧪 Aktif Test Kapsamı ve Sağlık Durumu
- **Backend Test Sayısı:** 53/53 Test (Tamamı Geçiyor)
- **Frontend Derleme Durumu:** Next.js 16 App Router (Turbopack) 0 Hata
- **Git Branch:** `main`, Çalışma alanı tertemiz.

