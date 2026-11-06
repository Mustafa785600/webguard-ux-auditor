# 🛡️ WebGuard & UX Auditor — Project State & Handoff Document

Bu belge, yeni bir sohbete geçildiğinde yapay zekanın (Antigravity) projeyi, mimariyi, son yapılan geliştirmeleri ve canlı ortamı (Vercel & Render) eksiksiz hatırlaması için hazırlanmıştır.

---

## 📌 1. Proje Özeti ve Vizyonu
- **Proje Adı:** WebGuard & UX Auditor (Eyüp Hoca Dönem Ödevi / Bitirme Projesi)
- **GitHub Deposu:** `https://github.com/Mustafa785600/webguard-ux-auditor.git`
- **Aktif Branch:** `main`
- **Canlı Dağıtım (Production):**
  - **Frontend:** Vercel üzerinde yayında.
  - **Backend:** Render üzerinde yayında.
  - **Local Geliştirme:** `localhost:3000` (Next.js) & `localhost:8000` (FastAPI).

---

## 🏗️ 2. Teknoloji Yığını (Tech Stack)
- **Backend:** Python 3.12, FastAPI, Playwright (Headless Chromium), Uvicorn, BeautifulSoup4, HTTPX, Pydantic v2.
- **Frontend:** Next.js 16 (Turbopack), React 19, TypeScript (Strict Mode), CSS Modules & Glassmorphic Dark UI.
- **Test Paketi:** Pytest & Pytest-Asyncio (74 birim ve entegrasyon testi — %100 başarılı).
- **Otomasyon & Scriptler:** `start.bat`, `stop.bat`, `start.ps1`, `WebGuard.vbs`.

---

## 🚀 3. Tamamlanan Temel Fazlar ve Yetenekler

### A. Güvenlik & DAST Denetimleri (`backend/app/scanners/security/`)
1. **Security Headers:** HSTS, CSP, X-Frame-Options (Clickjacking), X-Content-Type-Options (MIME Sniffing), Referrer-Policy (Bilgi Sızıntısı), Permissions-Policy (Tarayıcı API Kısıtlamaları), Server Bilgi Sızıntısı (`server_tokens`).
2. **SSL/TLS & Transport Scanner:** Sertifika geçerliliği, bitiş tarihi, veren kurum (CA), TLS 1.2/1.3 protokol kontrolleri, zayıf şifre paketleri (RC4, 3DES) ve Port 80 HTTP -> HTTPS 301/308 otomatik yönlendirme denetimi.
3. **Cookie Security:** Çerezlerde `Secure`, `HttpOnly` ve `SameSite=Lax/Strict` (CSRF Koruması) bayraklarının derinlemesine denetimi.
4. **Exposure Scanner:** `/.env`, `/.git/HEAD`, `robots.txt`, açık API şemaları (`swagger.json`, `openapi.json`), veritabanı dökümleri (`/dump.sql`, `/backup.sql`) ve sıkıştırılmış yedek arşivleri (`/backup.zip`, `/backup.tar.gz`).
5. **Error Handling & Stack Trace Scanner:** Hata ayıklama modları (Django `DEBUG=True`, Flask/Werkzeug konsolu, Laravel Whoops/Ignition, ASP.NET ayrıntılı hata ekranı, Node.js unhandled exceptions, Spring Boot Whitelabel, PHP Fatal Errors) ve veritabanı sürücü hata ifşası tespiti.
6. **Technology Fingerprinting:** Sunucu, CMS ve JS framework tespiti.

### B. UX & WCAG 2.1 Erişilebilirlik (`backend/app/scanners/ux/`)
1. **Forms & A11y Scanner:** Eksik `<label>` etiketleri, boş butonlar, form aksiyonları, hassas form GET gönderimleri ve autocomplete etiketleri (HTML DOM tam satır numarasıyla: `📍 Satır: 42`).
2. **Broken Links & Tabnabbing Scanner:** Kırık linkler (404/500), kırık kritik varlıklar (CSS/JS) ve `target="_blank"` bağlantılarda Tersine Tabnabbing (Reverse Tabnabbing) güvenlik kontrolleri (`rel="noopener noreferrer"`).
3. **Network Waterfall & Contract Validation:** Ağ istekleri şelalesi, >2000ms geciken yavaş endpoint'ler, CORS açıkları (`*`).

### C. TestSprite PRD-Driven AI Test Intelligence (`backend/app/services/prd_agent.py`)
- Düz metin PRD (Ürün Gereksinim Dokümanı) girdiğinde kullanıcı rollerini (`Customer`, `Admin`), akış adımlarını ve uç durumları (edge cases) çıkarır.
- Otomatik olarak çalıştırılabilir **Playwright TypeScript `.spec.ts` E2E test dosyası** sentezler.

### D. Kök Neden Analizi (RCA - Root Cause Analysis)
- Tüm bulguları TestSprite standardında sınıflandırır:
  - `REAL_BUG` (Gerçek Yazılım Hatası)
  - `TEST_FRAGILITY` (Kırılgan Test / Seçici Değişimi)
  - `ENV_ISSUE` (Sunucu / Ağ / Ortam Hatası)
  - `EXPECTED_BEHAVIOR` (Beklenen Tasarım Davranışı)

### E. Otonom Çok Sayfalı Gezgin (Autonomous Crawler & Route Graph)
- **BFS Algoritması:** Tek sayfaya bağlı kalmadan aynı domain içindeki tüm alt sayfaları (`/hakkimizda`, `/urunler/...`) gezer (`max_pages=5`, `max_depth=2`).
- **SPA Routing:** React/Vue/Angular hash rotalarını (`/#/about`) ve dinamik hydration beklemesini destekler.
- **Site Rota Haritası (`CrawlGraphView.tsx`):** Keşfedilen her rotanın canlı ekran görüntüsünü, durum kodunu (`200 OK`, `404`), form/buton sayısını ve yükleme süresini gösterir; sayfaya göre filtreleme sağlar.

### F. Uluslararasılaşma & İki Dilli Arayüz (`frontend/lib/i18n.ts`)
- Sağ üstte `[ 🇹🇷 TR | 🇬🇧 EN ]` dil değiştirici.
- Tüm hata başlıkları, risk etiketleri, Nginx `server { ... }` çözüm blokları ve arayüz dinamik çevrilir.

### G. İnteraktif GeneralControl Kontrol Listesi Penceresi (`GeneralControlModal.tsx`)
- Kullanıcının tek tıkla açabildiği (`🛡️ GeneralControl Listesi` butonu), siber güvenlik ve sektörel uyumluluk uzmanlarının uyguladığı 27 temel kuralın canlı uyumluluk penceresi.
- Her kriterin başında dinamik durum baloncukları:
  - **Kırmızı Çarpı Baloncuğu (❌):** İlgili güvenlik açığı sitede tespit edildiğinde kırmızı yanıp sönen baloncuk, bulgu başlığı ve "Bulguyu İncele" kısayolu.
  - **Yeşil Tik Baloncuğu (✅):** Denetimden başarıyla geçildiğinde zümrüt yeşili parlama.
- Filtreler: `Tümü (27)`, `Başarılı (✅)`, `Riskli (❌)` sekmeleri ve genel uyumluluk skoru yüzdesi (`%`).

### H. Sektörel Uyumluluk Protokolleri (Industry Compliance Engine)
- **Sektör Tipleri (`SectorType`):** `AUTO` (Akıllı Yapay Zeka Tespiti), `GENERAL` (Genel Web), `ECOMMERCE` (E-Ticaret & Finans), `HEALTHCARE` (Sağlık & Medikal), `CORPORATE_GOV` (Kurumsal & Kamu), `SAAS_API` (SaaS & Teknoloji).
- **PCI-DSS v4.0 Denetimleri:** Dış kaynaklı JavaScript dosyalarında Subresource Integrity (SRI) bütünlüğü (`integrity="sha384-..."`), açıkta unutulan Stripe test/canlı gizli anahtarları (`sk_live_...`, `pk_test_...`), şifresiz ödeme formları.
- **KVKK Madde 10 & GDPR Art. 13:** Yasal Aydınlatma Metni ve Gizlilik Politikası varlığı, üçüncü taraf takipçiler (Google Analytics, Meta Pixel vb.) için Çerez Onay Banner'ı (Cookie Consent).
- **HIPAA Privacy Rule & FTC Sağlık Rehberi:** Klinik ve hasta randevu sayfalarında üçüncü taraf sosyal medya ve reklam takip pikselleri (Meta Pixel, TikTok Pixel vb.) sızıntısı tespiti.
- **OWASP API Security Top 10:** Wildcard CORS (`Access-Control-Allow-Origin: *`) ve açık Swagger/OpenAPI dokümantasyon sızıntıları.
- **Frontend Gösterimi:** URL çubuğu altında şık rozetlerle sektör seçici; sonuç ekranında aktif sektör rozeti, Yapay Zeka otomatik tespit etiketi, 3. skor kartı olarak **Uyumluluk & Mevzuat Skoru** ve bulgu kartlarında `⚖️ [Standart Kuralı]` etiketleri.

---

## 📂 4. Kritik Dosya Haritası
```
EyupHocaOdev/
├── backend/
│   ├── app/
│   │   ├── api/routes.py            # FastAPI Scan & PRD rotaları
│   │   ├── models/schema.py         # Pydantic modelleri (Finding, CrawlNode, ScanResult)
│   │   ├── scanners/                # Security ve UX tarayıcı sınıfları
│   │   └── services/
│   │       ├── orchestrator.py      # Eş zamanlı tarama yöneticisi
│   │       ├── crawler.py           # Otonom Playwright Gezgini
│   │       └── prd_agent.py         # PRD'den E2E test üreten yapay zeka
│   └── tests/                       # Pytest test dosyaları
│
├── frontend/
│   ├── app/
│   │   ├── ScanDashboard.tsx        # Ana Dashboard ve Sekme Yöneticisi
│   │   ├── GeneralControlModal.tsx  # İnteraktif 22 Maddelik Güvenlik Kontrol Listesi Penceresi
│   │   ├── FindingCard.tsx          # Kod önizlemeli bulgu kartı
│   │   ├── CrawlGraphView.tsx       # İnteraktif Site Rota Haritası
│   │   ├── PrdIntelligenceCard.tsx  # PRD Test Üreteci
│   │   └── NetworkWaterfallCard.tsx # Ağ İstekleri Şelalesi
│   ├── lib/
│   │   ├── api.ts                   # Backend iletişim katmanı
│   │   └── i18n.ts                  # Türkçe ve İngilizce sözlük & çeviri motoru
│   └── types/scan.ts                # TypeScript arayüz tipleri
│
├── start.bat                        # Tek tıkla yerel başlatıcı (Backend 8000 + Frontend 3000)
├── stop.bat                         # Tek tıkla yerel kapatıcı
└── HANDOFF.md                       # Bu durum belgesi
```

---

## ⚡ 5. Yeni Sohbette Kaldığımız Yerden Başlama Komutu
Yeni sohbete başladığınızda asistana yalnızca şu cümleyi yazmanız yeterlidir:

> *"Merhaba Antigravity, WebGuard projemize kaldığımız yerden devam ediyoruz. Lütfen kök dizindeki HANDOFF.md dosyasını oku ve projenin son durumunu (Vercel & Render canlı ortamı, otonom crawler ve en son commit'ler) hatırlayarak hazır olduğunu söyle."*

