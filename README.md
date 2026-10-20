# 🛡️ WebGuard & UX Auditor

Modern, kapsamlı ve yapay zeka destekli web sitesi güvenlik ve kullanıcı deneyimi (UX) denetim platformu.

Web sitelerini tek tıkla analiz eder; HTTP güvenlik başlıklarını, SSL/TLS sertifikalarını, ifşa olmuş hassas dosyaları, teknoloji yığınını, link sağlığını ve WCAG 2.1 erişilebilirlik standartlarını denetleyerek kurumsal seviyede puanlama ve çözüm rehberi üretir.

---

## 🚀 Temel Özellikler

- **🔒 Security Headers Scanner:** HSTS, CSP, X-Frame-Options, MIME Sniffing, Server Bilgi Sızıntısı ve Güvenli Çerez (Secure/HttpOnly) denetimi.
- **📜 SSL/TLS Certificate Scanner:** Sertifika geçerlilik süresi, veren kurum (CA), TLS 1.2/1.3 protokol güvenliği ve süresi dolan sertifika ikazları.
- **🕵️ Sensitive File & Exposure Scanner:** İnternete açık unutulmuş `/.env`, `/.git/HEAD`, `robots.txt` hassas dizinleri ve swagger/openapi şemalarının tespiti.
- **⚙️ Tech Stack & Fingerprinting:** Web sunucusu, CMS ve frontend kütüphanelerinin tespiti.
- **🔗 UX & Link Sağlığı:** Kırık linkler (404/500), yüklenemeyen kritik kaynaklar ve `target="_blank"` linklerde `rel="noopener noreferrer"` kontrolü.
- **♿ Forms & A11y Scanner (WCAG 2.1):** Form aksiyonları, eksik `<label>` etiketleri, boş butonlar, `autocomplete` belirteçleri ve şifre güvenliği kontrolü.
- **📍 Sorun Konumu ve Satır Numarası:** Hatalı HTML etiketlerinin kaynak koddaki tam satır numarasını ve mevcut hatalı kod parçacığını gösterir.
- **🛠️ Nasıl Düzeltilir & Çözüm Kodları:** Her bulgu için doğrudan kopyalanabilir Nginx, Apache ve HTML çözüm şablonları.
- **📊 Canlı Dashboard & Rapor Dışa Aktarma:** Güvenlik ve UX puanları, filtreleme (Critical/High/Medium/Low) ve JSON rapor çıktısı.

---

## 🏗️ Proje Mimarisi

```
EyupHocaOdev/
├── backend/                   # FastAPI REST API & Tarayıcı Motorları
│   ├── app/
│   │   ├── api/routes.py      # Scan & Health Endpoint'leri
│   │   ├── core/              # Ayarlar ve yapılandırmalar
│   │   ├── models/schema.py   # Pydantic veri modelleri (Finding, ScanResult)
│   │   ├── scanners/          # 6 Bağımsız Tarayıcı Modülü
│   │   │   ├── security/      # Headers, SSL/TLS, Exposure, Tech
│   │   │   └── ux/            # Forms & A11y, Links, Basic UX
│   │   └── services/          # Scorer & Orchestrator Servisleri
│   ├── tests/                 # 29 Pytest Birim ve Entegrasyon Testi
│   └── requirements.txt
│
└── frontend/                  # Next.js 16 (Turbopack) & TypeScript Arayüzü
    ├── app/
    │   ├── ScanDashboard.tsx  # Ana tarama ve sonuç dashboard'u
    │   ├── FindingCard.tsx    # Risk, Konum, Satır ve Çözüm Kod Kartı
    │   ├── ScoreCard.tsx      # Dinamik Güvenlik ve UX Skor Kartları
    │   └── globals.css        # Modern, karanlık tema & cam efektli tasarım
    └── types/scan.ts          # TypeScript arayüz tanımları
```

---

## ⚡ Kurulum ve Çalıştırma

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

pip install -r requirements.txt pytest pytest-asyncio
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Dokümantasyonu (Swagger): [http://127.0.0.1:8000/api/v1/docs](http://127.0.0.1:8000/api/v1/docs)

### 2. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
- Kullanıcı Arayüzü: [http://localhost:3000](http://localhost:3000)

### 3. Testleri Çalıştırma
```bash
cd backend
pytest -v
# 29/29 Test Başarıyla Geçer
```

---

## 📄 Lisans
Bu proje eğitim ve araştırma amaçlı geliştirilmiştir.
