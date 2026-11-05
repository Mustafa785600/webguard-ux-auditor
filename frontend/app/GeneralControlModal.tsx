"use client";

import { useState, useMemo, useEffect } from "react";
import type { Finding } from "@/types/scan";
import type { Language } from "@/lib/i18n";

export interface GeneralControlRule {
  id: string;
  category: "TRANSPORT" | "HEADERS" | "COOKIES" | "EXPOSURE" | "CLIENT" | "API";
  categoryTr: string;
  categoryEn: string;
  titleTr: string;
  titleEn: string;
  descTr: string;
  descEn: string;
  findingIds: string[];
}

export const GENERAL_CONTROL_RULES: GeneralControlRule[] = [
  {
    id: "RULE_HTTPS_REDIRECT",
    category: "TRANSPORT",
    categoryTr: "Taşıma Katmanı",
    categoryEn: "Transport Layer",
    titleTr: "HTTP'den HTTPS'e Zorunlu Yönlendirme (301)",
    titleEn: "Enforced HTTP to HTTPS 301 Redirect",
    descTr: "Port 80 üzerinden gelen tüm düz metin HTTP isteklerinin gecikmeksizin kalıcı 301/308 ile HTTPS'e yönlendirilmesi.",
    descEn: "Plaintext HTTP requests on port 80 must permanently redirect to HTTPS using 301 Moved Permanently.",
    findingIds: ["SEC_HTTP_NO_REDIRECT", "SEC_HTTP_TEMPORARY_REDIRECT", "SEC_NO_ENCRYPTION"],
  },
  {
    id: "RULE_SSL_CERT",
    category: "TRANSPORT",
    categoryTr: "Taşıma Katmanı",
    categoryEn: "Transport Layer",
    titleTr: "SSL/TLS Sertifika Geçerliliği ve Süre Takibi",
    titleEn: "SSL/TLS Certificate Validity & Expiration",
    descTr: "Sertifikanın güvenilir bir CA tarafından imzalanmış olması, süresi dolmamış olması ve bitiş tarihine en az 14 gün bulunması.",
    descEn: "Certificate must be valid, signed by a trusted CA, and have at least 14 days before expiration.",
    findingIds: ["SEC_CERT_EXPIRED", "SEC_CERT_EXPIRING_CRITICAL", "SEC_CERT_VERIFY_FAILED", "SEC_TLS_HANDSHAKE_ERROR"],
  },
  {
    id: "RULE_MODERN_TLS",
    category: "TRANSPORT",
    categoryTr: "Taşıma Katmanı",
    categoryEn: "Transport Layer",
    titleTr: "Modern TLS Sürümü ve Güçlü Şifreleme (TLS 1.2+)",
    titleEn: "Modern TLS Protocols (1.2+) & Strong Ciphers",
    descTr: "Eski güvensiz protokollerin (SSLv3, TLS 1.0, 1.1) ve zayıf şifrelerin (RC4, 3DES) tamamen kapatılmış olması.",
    descEn: "Obsolete protocols (SSLv3, TLS 1.0/1.1) and legacy ciphers (RC4, 3DES) must be strictly disabled.",
    findingIds: ["SEC_DEPRECATED_TLS_VERSION", "SEC_WEAK_CIPHER_SUITE"],
  },
  {
    id: "RULE_HSTS",
    category: "HEADERS",
    categoryTr: "HTTP Başlıkları",
    categoryEn: "Security Headers",
    titleTr: "HTTP Sıkı Aktarım Güvenliği (HSTS)",
    titleEn: "HTTP Strict Transport Security (HSTS)",
    descTr: "Tarayıcılara daima ve yalnızca HTTPS kullanmasını zorunlu kılan Strict-Transport-Security başlığı.",
    descEn: "Strict-Transport-Security header enforcing encrypted connections for all subdomains.",
    findingIds: ["SEC_HSTS_MISSING"],
  },
  {
    id: "RULE_CSP",
    category: "HEADERS",
    categoryTr: "HTTP Başlıkları",
    categoryEn: "Security Headers",
    titleTr: "İçerik Güvenlik Politikası (CSP)",
    titleEn: "Content Security Policy (CSP)",
    descTr: "XSS ve veri enjeksiyonu açıklarının etkisini sınırlandıran Content-Security-Policy başlığı.",
    descEn: "Restricts sources of executable scripts, preventing XSS and unauthorized data injection.",
    findingIds: ["SEC_CSP_MISSING"],
  },
  {
    id: "RULE_CLICKJACKING",
    category: "HEADERS",
    categoryTr: "HTTP Başlıkları",
    categoryEn: "Security Headers",
    titleTr: "Tıklama Kaçırma (Clickjacking) Koruması",
    titleEn: "Clickjacking Protection (X-Frame-Options)",
    descTr: "Sayfanın başka sitelerdeki iframe'lere gömülmesini engelleyen X-Frame-Options veya frame-ancestors.",
    descEn: "Prevents UI redressing and iframe embedding via DENY or SAMEORIGIN directives.",
    findingIds: ["SEC_CLICKJACKING_RISK"],
  },
  {
    id: "RULE_NOSNIFF",
    category: "HEADERS",
    categoryTr: "HTTP Başlıkları",
    categoryEn: "Security Headers",
    titleTr: "MIME Türü Tahmin Engeli (nosniff)",
    titleEn: "MIME-Type Sniffing Protection (nosniff)",
    descTr: "Tarayıcıların dosya içeriklerine bakarak zararlı JavaScript çalıştırmasını önleyen X-Content-Type-Options: nosniff direktifi.",
    descEn: "Forces browsers to strictly honor declared MIME types, preventing script execution from uploads.",
    findingIds: ["SEC_NOSNIFF_MISSING"],
  },
  {
    id: "RULE_REFERRER",
    category: "HEADERS",
    categoryTr: "HTTP Başlıkları",
    categoryEn: "Security Headers",
    titleTr: "Referans Başlığı Güvenliği (Referrer-Policy)",
    titleEn: "Referrer Information Privacy (Referrer-Policy)",
    descTr: "Dış bağlantılarda hassas URL parametrelerinin ve oturum token'larının üçüncü taraflara sızmasını kısıtlayan politika.",
    descEn: "Protects sensitive URL query strings and tokens from leaking in the HTTP Referer header.",
    findingIds: ["SEC_REFERRER_POLICY_MISSING", "SEC_INSECURE_REFERRER_POLICY"],
  },
  {
    id: "RULE_PERMISSIONS",
    category: "HEADERS",
    categoryTr: "HTTP Başlıkları",
    categoryEn: "Security Headers",
    titleTr: "Tarayıcı Özellik ve API İzinleri (Permissions-Policy)",
    titleEn: "Browser API Permissions (Permissions-Policy)",
    descTr: "Kamera, mikrofon ve konum gibi ayrıcalıklı tarayıcı API'lerine kontrolsüz erişimi kısıtlayan Permissions-Policy başlığı.",
    descEn: "Restricts high-privilege browser APIs (camera, microphone, geolocation) across iframes.",
    findingIds: ["SEC_PERMISSIONS_POLICY_MISSING"],
  },
  {
    id: "RULE_SERVER_LEAK",
    category: "HEADERS",
    categoryTr: "HTTP Başlıkları",
    categoryEn: "Security Headers",
    titleTr: "Sunucu ve Teknoloji Sürüm Maskeleme",
    titleEn: "Server Software & Version Masking",
    descTr: "Yanıtlarda Server ve X-Powered-By gibi teknoloji sürüm imzalarının gizlenmesi (server_tokens off).",
    descEn: "Suppresses server banners and software versions (Server, X-Powered-By) to prevent CVE targeting.",
    findingIds: ["SEC_SERVER_INFO_LEAK"],
  },
  {
    id: "RULE_ERROR_HANDLING",
    category: "EXPOSURE",
    categoryTr: "Hata & Bilgi Güvenliği",
    categoryEn: "Error & Information Security",
    titleTr: "Hata Yönetimi ve Stack Trace Gizliliği",
    titleEn: "Improper Error Handling & Debug Screen Suppression",
    descTr: "Canlı ortamda ayrıntılı kod yığını izleri ve framework debug ekranlarının (Django DEBUG, Werkzeug, Laravel Ignition, Node) kapatılması.",
    descEn: "Disables verbose stack traces and framework debug consoles in production environments.",
    findingIds: ["SEC_STACK_TRACE_DISCLOSURE"],
  },
  {
    id: "RULE_ENV_FILE",
    category: "EXPOSURE",
    categoryTr: "Hata & Bilgi Güvenliği",
    categoryEn: "Error & Information Security",
    titleTr: "Açık Ortam Değişkenleri (.env) Koruması",
    titleEn: "Environment Configuration (.env) Protection",
    descTr: "Veritabanı parolaları ve gizli API anahtarlarını barındıran .env dosyalarının webden erişilemez olması.",
    descEn: "Guarantees .env configuration files containing database credentials and API secrets are blocked.",
    findingIds: ["SEC_EXPOSED_ENV_FILE"],
  },
  {
    id: "RULE_GIT_REPO",
    category: "EXPOSURE",
    categoryTr: "Hata & Bilgi Güvenliği",
    categoryEn: "Error & Information Security",
    titleTr: "Açık Sürüm Kontrol (.git) Dizini İfşası",
    titleEn: "Version Control (.git/HEAD) Protection",
    descTr: "Tüm kaynak kod geçmişinin indirilmesine yol açabilecek .git dizininin HTTP erişimine kapatılması.",
    descEn: "Prevents public download and source code reconstruction via accessible .git repositories.",
    findingIds: ["SEC_EXPOSED_GIT_REPO"],
  },
  {
    id: "RULE_DB_DUMP",
    category: "EXPOSURE",
    categoryTr: "Hata & Bilgi Güvenliği",
    categoryEn: "Error & Information Security",
    titleTr: "Açık Veritabanı Dökümleri (.sql)",
    titleEn: "Database Dump File (.sql) Protection",
    descTr: "dump.sql, backup.sql gibi veritabanı yedeği ve tablo dökümlerinin web kök dizininde açıkta olmaması.",
    descEn: "Ensures production database dumps (.sql) are not publicly downloadable from the web root.",
    findingIds: ["SEC_EXPOSED_DB_DUMP"],
  },
  {
    id: "RULE_BACKUP_ARCHIVE",
    category: "EXPOSURE",
    categoryTr: "Hata & Bilgi Güvenliği",
    categoryEn: "Error & Information Security",
    titleTr: "Açıkta Arşiv Yedekleri (.zip, .tar.gz)",
    titleEn: "Compressed Archive Backup Protection",
    descTr: "backup.zip, site.tar.gz gibi web sitesi ve kaynak kod arşivlerinin açıkta bulunmaması.",
    descEn: "Ensures full application archive backups (.zip, .tar.gz) are barred from HTTP access.",
    findingIds: ["SEC_EXPOSED_BACKUP_ARCHIVE"],
  },
  {
    id: "RULE_ROBOTS_TXT",
    category: "EXPOSURE",
    categoryTr: "Hata & Bilgi Güvenliği",
    categoryEn: "Error & Information Security",
    titleTr: "robots.txt ile Gizli Dizin İfşası",
    titleEn: "Sensitive Path Disclosure via robots.txt",
    descTr: "robots.txt dosyası içinde gizli yönetim paneli veya yedek yollarının ifşa edilmemesi.",
    descEn: "Verifies sensitive administrative or internal endpoints are not advertised in robots.txt.",
    findingIds: ["SEC_ROBOTS_PATH_DISCLOSURE"],
  },
  {
    id: "RULE_OPENAPI_SCHEMA",
    category: "API",
    categoryTr: "API & Arayüz Güvenliği",
    categoryEn: "API & Interface Security",
    titleTr: "Açık API Şema Belgeleri (Swagger/OpenAPI)",
    titleEn: "Public OpenAPI/Swagger Schema Exposure",
    descTr: "Canlı ortamda iç API uç noktalarının ve şemalarının kimlik doğrulamasız açık bırakılmaması.",
    descEn: "Audits whether comprehensive internal API endpoint schemas are publicly exposed.",
    findingIds: ["SEC_EXPOSED_SWAGGER_SCHEMA", "SEC_EXPOSED_OPENAPI_SCHEMA"],
  },
  {
    id: "RULE_COOKIES",
    category: "COOKIES",
    categoryTr: "Çerez & Oturum",
    categoryEn: "Cookie & Session",
    titleTr: "Çerez Güvenlik Bayrakları (Secure, HttpOnly, SameSite)",
    titleEn: "Cookie Security Flags (Secure, HttpOnly, SameSite)",
    descTr: "Oturum çerezlerinde ağ dinlemesine karşı Secure, XSS'e karşı HttpOnly ve CSRF'e karşı SameSite zorunluluğu.",
    descEn: "Enforces Secure (HTTPS-only), HttpOnly (anti-XSS), and SameSite=Lax/Strict (anti-CSRF) on cookies.",
    findingIds: ["SEC_INSECURE_COOKIE"],
  },
  {
    id: "RULE_TABNABBING",
    category: "CLIENT",
    categoryTr: "İstemci & DOM",
    categoryEn: "Client & DOM",
    titleTr: "Tersine Tabnabbing Koruması (rel='noopener noreferrer')",
    titleEn: "Reverse Tabnabbing Protection (rel='noopener')",
    descTr: "Yeni sekmede açılan linklerin window.opener üzerinden kimlik avı yönlendirmesi yapmasını engelleme.",
    descEn: "Verifies external links with target='_blank' include rel='noopener noreferrer' to isolate opener.",
    findingIds: ["SEC_TABNABBING_RISK"],
  },
  {
    id: "RULE_FORM_GET",
    category: "CLIENT",
    categoryTr: "İstemci & DOM",
    categoryEn: "Client & DOM",
    titleTr: "Hassas Form Verilerinin GET ile İletimi",
    titleEn: "Sensitive Form Data Transmission (GET Method)",
    descTr: "Parola, kimlik veya e-posta içeren formların URL parametresi üreten GET yerine POST kullanması.",
    descEn: "Ensures credentials and personal data in forms submit via POST, preventing URL/log leakage.",
    findingIds: ["SEC_FORM_GET_SENSITIVE_DATA"],
  },
  {
    id: "RULE_CORS",
    category: "API",
    categoryTr: "API & Arayüz Güvenliği",
    categoryEn: "API & Interface Security",
    titleTr: "Çapraz Kaynak Paylaşımı (CORS Wildcard)",
    titleEn: "Cross-Origin Resource Sharing (CORS Wildcard)",
    descTr: "Hassas API yanıtlarında joker (*) etki alanı izni verilerek veri sızıntısına yol açılmaması.",
    descEn: "Checks that API routes do not expose authenticated data via overly permissive wildcard CORS.",
    findingIds: ["QA_INSECURE_CORS_POLICY"],
  },
  {
    id: "RULE_BROKEN_LINKS",
    category: "CLIENT",
    categoryTr: "İstemci & DOM",
    categoryEn: "Client & DOM",
    titleTr: "Kırık Bağlantı ve Kaynak Bütünlüğü (404/500)",
    titleEn: "Broken Links & Critical Asset Integrity",
    descTr: "Sayfadaki kritik CSS, JS, resim ve köprülerin 404/500 gibi çıkmaz sokaklara yönlenmemesi.",
    descEn: "Ensures stylesheets, scripts, images, and links resolve with 200 OK without dead ends.",
    findingIds: ["UX_BROKEN_LINKS", "UX_BROKEN_ASSETS"],
  },
];

interface GeneralControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  findings: Finding[];
  lang: Language;
  onSelectFinding?: (findingId: string) => void;
}

export default function GeneralControlModal({
  isOpen,
  onClose,
  findings,
  lang,
  onSelectFinding,
}: GeneralControlModalProps) {
  const [filter, setFilter] = useState<"ALL" | "PASSED" | "FAILED">("ALL");

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const findingMap = useMemo(() => {
    const map = new Map<string, Finding>();
    for (const f of findings) {
      map.set(f.id, f);
    }
    return map;
  }, [findings]);

  const evaluatedRules = useMemo(() => {
    return GENERAL_CONTROL_RULES.map((rule) => {
      const matchedFindings = rule.findingIds
        .map((fid) => findingMap.get(fid))
        .filter((f): f is Finding => f !== undefined);

      const hasIssue = matchedFindings.length > 0;
      return {
        ...rule,
        hasIssue,
        matchedFindings,
      };
    });
  }, [findingMap]);

  const passedCount = useMemo(
    () => evaluatedRules.filter((r) => !r.hasIssue).length,
    [evaluatedRules]
  );
  const failedCount = evaluatedRules.length - passedCount;
  const complianceRate = Math.round((passedCount / evaluatedRules.length) * 100);

  const displayedRules = useMemo(() => {
    if (filter === "PASSED") return evaluatedRules.filter((r) => !r.hasIssue);
    if (filter === "FAILED") return evaluatedRules.filter((r) => r.hasIssue);
    return evaluatedRules;
  }, [evaluatedRules, filter]);

  if (!isOpen) return null;

  return (
    <div className="gc-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="gc-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="gc-modal-header">
          <div className="gc-header-left">
            <div className="gc-header-badge">
              🛡️ {lang === "tr" ? "SİBER GÜVENLİK TEMEL DEĞERLENDİRME" : "CYBERSECURITY BASELINE AUDIT"}
            </div>
            <h2 className="gc-header-title">
              {lang === "tr" ? "GeneralControl Denetim Listesi" : "GeneralControl Audit Checklist"}
            </h2>
            <p className="gc-header-subtitle">
              {lang === "tr"
                ? "Siber güvenlik uzmanlarının web uygulamalarında doğruladığı 22 temel kural ve canlı uyumluluk durumu."
                : "22 essential baseline rules verified by security auditors and live target compliance status."}
            </p>
          </div>
          <button className="gc-close-btn" onClick={onClose} title="Kapat">
            ✕
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="gc-stats-bar">
          <div className="gc-stat-box">
            <span className="gc-stat-num">{evaluatedRules.length}</span>
            <span className="gc-stat-lbl">{lang === "tr" ? "Toplam Kriter" : "Total Rules"}</span>
          </div>
          <div className="gc-stat-box passed">
            <span className="gc-stat-num">{passedCount}</span>
            <span className="gc-stat-lbl">{lang === "tr" ? "Başarılı" : "Passed"}</span>
          </div>
          <div className="gc-stat-box failed">
            <span className="gc-stat-num">{failedCount}</span>
            <span className="gc-stat-lbl">{lang === "tr" ? "Risk Tespit Edildi" : "Issues Found"}</span>
          </div>
          <div className="gc-stat-box score">
            <span className="gc-stat-num">%{complianceRate}</span>
            <span className="gc-stat-lbl">{lang === "tr" ? "Uyumluluk Oranı" : "Compliance Rate"}</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="gc-filter-bar">
          <button
            type="button"
            className={`gc-filter-pill ${filter === "ALL" ? "active" : ""}`}
            onClick={() => setFilter("ALL")}
          >
            {lang === "tr" ? "Tümü" : "All"} ({evaluatedRules.length})
          </button>
          <button
            type="button"
            className={`gc-filter-pill passed ${filter === "PASSED" ? "active" : ""}`}
            onClick={() => setFilter("PASSED")}
          >
            ✅ {lang === "tr" ? "Başarılı Olanlar" : "Passed"} ({passedCount})
          </button>
          <button
            type="button"
            className={`gc-filter-pill failed ${filter === "FAILED" ? "active" : ""}`}
            onClick={() => setFilter("FAILED")}
          >
            ❌ {lang === "tr" ? "Risk Tespit Edilenler" : "Issues Detected"} ({failedCount})
          </button>
        </div>

        {/* Checklist Body */}
        <div className="gc-modal-body">
          {displayedRules.map((rule, index) => {
            const isFailed = rule.hasIssue;
            const categoryLabel = lang === "tr" ? rule.categoryTr : rule.categoryEn;
            const title = lang === "tr" ? rule.titleTr : rule.titleEn;
            const desc = lang === "tr" ? rule.descTr : rule.descEn;

            return (
              <div
                key={rule.id}
                className={`gc-item-card ${isFailed ? "has-issue" : "is-passed"}`}
              >
                {/* Status Bubble (Baloncuk) */}
                <div
                  className={`gc-status-bubble ${isFailed ? "bubble-failed" : "bubble-passed"}`}
                  title={
                    isFailed
                      ? lang === "tr"
                        ? "Risk Tespit Edildi"
                        : "Issue Detected"
                      : lang === "tr"
                      ? "Denetim Başarılı"
                      : "Audit Passed"
                  }
                >
                  {isFailed ? (
                    <span className="gc-bubble-icon failed">✕</span>
                  ) : (
                    <span className="gc-bubble-icon passed">✓</span>
                  )}
                </div>

                {/* Content */}
                <div className="gc-item-content">
                  <div className="gc-item-header">
                    <span className="gc-item-index">#{index + 1}</span>
                    <span className="gc-category-tag">{categoryLabel}</span>
                    <span className={`gc-status-tag ${isFailed ? "tag-failed" : "tag-passed"}`}>
                      {isFailed
                        ? lang === "tr"
                          ? "RİSKLİ"
                          : "FAILED"
                        : lang === "tr"
                        ? "BAŞARILI"
                        : "PASSED"}
                    </span>
                  </div>

                  <h3 className="gc-item-title">{title}</h3>
                  <p className="gc-item-desc">{desc}</p>

                  {/* If Failed, show matched finding details */}
                  {isFailed && rule.matchedFindings.length > 0 && (
                    <div className="gc-failed-details">
                      <div className="gc-failed-alert">
                        <strong>⚠️ {lang === "tr" ? "Tespit Edilen Güvenlik Açığı:" : "Detected Vulnerability:"}</strong>
                        {rule.matchedFindings.map((f) => (
                          <div key={f.id} className="gc-failed-finding-row">
                            <span className={`gc-sev-pill sev-${f.severity.toLowerCase()}`}>
                              {f.severity}
                            </span>
                            <span className="gc-finding-title">{f.title}</span>
                            {onSelectFinding && (
                              <button
                                type="button"
                                className="gc-view-finding-btn"
                                onClick={() => {
                                  onClose();
                                  onSelectFinding(f.id);
                                }}
                              >
                                {lang === "tr" ? "Bulguyu İncele →" : "View Finding →"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="gc-modal-footer">
          <div className="gc-footer-legend">
            <span className="legend-item">
              <span className="legend-circle passed">✓</span>
              {lang === "tr" ? "Yeşil Tik: Güvenlik Denetiminden Geçti" : "Green Check: Passed Audit"}
            </span>
            <span className="legend-item">
              <span className="legend-circle failed">✕</span>
              {lang === "tr" ? "Kırmızı Çarpı: Güvenlik Açığı veya Eksiklik" : "Red Cross: Security Vulnerability"}
            </span>
          </div>
          <button className="gc-btn-close-footer" onClick={onClose}>
            {lang === "tr" ? "Pencereyi Kapat" : "Close Window"}
          </button>
        </div>
      </div>
    </div>
  );
}

