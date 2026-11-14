"use client";

import { useState, useEffect, useMemo } from "react";
import { startScan } from "@/lib/api";
import type { ScanResult, Severity, Category, RCACategory, SectorType } from "@/types/scan";
import FindingCard from "./FindingCard";
import ScoreCard from "./ScoreCard";
import NetworkWaterfallCard from "./NetworkWaterfallCard";
import PrdIntelligenceCard from "./PrdIntelligenceCard";
import CrawlGraphView from "./CrawlGraphView";
import GeneralControlModal from "./GeneralControlModal";
import AuditReportModal from "./AuditReportModal";
import ExecutiveDeckModal from "./ExecutiveDeckModal";
import AutoHealView from "./AutoHealView";
import RcaTriageBar from "./RcaTriageBar";
import PerformanceView from "./PerformanceView";
import LiveScreencastPanel from "./LiveScreencastPanel";
import CodebaseIntelligenceView from "./CodebaseIntelligenceView";
import WAFResilienceView from "./WAFResilienceView";
import ChaosEngineeringView from "./ChaosEngineeringView";
import RateLimitResilienceView from "./RateLimitResilienceView";
import MultiViewportView from "./MultiViewportView";
import APIContractDriftView from "./APIContractDriftView";
import DASTVerificationView from "./DASTVerificationView";
import SessionReplayHeatmapView from "./SessionReplayHeatmapView";
import DatabaseSlowQueryView from "./DatabaseSlowQueryView";
import LocalizationAuditView from "./LocalizationAuditView";
import MemoryLeakView from "./MemoryLeakView";
import ThirdPartySecurityView from "./ThirdPartySecurityView";
import TLSCryptoView from "./TLSCryptoView";
import { IncidentHubView } from "./IncidentHubView";
import SEOStructuredDataView from "./SEOStructuredDataView";
import UserPersonaReportView from "./UserPersonaReportView";
import EthicalSecurityReportView from "./EthicalSecurityReportView";
import { AuditMode, UserPersona } from "@/types/scan";
import {
  type Language,
  UI_STRINGS,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  RCA_LABELS,
  SECTOR_LABELS,
} from "@/lib/i18n";

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

const STORAGE_KEY = "webguard_recent_scans";

export type DashboardTab =
  | "OVERVIEW"
  | "FINDINGS"
  | "PERSONA"
  | "ETHICAL_SECURITY"
  | "DAST"
  | "WAF"
  | "THIRDPARTY"
  | "TLS_CRYPTO"
  | "DATABASE"
  | "RATELIMIT"
  | "PERFORMANCE"
  | "MEMORY"
  | "CHAOS"
  | "VIEWPORT"
  | "CODEBASE"
  | "APICONTRACT"
  | "AUTO_HEAL"
  | "PRD"
  | "SESSION_REPLAY"
  | "LOCALIZATION"
  | "SEO_DATA"
  | "CRAWL_GRAPH"
  | "INCIDENT_HUB";

export type BadgeVariant = "danger" | "success" | "warning" | "info" | "neutral";

export interface NavigationItem {
  id: DashboardTab;
  label: string;
  icon: string;
  badge: string | null;
  badgeVariant?: BadgeVariant;
}

export interface NavigationHub {
  id: string;
  title: string;
  icon: string;
  items: NavigationItem[];
}

export default function ScanDashboard() {
  const [lang, setLang] = useState<Language>("tr");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);

  // Filtering state
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | Category>("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | Severity>("ALL");
  const [rcaFilter, setRcaFilter] = useState<"ALL" | RCACategory>("ALL");

  // Navigation & Workspace state
  const [activeTab, setActiveTab] = useState<DashboardTab>("OVERVIEW");
  const [sidebarFilter, setSidebarFilter] = useState<string>("");
  const [showConfigDrawer, setShowConfigDrawer] = useState<boolean>(false);

  // Audit Mode & User Persona state
  const [auditMode, setAuditMode] = useState<AuditMode>("UX_PERSONA");
  const [selectedPersona, setSelectedPersona] = useState<UserPersona>("SHOPPER");

  // Autonomous Crawler state
  const [enableCrawler, setEnableCrawler] = useState<boolean>(true);
  const [maxPages, setMaxPages] = useState<number>(5);
  const [selectedRouteUrl, setSelectedRouteUrl] = useState<string | null>(null);

  // Modals state
  const [showCodebaseStandalone, setShowCodebaseStandalone] = useState<boolean>(false);
  const [showGeneralControl, setShowGeneralControl] = useState<boolean>(false);
  const [showAuditReport, setShowAuditReport] = useState<boolean>(false);
  const [showExecutiveDeck, setShowExecutiveDeck] = useState<boolean>(false);
  const [showLiveScreencast, setShowLiveScreencast] = useState<boolean>(false);
  const [selectedSector, setSelectedSector] = useState<SectorType>("AUTO");

  const t = UI_STRINGS[lang];

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecentScans(JSON.parse(stored));
    } catch {
      // Ignore localStorage errors
    }

    const params = new URLSearchParams(window.location.search);
    const initialUrl = params.get("url");
    if (initialUrl) {
      setUrl(initialUrl);
      runScan(initialUrl);
    }
  }, []);

  function saveToHistory(target: string) {
    try {
      const updated = [target, ...recentScans.filter((u) => u !== target)].slice(0, 5);
      setRecentScans(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }

  function clearHistory() {
    setRecentScans([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  async function runScan(targetUrl: string) {
    if (!targetUrl.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setSelectedRouteUrl(null);
    setActiveTab("OVERVIEW");

    try {
      const data = await startScan(targetUrl.trim(), undefined, {
        enableCrawler,
        maxPages,
        sector: selectedSector,
        auditMode,
        persona: selectedPersona,
      });
      if (data.status === "FAILED") {
        setError(data.error_message ?? "Scan failed.");
      } else {
        const sorted = [...data.findings].sort(
          (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
        );
        setResult({ ...data, findings: sorted });
        if (auditMode === "ETHICAL_SECURITY" || data.audit_mode === "ETHICAL_SECURITY") {
          setActiveTab("ETHICAL_SECURITY");
        }
        saveToHistory(targetUrl.trim());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    runScan(url);
  }

  function handleExportJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `webguard-audit-${new URL(result.target_url).hostname}.json`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  const filteredFindings = useMemo(() => {
    if (!result) return [];
    return result.findings.filter((f) => {
      const matchCat = categoryFilter === "ALL" || f.category === categoryFilter;
      const matchSev = severityFilter === "ALL" || f.severity === severityFilter;
      const matchRca = rcaFilter === "ALL" || f.rca_category === rcaFilter;
      const matchRoute = !selectedRouteUrl || f.page_url === selectedRouteUrl;
      return matchCat && matchSev && matchRca && matchRoute;
    });
  }, [result, categoryFilter, severityFilter, rcaFilter, selectedRouteUrl]);

  // Critical and High findings for cockpit alert
  const criticalFindings = useMemo(() => {
    if (!result) return [];
    return result.findings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH");
  }, [result]);

  // 5 Tematik Hub Tanımı
  const NAVIGATION_HUBS: NavigationHub[] = useMemo(() => {
    if (!result) return [];
    return [
      {
        id: "SECURITY",
        title: lang === "tr" ? "Güvenlik & Uyum" : "Security & Compliance",
        icon: "🛡️",
        items: [
          {
            id: "ETHICAL_SECURITY",
            label: lang === "tr" ? "Etik Siber Dayanıklılık" : "Ethical Cyber Resilience",
            icon: "🛡️",
            badge: result.ethical_security_report
              ? `${result.ethical_security_report.cyber_resilience_score}%`
              : null,
            badgeVariant: result.ethical_security_report && result.ethical_security_report.cyber_resilience_score < 70 ? "warning" : "success",
          },
          {
            id: "DAST",
            label: lang === "tr" ? "DAST Zafiyet Doğrulama" : "DAST Exploit Verification",
            icon: "🎯",
            badge: result.dast_verification?.confirmed_vulnerabilities_count
              ? `${result.dast_verification.confirmed_vulnerabilities_count} Açık`
              : "Temiz",
            badgeVariant: result.dast_verification?.confirmed_vulnerabilities_count ? "danger" : "success",
          },
          {
            id: "WAF",
            label: lang === "tr" ? "WAF & Hata Direnci" : "WAF & Error Resilience",
            icon: "🛡️",
            badge: result.waf_resilience ? `${result.waf_resilience.waf_protection_score}%` : null,
            badgeVariant: result.waf_resilience && result.waf_resilience.waf_protection_score < 70 ? "warning" : "success",
          },
          {
            id: "THIRDPARTY",
            label: lang === "tr" ? "3. Taraf Script & CSP" : "3rd-Party & CSP Sandbox",
            icon: "🔒",
            badge: result.third_party_security_report
              ? `${result.third_party_security_report.csp_grade} (${result.third_party_security_report.security_score}%)`
              : null,
            badgeVariant: "info",
          },
          {
            id: "TLS_CRYPTO",
            label: lang === "tr" ? "SSL/TLS & Kripto" : "TLS/SSL & Cipher Suites",
            icon: "🔐",
            badge: result.tls_crypto_report ? `${result.tls_crypto_report.ssl_labs_grade}` : null,
            badgeVariant: "info",
          },
          {
            id: "DATABASE",
            label: lang === "tr" ? "Veritabanı Sızıntıları" : "Database & Query Leaks",
            icon: "🗄️",
            badge: result.database_leak_report?.total_leaks_count
              ? `${result.database_leak_report.total_leaks_count} Sızıntı`
              : "Temiz",
            badgeVariant: result.database_leak_report?.total_leaks_count ? "danger" : "success",
          },
          {
            id: "RATELIMIT",
            label: lang === "tr" ? "Hız Sınırı & Kaba Kuvvet" : "Rate-Limiting & Brute-Force",
            icon: "⏱️",
            badge: result.rate_limit_resilience ? `${result.rate_limit_resilience.resilience_score}%` : null,
            badgeVariant: "neutral",
          },
        ],
      },
      {
        id: "PERFORMANCE",
        title: lang === "tr" ? "Performans & Dayanıklılık" : "Performance & Resilience",
        icon: "⚡",
        items: [
          {
            id: "PERFORMANCE",
            label: lang === "tr" ? "Web Vitals & SLA" : "Core Web Vitals & SLA",
            icon: "⚡",
            badge: result.performance_metrics?.p95_latency_ms
              ? `${result.performance_metrics.p95_latency_ms}ms`
              : null,
            badgeVariant: result.performance_metrics && result.performance_metrics.p95_latency_ms > 500 ? "warning" : "info",
          },
          {
            id: "MEMORY",
            label: lang === "tr" ? "Bellek & DOM Sızıntısı" : "SPA Memory & DOM Leaks",
            icon: "🧠",
            badge: result.memory_leak_report?.total_leaks_count
              ? `${result.memory_leak_report.total_leaks_count} Sızıntı`
              : `${result.memory_leak_report?.memory_health_score ?? 100}%`,
            badgeVariant: result.memory_leak_report?.total_leaks_count ? "danger" : "success",
          },
          {
            id: "CHAOS",
            label: lang === "tr" ? "Kaos Mühendisliği" : "Chaos Fault Injection",
            icon: "💥",
            badge: result.chaos_resilience ? `${result.chaos_resilience.chaos_resilience_score}%` : null,
            badgeVariant: "neutral",
          },
          {
            id: "VIEWPORT",
            label: lang === "tr" ? "Çoklu Cihaz / Responsive" : "Multi-Viewport Layout",
            icon: "📱",
            badge: result.multi_viewport_report
              ? `${result.multi_viewport_report.overall_responsive_score}%`
              : null,
            badgeVariant: "neutral",
          },
        ],
      },
      {
        id: "ARCHITECTURE",
        title: lang === "tr" ? "Mimari & Test Zekası" : "Architecture & QA Intelligence",
        icon: "🧠",
        items: [
          {
            id: "CODEBASE",
            label: lang === "tr" ? "Kod Tabanı & AST" : "Codebase & AST Architecture",
            icon: "🧬",
            badge: result.codebase_intelligence
              ? `${result.codebase_intelligence.total_symbols} Sembol`
              : null,
            badgeVariant: "info",
          },
          {
            id: "APICONTRACT",
            label: lang === "tr" ? "API Sözleşme (OpenAPI)" : "API Contract Drift",
            icon: "📋",
            badge: result.api_contract_drift
              ? `${result.api_contract_drift.contract_compatibility_score}%`
              : null,
            badgeVariant: "neutral",
          },
          {
            id: "AUTO_HEAL",
            label: lang === "tr" ? "Auto-Heal (Flaky Tests)" : "Self-Healing E2E Tests",
            icon: "🧪",
            badge: result.self_healing_events?.length
              ? `${result.self_healing_events.length} Onarım`
              : null,
            badgeVariant: "success",
          },
          {
            id: "PRD",
            label: lang === "tr" ? "PRD Zekası & Spec" : "PRD Requirements Spec",
            icon: "📝",
            badge: result.prd_analysis?.scenarios?.length
              ? `${result.prd_analysis.scenarios.length} Senaryo`
              : null,
            badgeVariant: "neutral",
          },
        ],
      },
      {
        id: "EXPERIENCE",
        title: lang === "tr" ? "UX, Telemetri & SEO" : "UX, Telemetry & SEO",
        icon: "🌐",
        items: [
          {
            id: "FINDINGS",
            label: lang === "tr" ? "Tüm Bulgular & Triyaj" : "All Findings & Triage",
            icon: "📋",
            badge: `${result.findings.length} Bulgu`,
            badgeVariant: "neutral",
          },
          {
            id: "PERSONA",
            label: lang === "tr" ? "Kullanıcı Kimliği (Persona)" : "User Persona Audit",
            icon: "🎭",
            badge: result.persona_audit_report
              ? `${result.persona_audit_report.persona_icon} %${result.persona_audit_report.satisfaction_score}`
              : null,
            badgeVariant: result.persona_audit_report && result.persona_audit_report.satisfaction_score >= 80 ? "success" : "warning",
          },
          {
            id: "SESSION_REPLAY",
            label: lang === "tr" ? "Isı Haritası & Rage Click" : "Session Replay & Heatmap",
            icon: "🎬",
            badge: result.session_replay?.rage_clicks_count
              ? `${result.session_replay.rage_clicks_count} Rage`
              : "0 Rage",
            badgeVariant: result.session_replay?.rage_clicks_count ? "warning" : "neutral",
          },
          {
            id: "LOCALIZATION",
            label: lang === "tr" ? "Çok Dilli (i18n) & L10n" : "Localization & i18n",
            icon: "🌐",
            badge: result.localization_audit?.total_defects_count
              ? `${result.localization_audit.total_defects_count} Kusur`
              : `${result.localization_audit?.l10n_score ?? 100}%`,
            badgeVariant: result.localization_audit?.total_defects_count ? "warning" : "success",
          },
          {
            id: "SEO_DATA",
            label: lang === "tr" ? "SEO & Sosyal Paylaşım" : "SEO & Structured Data",
            icon: "🏷️",
            badge: result.seo_structured_data_report
              ? `${result.seo_structured_data_report.seo_health_score}%`
              : null,
            badgeVariant: "info",
          },
          {
            id: "CRAWL_GRAPH",
            label: lang === "tr" ? "Site Keşif Ağacı" : "Autonomous Site Graph",
            icon: "🗺️",
            badge: `${result.crawl_graph?.length ?? result.crawled_pages_count ?? 1} Sayfa`,
            badgeVariant: "neutral",
          },
        ],
      },
      {
        id: "OPERATIONS",
        title: lang === "tr" ? "Olay Yönetimi & Raporlar" : "Operations & Reporting",
        icon: "📢",
        items: [
          {
            id: "INCIDENT_HUB",
            label: lang === "tr" ? "Olay Köprüsü (Webhook)" : "Incident Dispatch Hub",
            icon: "📢",
            badge: result.incident_hub_report
              ? `${result.incident_hub_report.total_incidents_generated} Olay`
              : null,
            badgeVariant: result.incident_hub_report && result.incident_hub_report.critical_count > 0 ? "danger" : "info",
          },
        ],
      },
    ];
  }, [result, lang]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* ── 1. ÜST KURUMSAL GEZİNME ÇUBUĞU ── */}
      <header className="wg-navbar">
        <div className="wg-navbar-inner">
          <div className="wg-brand-group">
            <div className="wg-brand-icon">🛡️</div>
            <div className="wg-brand-text">
              <div className="wg-brand-title">
                <span>WebGuard</span>
                <span className="wg-version-badge">v2.0 Enterprise</span>
              </div>
              <span className="wg-brand-subtitle">
                {lang === "tr"
                  ? "Otonom Güvenlik, Performans ve UX Kalite Denetleme Platformu"
                  : "Autonomous Security, Performance & UX Quality Auditing Platform"}
              </span>
            </div>
          </div>

          <div className="wg-nav-actions">
            <button
              type="button"
              className={`wg-btn-subtle ${showCodebaseStandalone ? "active" : ""}`}
              onClick={() => setShowCodebaseStandalone(!showCodebaseStandalone)}
              title={lang === "tr" ? "Statik Kod Tabanı ve Mimari Zeka Raporunu İncele" : "Explore Codebase Architecture"}
            >
              <span>🧠</span>
              <span>{lang === "tr" ? "Kod Mimarisi" : "Codebase"}</span>
            </button>

            <div className="wg-lang-switch">
              <button
                type="button"
                className={`wg-lang-btn ${lang === "tr" ? "active" : ""}`}
                onClick={() => setLang("tr")}
              >
                🇹🇷 TR
              </button>
              <button
                type="button"
                className={`wg-lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
              >
                🇬🇧 EN
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. HERO & HEDEF ARAMA / DENETİM BARI ── */}
      <section className="wg-hero-section">
        <div className="wg-hero-badge">
          ⚡ {lang === "tr" ? "22 Otonom Güvenlik, Kalite ve Persona Modülü Aktif" : "22 Autonomous Security, Quality & Persona Modules"}
        </div>
        <h1 className="wg-hero-title">
          {lang === "tr" ? "Web Sistemleri İçin Otonom Güvenlik Radarı" : "Autonomous Security & Quality Radar"}
        </h1>
        <p className="wg-hero-desc">
          {lang === "tr"
            ? "Web sisteminizi DAST exploitleri, WAF zaafları, TLS sertifika zinciri, bellek sızıntıları ve Core Web Vitals performansına karşı saniyeler içinde otonom denetleyin."
            : "Audit any web application for DAST exploits, WAF resilience, TLS ciphers, SPA memory leaks, and Core Web Vitals in seconds."}
        </p>

        {/* ── DENETİM MODU & PERSONA SEÇİCİ ── */}
        <div className="audit-mode-selector-container">
          <div className="audit-mode-tabs">
            <button
              type="button"
              className={`mode-tab-btn ${auditMode === "UX_PERSONA" ? "active" : ""}`}
              onClick={() => setAuditMode("UX_PERSONA")}
            >
              <span>🎭</span>
              <span>{lang === "tr" ? "Kullanıcı Deneyimi & Persona Modu" : "UX & Persona Mode"}</span>
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${auditMode === "ETHICAL_SECURITY" ? "active" : ""}`}
              onClick={() => setAuditMode("ETHICAL_SECURITY")}
              title={lang === "tr" ? "Zararsız WAF, Hız Sınırı ve Güvenlik Denetimi" : "Non-destructive Ethical Red Teaming"}
            >
              <span>🛡️</span>
              <span>{lang === "tr" ? "Etik Güvenlik & Dayanıklılık Modu" : "Ethical Red Teaming"}</span>
            </button>
          </div>

          {/* Persona Alt Seçici (UX Persona Modu Seçiliyken) */}
          {auditMode === "UX_PERSONA" && (
            <div className="persona-pills-row">
              <span className="persona-picker-lbl">
                {lang === "tr" ? "Aktif Otonom Kimlik:" : "Autonomous Persona:"}
              </span>
              <div className="persona-pills-list">
                {[
                  { id: "SHOPPER", icon: "🛒", labelTr: "Alışverişçi", labelEn: "Shopper", descTr: "Sepet, Arama & Fiyat" },
                  { id: "RAGE_TESTER", icon: "⚡", labelTr: "Sabırsız Kullanıcı", labelEn: "Rage Tester", descTr: "Rage Click & Hızlı Scroll" },
                  { id: "ACCESSIBILITY", icon: "👴", labelTr: "Erişilebilirlik", labelEn: "A11y Senior", descTr: "Tab Odak & Kontrast" },
                  { id: "POWER_EXPLORER", icon: "🔍", labelTr: "Kapsamlı Kaşif", labelEn: "Power Explorer", descTr: "Mega Menü & Hiyerarşi" },
                ].map((p) => {
                  const isSel = selectedPersona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`persona-select-chip ${isSel ? "selected" : ""}`}
                      onClick={() => setSelectedPersona(p.id as UserPersona)}
                      title={`${isSel ? "✓ " : ""}${lang === "tr" ? p.labelTr : p.labelEn}: ${p.descTr}`}
                    >
                      <span className="chip-emoji">{p.icon}</span>
                      <span className="chip-name">{lang === "tr" ? p.labelTr : p.labelEn}</span>
                      {isSel && <span className="chip-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {auditMode === "ETHICAL_SECURITY" && (
            <div className="security-mode-badge-hint">
              <span>🛡️</span>
              <span>
                {lang === "tr"
                  ? "Etik Beyaz Şapkalı Modu: Hedef sisteme zarar vermeden WAF bypass direnci, 429 hız sınırı (rate limit) ve açık dizin güvenliğini canlı problarla denetler."
                  : "White-Hat Mode: Non-destructively audits WAF bypass resilience, rate-limiting headers, and directory exposure."}
              </span>
            </div>
          )}
        </div>

        {/* Tarama Formu */}
        <form onSubmit={handleScan} className="wg-scan-box" id="scan-form">
          <span className="wg-scan-icon">🌐</span>
          <input
            id="url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t.urlPlaceholder}
            disabled={loading}
            autoComplete="url"
            spellCheck={false}
            className="wg-scan-input"
          />
          <button
            type="button"
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            className={`wg-config-toggle ${showConfigDrawer ? "active" : ""}`}
            title={lang === "tr" ? "Gelişmiş Tarama ve Sektör Protokolü Ayarları" : "Scan Configuration"}
          >
            ⚙️
          </button>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="wg-scan-submit"
            id="btn-scan"
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0, display: "inline-block" }}></span>
                <span>{t.btnScanning}</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>{t.btnScan}</span>
              </>
            )}
          </button>
        </form>

        {/* Gelişmiş Ayarlar Çekmecesi (Crawler & Sektörel Protokol) */}
        {showConfigDrawer && (
          <div className="wg-config-drawer">
            <div className="crawler-options-bar" style={{ marginTop: 0 }}>
              <label className="crawler-toggle-label">
                <input
                  type="checkbox"
                  checked={enableCrawler}
                  onChange={(e) => setEnableCrawler(e.target.checked)}
                  disabled={loading}
                  className="crawler-checkbox"
                />
                <span className="crawler-toggle-title">{t.crawlerToggle}</span>
                <span className="crawler-toggle-subtitle">({t.crawlerSubtitle})</span>
              </label>

              {enableCrawler && (
                <div className="crawler-budget-selector">
                  <span className="budget-label">{t.pageBudget}:</span>
                  {[3, 5, 10].map((count) => (
                    <button
                      type="button"
                      key={count}
                      className={`budget-pill ${maxPages === count ? "active" : ""}`}
                      onClick={() => setMaxPages(count)}
                      disabled={loading}
                    >
                      {count} {lang === "tr" ? "Sayfa" : "Pages"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sector-selector-bar" style={{ marginTop: 0 }}>
              <div className="sector-selector-label">
                🏛️ {lang === "tr" ? "Sektörel Uyumluluk Protokolü:" : "Industry Compliance Protocol:"}
              </div>
              <div className="sector-pills-list">
                {(["AUTO", "GENERAL", "ECOMMERCE", "HEALTHCARE", "CORPORATE_GOV", "SAAS_API", "FINTECH_BANKING"] as SectorType[]).map((sec) => {
                  const info = SECTOR_LABELS[lang][sec];
                  const isActive = selectedSector === sec;
                  return (
                    <button
                      type="button"
                      key={sec}
                      className={`sector-pill ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedSector(sec)}
                      disabled={loading}
                      title={`${info.name} — ${info.standard}`}
                    >
                      <span className="sector-pill-icon">{info.icon}</span>
                      <span className="sector-pill-name">{info.name}</span>
                      <span className="sector-pill-std">{info.standard}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Son Taramalar ve Hızlı Hedef Çipleri */}
        <div className="wg-history-bar">
          <div className="wg-history-header-row">
            <span className="wg-history-label-badge">
              <span>🕒</span>
              <span>{recentScans.length > 0 ? t.recentAudits : t.quickTargets}</span>
              {recentScans.length > 0 && (
                <span className="wg-history-count-pill">{recentScans.length}</span>
              )}
            </span>
            {recentScans.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="wg-history-clear-btn"
                title={lang === "tr" ? "Son taranan siteleri temizle" : "Clear recent targets"}
              >
                <span>🗑️</span>
                <span>{t.clear}</span>
              </button>
            )}
          </div>

          <div className="wg-history-list">
            {(recentScans.length > 0
              ? recentScans
              : ["https://example.com", "https://google.com", "https://github.com"]
            ).map((hUrl) => {
              const match = hUrl.match(/^(https?:\/\/)(.*)$/i);
              const proto = match ? match[1] : "";
              const body = match ? match[2] : hUrl;
              return (
                <button
                  key={hUrl}
                  type="button"
                  onClick={() => {
                    setUrl(hUrl);
                    runScan(hUrl);
                  }}
                  className="wg-history-chip"
                  title={`${hUrl} - ${lang === "tr" ? "Tek tıkla hemen tara" : "Click to scan"}`}
                >
                  <span className="chip-icon">🌐</span>
                  {proto && <span className="chip-proto">{proto}</span>}
                  <span className="chip-body">{body}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <div className="scan-error" role="alert">{error}</div>}
      </section>

      {/* ── 3. ANA ÇALIŞMA ALANI (MAIN CONTENT) ── */}
      <main style={{ paddingBottom: 60 }}>
        {/* A. Henüz Tarama Başlatılmamışken: 4 Vitrin Kartı + PRD Zekası */}
        {!result && !loading && (
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px" }}>
            <div className="wg-pillars-grid">
              <div className="wg-pillar-card">
                <span className="wg-pillar-icon">🛡️</span>
                <h3 className="wg-pillar-title">
                  {lang === "tr" ? "Zafiyet & Sızma Kalkanı" : "Vulnerability & Exploits"}
                </h3>
                <p className="wg-pillar-desc">
                  {lang === "tr"
                    ? "DAST exploit doğrulama, WAF hata direnci, SSL/TLS şifreleme zinciri ve 3. taraf CSP sandbox güvenliği."
                    : "DAST exploit verification, WAF resilience, SSL/TLS cipher suite and third-party CSP sandboxing."}
                </p>
                <div className="wg-pillar-badges">
                  <span className="wg-pillar-badge">DAST Exploit</span>
                  <span className="wg-pillar-badge">WAF Bypass</span>
                  <span className="wg-pillar-badge">TLS / SSL</span>
                  <span className="wg-pillar-badge">CSP Sandbox</span>
                </div>
              </div>

              <div className="wg-pillar-card">
                <span className="wg-pillar-icon">⚡</span>
                <h3 className="wg-pillar-title">
                  {lang === "tr" ? "Performans & Dayanıklılık" : "Performance & Resilience"}
                </h3>
                <p className="wg-pillar-desc">
                  {lang === "tr"
                    ? "Core Web Vitals SLA, SPA bellek ve DOM sızıntısı tespiti, kaos hata enjeksiyonu ve hız sınırı dayanıklılığı."
                    : "Core Web Vitals SLA, SPA memory/DOM leak profiler, chaos fault injection and rate-limiting resilience."}
                </p>
                <div className="wg-pillar-badges">
                  <span className="wg-pillar-badge">p95 Latency</span>
                  <span className="wg-pillar-badge">Memory Leaks</span>
                  <span className="wg-pillar-badge">Chaos Faults</span>
                  <span className="wg-pillar-badge">Rate Limit</span>
                </div>
              </div>

              <div className="wg-pillar-card">
                <span className="wg-pillar-icon">🧠</span>
                <h3 className="wg-pillar-title">
                  {lang === "tr" ? "Mimari & Test Zekası" : "Architecture & Test Intelligence"}
                </h3>
                <p className="wg-pillar-desc">
                  {lang === "tr"
                    ? "Statik AST kod tabanı analizi, OpenAPI sözleşme sapması, PRD gereksinim spec ve kendini onaran E2E testler."
                    : "Static AST codebase analysis, OpenAPI contract drift, PRD requirements spec and self-healing E2E tests."}
                </p>
                <div className="wg-pillar-badges">
                  <span className="wg-pillar-badge">AST Architecture</span>
                  <span className="wg-pillar-badge">API Drift</span>
                  <span className="wg-pillar-badge">Auto-Heal</span>
                  <span className="wg-pillar-badge">PRD Spec</span>
                </div>
              </div>

              <div className="wg-pillar-card">
                <span className="wg-pillar-icon">🌐</span>
                <h3 className="wg-pillar-title">
                  {lang === "tr" ? "UX, Telemetri & SEO" : "UX, Telemetry & SEO"}
                </h3>
                <p className="wg-pillar-desc">
                  {lang === "tr"
                    ? "Isı haritası ve rage click tespiti, çok dilli (i18n) kusurları, Schema.org SEO ve otonom olay köprüsü entegrasyonu."
                    : "Heatmaps & rage click analysis, localization i18n audit, Schema.org SEO and automated incident webhook hub."}
                </p>
                <div className="wg-pillar-badges">
                  <span className="wg-pillar-badge">Incident Hub</span>
                  <span className="wg-pillar-badge">Heatmaps</span>
                  <span className="wg-pillar-badge">i18n Audit</span>
                  <span className="wg-pillar-badge">SEO Schema</span>
                </div>
              </div>
            </div>

            {/* PRD Intelligence Card */}
            <PrdIntelligenceCard targetUrl={url} lang={lang} />

            {/* Standalone Codebase View if toggled */}
            {showCodebaseStandalone && (
              <div style={{ marginTop: 24 }}>
                <CodebaseIntelligenceView />
              </div>
            )}
          </div>
        )}

        {/* B. Tarama Sırasında: Canlı HUD ve Ekran Kaydı */}
        {loading && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px" }}>
            <LiveScreencastPanel
              targetUrl={url}
              isActive={true}
              lang={lang}
              persona={selectedPersona}
              auditMode={auditMode}
            />
          </div>
        )}

        {/* C. Tarama Tamamlandığında: Executive Cockpit & 5-Hub Master Workspace */}
        {result && (
          <div className="cockpit-workspace">
            {/* 1. Executive Top Bar (Hedef Bilgisi, Sektör ve Rapor Butonları) */}
            <div className="cockpit-top-bar">
              <div className="cockpit-target-info">
                <div className="cockpit-status-icon">✓</div>
                <div className="cockpit-target-details">
                  <div className="cockpit-target-row">
                    <span className="cockpit-target-url">{result.target_url}</span>
                    <span className="cockpit-pill success">
                      {lang === "tr" ? "Denetim Tamamlandı" : "Audit Completed"}
                    </span>
                    {result.detected_sector && (
                      <span className="cockpit-pill sector">
                        {SECTOR_LABELS[lang][result.detected_sector]?.icon} {SECTOR_LABELS[lang][result.detected_sector]?.name}
                      </span>
                    )}
                  </div>
                  <div className="cockpit-target-meta">
                    {new Date(result.started_at).toLocaleTimeString("tr-TR")} • {result.crawled_pages_count} {lang === "tr" ? "Sayfa Taranarak İncelendi" : "Pages Crawled & Audited"}
                  </div>
                </div>
              </div>

              {/* Rapor & Dışa Aktarma Eylem Butonları */}
              <div className="cockpit-top-actions">
                <button
                  type="button"
                  onClick={() => setShowAuditReport(true)}
                  className="cockpit-action-btn"
                  title="Resmi Yönetici Denetim Raporu"
                >
                  <span>📄</span>
                  <span>PDF Raporu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowExecutiveDeck(true)}
                  className="cockpit-action-btn"
                  title="C-Level Yönetici Sunumu (16:9 Deck)"
                >
                  <span>📽️</span>
                  <span>Yönetici Sunumu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLiveScreencast(true)}
                  className="cockpit-action-btn"
                  title="Canlı Tarayıcı HUD Kaydı"
                >
                  <span>📺</span>
                  <span>Canlı HUD</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGeneralControl(true)}
                  className="cockpit-action-btn"
                  title="GeneralControl Kontrol Listesi"
                >
                  <span>🛡️</span>
                  <span>Checklist</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="cockpit-action-btn"
                  title="JSON Dışa Aktar"
                >
                  <span>💾</span>
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* 2. Executive Cockpit 4 KPI Sağlık Göstergeleri */}
            <div className="cockpit-scores-grid">
              <ScoreCard label={t.securityScore} score={result.security_score} color="#6366f1" />
              <ScoreCard label={t.uxScore} score={result.ux_score} color="#34d399" />
              <ScoreCard
                label={lang === "tr" ? "Uyumluluk & Standartlar" : "Compliance & Standards"}
                score={result.compliance_score ?? 100}
                color="#f59e0b"
              />
              <ScoreCard
                label={lang === "tr" ? "Dayanıklılık & Sağlamlık" : "Resilience & Health"}
                score={result.resilience_score ?? 95}
                color="#0ea5e9"
              />
            </div>

            {/* 3. Kritik & Acil Uyarı Çubuğu */}
            {criticalFindings.length > 0 && (
              <div className="cockpit-alert-banner">
                <div className="cockpit-alert-content">
                  <span className="cockpit-alert-icon">🚨</span>
                  <div>
                    <div className="cockpit-alert-title">
                      {criticalFindings.length} {lang === "tr" ? "Kritik & Yüksek Riskli Zafiyet Tespit Edildi!" : "Critical & High Risk Vulnerabilities Detected!"}
                    </div>
                    <div className="cockpit-alert-desc">
                      {lang === "tr"
                        ? "Öncelikli müdahale gerektiren güvenlik açıkları ve hizmet kesintisi riskleri sistem tarafından işaretlendi."
                        : "High-priority security flaws and service disruption risks require immediate remediation."}
                    </div>
                  </div>
                </div>

                <div className="cockpit-alert-actions">
                  <button
                    type="button"
                    onClick={() => setActiveTab("FINDINGS")}
                    className="cockpit-alert-btn"
                  >
                    {lang === "tr" ? "Bulguları İncele →" : "Review Findings →"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("INCIDENT_HUB")}
                    className="cockpit-action-btn"
                    style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#fca5a5" }}
                  >
                    📢 {lang === "tr" ? "Olay Köprüsü (Slack/Jira)" : "Incident Hub"}
                  </button>
                </div>
              </div>
            )}

            {/* 4. İki Sütunlu Çalışma Alanı: Sol 5-Hub Master Sidebar + Sağ İçerik */}
            <div className="cockpit-grid">
              {/* ── SOL SÜTUN: 5-HUB MASTER SIDEBAR ── */}
              <aside className="cockpit-sidebar">
                {/* Arama / Filtreleme Çubuğu */}
                <div className="cockpit-search-box">
                  <span>🔍</span>
                  <input
                    type="text"
                    value={sidebarFilter}
                    onChange={(e) => setSidebarFilter(e.target.value)}
                    placeholder={lang === "tr" ? "Modüllerde ara (WAF, SEO, DAST...)" : "Search modules (WAF, SEO...)"}
                    className="cockpit-search-input"
                  />
                </div>

                {/* Genel Bakış Butonu (Executive Cockpit Overview) */}
                <button
                  type="button"
                  onClick={() => setActiveTab("OVERVIEW")}
                  className={`cockpit-item-btn ${activeTab === "OVERVIEW" ? "active" : ""}`}
                  style={{
                    padding: "12px 14px",
                    background: activeTab === "OVERVIEW" ? "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)" : undefined,
                  }}
                >
                  <div className="cockpit-item-label" style={{ fontWeight: 700 }}>
                    <span style={{ fontSize: 16 }}>🏠</span>
                    <span>{lang === "tr" ? "Genel Bakış & Cockpit" : "Overview & Cockpit"}</span>
                  </div>
                  <span className="cockpit-item-badge info">Cockpit</span>
                </button>

                {/* 5 Tematik Hub Grupları */}
                {NAVIGATION_HUBS.map((hub) => {
                  const filteredItems = hub.items.filter((item) =>
                    !sidebarFilter || item.label.toLowerCase().includes(sidebarFilter.toLowerCase())
                  );
                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={hub.id} className="cockpit-hub-card">
                      <div className="cockpit-hub-head">
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{hub.icon}</span>
                          <span>{hub.title}</span>
                        </div>
                        <span style={{ opacity: 0.6 }}>{filteredItems.length}</span>
                      </div>

                      <div className="cockpit-hub-items">
                        {filteredItems.map((item) => {
                          const isActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveTab(item.id)}
                              className={`cockpit-item-btn ${isActive ? "active" : ""}`}
                            >
                              <div className="cockpit-item-label">
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                              </div>
                              {item.badge && (
                                <span className={`cockpit-item-badge ${isActive ? "" : item.badgeVariant}`}>
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </aside>

              {/* ── SAĞ SÜTUN: SEÇİLEN MODÜL ÇALIŞMA ALANI ── */}
              <div className="cockpit-main-content">
                {/* ── A. GENEL BAKIŞ & COCKPIT EKRANI (OVERVIEW) ── */}
                {activeTab === "OVERVIEW" && (
                  <div className="cockpit-overview-section">
                    {/* Hızlı Özet Kartları */}
                    <div className="cockpit-summary-cards">
                      {/* Güvenlik Özeti */}
                      <div className="cockpit-summary-box">
                        <div className="cockpit-summary-header">
                          <div className="cockpit-summary-title">
                            <span>🛡️</span>
                            <span>{lang === "tr" ? "Güvenlik & Tehdit Analizi" : "Security & Threat Summary"}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab("DAST")}
                            className="cockpit-summary-link"
                          >
                            {lang === "tr" ? "İncele →" : "View →"}
                          </button>
                        </div>
                        <div className="cockpit-kpi-row">
                          <div className="cockpit-kpi-cell">
                            <div className="cockpit-kpi-label">{lang === "tr" ? "DAST Açığı" : "DAST Flaws"}</div>
                            <div className="cockpit-kpi-val" style={{ color: "#f87171" }}>
                              {result.dast_verification?.confirmed_vulnerabilities_count ?? 0}
                            </div>
                          </div>
                          <div className="cockpit-kpi-cell">
                            <div className="cockpit-kpi-label">{lang === "tr" ? "WAF Koruması" : "WAF Protection"}</div>
                            <div className="cockpit-kpi-val" style={{ color: "#34d399" }}>
                              {result.waf_resilience?.waf_protection_score ?? 100}%
                            </div>
                          </div>
                          <div className="cockpit-kpi-cell">
                            <div className="cockpit-kpi-label">SSL Labs</div>
                            <div className="cockpit-kpi-val" style={{ color: "#38bdf8" }}>
                              {result.tls_crypto_report?.ssl_labs_grade ?? "A+"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Performans & Sistem Sağlığı Özeti */}
                      <div className="cockpit-summary-box">
                        <div className="cockpit-summary-header">
                          <div className="cockpit-summary-title">
                            <span>⚡</span>
                            <span>{lang === "tr" ? "Performans & Sistem Sağlığı" : "Performance & System Health"}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab("PERFORMANCE")}
                            className="cockpit-summary-link"
                          >
                            {lang === "tr" ? "İncele →" : "View →"}
                          </button>
                        </div>
                        <div className="cockpit-kpi-row">
                          <div className="cockpit-kpi-cell">
                            <div className="cockpit-kpi-label">{lang === "tr" ? "p95 Gecikme" : "p95 Latency"}</div>
                            <div className="cockpit-kpi-val" style={{ color: "#fbbf24" }}>
                              {result.performance_metrics?.p95_latency_ms ?? 120}ms
                            </div>
                          </div>
                          <div className="cockpit-kpi-cell">
                            <div className="cockpit-kpi-label">{lang === "tr" ? "Bellek Sağlığı" : "Memory Health"}</div>
                            <div className="cockpit-kpi-val" style={{ color: "#34d399" }}>
                              {result.memory_leak_report?.memory_health_score ?? 100}%
                            </div>
                          </div>
                          <div className="cockpit-kpi-cell">
                            <div className="cockpit-kpi-label">{lang === "tr" ? "Kaos Direnci" : "Chaos Resilience"}</div>
                            <div className="cockpit-kpi-val" style={{ color: "#818cf8" }}>
                              {result.chaos_resilience?.chaos_resilience_score ?? 100}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ağ İstek Şelalesi Önizlemesi */}
                    {result.network_traces && result.network_traces.length > 0 && (
                      <NetworkWaterfallCard traces={result.network_traces} />
                    )}

                    {/* Öncelikli İlk 5 Kritik Bulgu */}
                    <div className="cockpit-findings-box">
                      <div className="cockpit-findings-header">
                        <div>
                          <div className="cockpit-findings-title">
                            {lang === "tr" ? "Öncelikli Eylem Gerektiren Bulgular" : "Priority Actionable Findings"}
                          </div>
                          <div className="cockpit-findings-subtitle">
                            {lang === "tr"
                              ? `Sistemdeki toplam ${result.findings.length} bulgu arasından en yüksek risk taşıyanlar listelenmektedir.`
                              : `Top high-risk findings among ${result.findings.length} total detected issues.`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab("FINDINGS")}
                          className="cockpit-findings-btn"
                        >
                          {lang === "tr" ? `Tüm Bulguları Aç (${result.findings.length}) →` : `All Findings (${result.findings.length}) →`}
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {result.findings.slice(0, 5).map((f) => (
                          <FindingCard key={f.id} finding={f} lang={lang} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── B. MODÜL GÖRÜNÜMLERİ (TAB RENDERING) ── */}

                {/* 1. GÜVENLİK HUB MODÜLLERİ */}
                {activeTab === "ETHICAL_SECURITY" && (
                  <EthicalSecurityReportView report={result.ethical_security_report} lang={lang} />
                )}
                {activeTab === "DAST" && (
                  <DASTVerificationView report={result.dast_verification} lang={lang} />
                )}
                {activeTab === "WAF" && (
                  <WAFResilienceView report={result.waf_resilience} lang={lang} />
                )}
                {activeTab === "THIRDPARTY" && (
                  <ThirdPartySecurityView report={result.third_party_security_report} lang={lang} />
                )}
                {activeTab === "TLS_CRYPTO" && (
                  <TLSCryptoView report={result.tls_crypto_report} lang={lang} />
                )}
                {activeTab === "DATABASE" && (
                  <DatabaseSlowQueryView report={result.database_leak_report} lang={lang} />
                )}
                {activeTab === "RATELIMIT" && (
                  <RateLimitResilienceView report={result.rate_limit_resilience} lang={lang} />
                )}

                {/* 2. PERFORMANS HUB MODÜLLERİ */}
                {activeTab === "PERFORMANCE" && (
                  <PerformanceView
                    metrics={result.performance_metrics}
                    findings={result.findings}
                    lang={lang}
                  />
                )}
                {activeTab === "MEMORY" && (
                  <MemoryLeakView report={result.memory_leak_report} lang={lang} />
                )}
                {activeTab === "CHAOS" && (
                  <ChaosEngineeringView report={result.chaos_resilience} lang={lang} />
                )}
                {activeTab === "VIEWPORT" && (
                  <MultiViewportView report={result.multi_viewport_report} lang={lang} />
                )}

                {/* 3. MİMARİ VE TEST HUB MODÜLLERİ */}
                {activeTab === "CODEBASE" && (
                  <CodebaseIntelligenceView initialReport={result.codebase_intelligence} />
                )}
                {activeTab === "APICONTRACT" && (
                  <APIContractDriftView report={result.api_contract_drift} lang={lang} />
                )}
                {activeTab === "AUTO_HEAL" && (
                  <AutoHealView
                    targetUrl={result.target_url}
                    selfHealingEvents={result.self_healing_events}
                    resilienceScore={result.resilience_score ?? 95}
                    lang={lang}
                  />
                )}
                {activeTab === "PRD" && (
                  <PrdIntelligenceCard
                    targetUrl={result.target_url}
                    initialAnalysis={result.prd_analysis}
                    lang={lang}
                  />
                )}

                {/* 4. UX & SEO HUB MODÜLLERİ */}
                {activeTab === "FINDINGS" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {selectedRouteUrl && (
                      <div className="cockpit-route-filter">
                        <span>
                          {lang === "tr" ? "Filtrelenen Rota:" : "Filtered Route:"}{" "}
                          <strong>{selectedRouteUrl}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedRouteUrl(null)}
                          style={{
                            background: "rgba(6, 182, 212, 0.2)",
                            border: "1px solid rgba(6, 182, 212, 0.4)",
                            color: "#cffafe",
                            borderRadius: 6,
                            padding: "3px 8px",
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          ✕ {t.allRoutes}
                        </button>
                      </div>
                    )}

                    <RcaTriageBar
                      findings={result.findings}
                      selectedRca={rcaFilter}
                      onSelectRca={(rca) => setRcaFilter(rca)}
                      lang={lang}
                    />

                    <div className="cockpit-filter-toolbar">
                      <div className="cockpit-filter-group">
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                          {lang === "tr" ? "Kategori:" : "Category:"}
                        </span>
                        {(["ALL", "SECURITY", "UX"] as const).map((cat) => (
                          <button
                            key={cat}
                            className={`cockpit-filter-pill ${categoryFilter === cat ? "active" : ""}`}
                            onClick={() => setCategoryFilter(cat)}
                          >
                            {CATEGORY_LABELS[lang][cat]}
                          </button>
                        ))}
                      </div>

                      <div className="cockpit-filter-group">
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                          {lang === "tr" ? "Seviye:" : "Severity:"}
                        </span>
                        {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((sev) => (
                          <button
                            key={sev}
                            className={`cockpit-filter-pill ${severityFilter === sev ? "active" : ""}`}
                            onClick={() => setSeverityFilter(sev)}
                          >
                            {SEVERITY_LABELS[lang][sev]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
                      <span>{t.findingsSection}</span>
                      <span>
                        {t.showing} {filteredFindings.length} / {result.findings.length} {t.issues}
                      </span>
                    </div>

                    {filteredFindings.length === 0 ? (
                      <div className="cockpit-summary-box" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
                        {t.noIssues}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }} id="findings-list">
                        {filteredFindings.map((f) => (
                          <FindingCard key={f.id} finding={f} lang={lang} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "PERSONA" && (
                  <UserPersonaReportView report={result.persona_audit_report} lang={lang} />
                )}
                {activeTab === "SESSION_REPLAY" && (
                  <SessionReplayHeatmapView report={result.session_replay} lang={lang} />
                )}
                {activeTab === "LOCALIZATION" && (
                  <LocalizationAuditView report={result.localization_audit} lang={lang} />
                )}
                {activeTab === "SEO_DATA" && (
                  <SEOStructuredDataView report={result.seo_structured_data_report} lang={lang} />
                )}
                {activeTab === "CRAWL_GRAPH" && (
                  <CrawlGraphView
                    nodes={result.crawl_graph}
                    lang={lang}
                    selectedRouteUrl={selectedRouteUrl}
                    onSelectRoute={(route) => {
                      setSelectedRouteUrl(route);
                      if (route) setActiveTab("FINDINGS");
                    }}
                  />
                )}

                {/* 5. OPERASYON VE OLAY MERKEZİ */}
                {activeTab === "INCIDENT_HUB" && result.incident_hub_report && (
                  <IncidentHubView report={result.incident_hub_report} />
                )}
              </div>
            </div>

            {/* ── MODALLER ── */}
            <GeneralControlModal
              isOpen={showGeneralControl}
              onClose={() => setShowGeneralControl(false)}
              findings={result.findings}
              lang={lang}
              onSelectFinding={(fid) => {
                setActiveTab("FINDINGS");
                setTimeout(() => {
                  const card = document.getElementById(`finding-${fid}`);
                  if (card) {
                    card.scrollIntoView({ behavior: "smooth", block: "center" });
                    card.style.outline = "2px solid #818cf8";
                    setTimeout(() => {
                      card.style.outline = "none";
                    }, 2500);
                  }
                }, 200);
              }}
            />

            <AuditReportModal
              isOpen={showAuditReport}
              onClose={() => setShowAuditReport(false)}
              result={result}
              lang={lang}
              onOpenDeck={() => setShowExecutiveDeck(true)}
            />

            <ExecutiveDeckModal
              isOpen={showExecutiveDeck}
              onClose={() => setShowExecutiveDeck(false)}
              result={result}
              lang={lang}
            />

            {showLiveScreencast && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(10, 11, 16, 0.85)",
                  backdropFilter: "blur(12px)",
                  zIndex: 100,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 20,
                }}
              >
                <div style={{ maxWidth: 900, width: "100%" }}>
                  <LiveScreencastPanel
                    targetUrl={result.target_url}
                    isActive={false}
                    lang={lang}
                    persona={result.persona || selectedPersona}
                    auditMode={result.audit_mode || auditMode}
                    onClose={() => setShowLiveScreencast(false)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
