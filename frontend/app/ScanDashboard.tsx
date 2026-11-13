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
      });
      if (data.status === "FAILED") {
        setError(data.error_message ?? "Scan failed.");
      } else {
        const sorted = [...data.findings].sort(
          (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
        );
        setResult({ ...data, findings: sorted });
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
  const NAVIGATION_HUBS = useMemo(() => {
    if (!result) return [];
    return [
      {
        id: "SECURITY",
        title: lang === "tr" ? "Güvenlik & Uyum" : "Security & Compliance",
        icon: "🛡️",
        items: [
          {
            id: "DAST" as DashboardTab,
            label: lang === "tr" ? "DAST Zafiyet Doğrulama" : "DAST Exploit Verification",
            icon: "🎯",
            badge: result.dast_verification?.confirmed_vulnerabilities_count
              ? `${result.dast_verification.confirmed_vulnerabilities_count} Açık`
              : "Temiz",
            badgeColor: result.dast_verification?.confirmed_vulnerabilities_count
              ? "bg-rose-950 text-rose-300 border-rose-800"
              : "bg-emerald-950/60 text-emerald-400 border-emerald-800",
          },
          {
            id: "WAF" as DashboardTab,
            label: lang === "tr" ? "WAF & Hata Direnci" : "WAF & Error Resilience",
            icon: "🛡️",
            badge: result.waf_resilience ? `${result.waf_resilience.waf_protection_score}%` : null,
            badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          },
          {
            id: "THIRDPARTY" as DashboardTab,
            label: lang === "tr" ? "3. Taraf Script & CSP" : "3rd-Party & CSP Sandbox",
            icon: "🔒",
            badge: result.third_party_security_report
              ? `${result.third_party_security_report.csp_grade} (${result.third_party_security_report.security_score}%)`
              : null,
            badgeColor: "bg-indigo-950 text-indigo-300 border-indigo-800",
          },
          {
            id: "TLS_CRYPTO" as DashboardTab,
            label: lang === "tr" ? "SSL/TLS & Kripto" : "TLS/SSL & Cipher Suites",
            icon: "🔐",
            badge: result.tls_crypto_report ? `${result.tls_crypto_report.ssl_labs_grade}` : null,
            badgeColor: "bg-cyan-950 text-cyan-300 border-cyan-800",
          },
          {
            id: "DATABASE" as DashboardTab,
            label: lang === "tr" ? "Veritabanı Sızıntıları" : "Database & Query Leaks",
            icon: "🗄️",
            badge: result.database_leak_report?.total_leaks_count
              ? `${result.database_leak_report.total_leaks_count} Sızıntı`
              : "Temiz",
            badgeColor: result.database_leak_report?.total_leaks_count
              ? "bg-rose-950 text-rose-300 border-rose-800"
              : "bg-emerald-950/60 text-emerald-400 border-emerald-800",
          },
          {
            id: "RATELIMIT" as DashboardTab,
            label: lang === "tr" ? "Hız Sınırı & Kaba Kuvvet" : "Rate-Limiting & Brute-Force",
            icon: "⏱️",
            badge: result.rate_limit_resilience ? `${result.rate_limit_resilience.resilience_score}%` : null,
            badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          },
        ],
      },
      {
        id: "PERFORMANCE",
        title: lang === "tr" ? "Performans & Dayanıklılık" : "Performance & Resilience",
        icon: "⚡",
        items: [
          {
            id: "PERFORMANCE" as DashboardTab,
            label: lang === "tr" ? "Web Vitals & SLA" : "Core Web Vitals & SLA",
            icon: "⚡",
            badge: result.performance_metrics?.p95_latency_ms
              ? `${result.performance_metrics.p95_latency_ms}ms`
              : null,
            badgeColor: "bg-amber-950 text-amber-300 border-amber-800",
          },
          {
            id: "MEMORY" as DashboardTab,
            label: lang === "tr" ? "Bellek & DOM Sızıntısı" : "SPA Memory & DOM Leaks",
            icon: "🧠",
            badge: result.memory_leak_report?.total_leaks_count
              ? `${result.memory_leak_report.total_leaks_count} Sızıntı`
              : `${result.memory_leak_report?.memory_health_score ?? 100}%`,
            badgeColor: result.memory_leak_report?.total_leaks_count
              ? "bg-rose-950 text-rose-300 border-rose-800"
              : "bg-emerald-950/60 text-emerald-400 border-emerald-800",
          },
          {
            id: "CHAOS" as DashboardTab,
            label: lang === "tr" ? "Kaos Mühendisliği" : "Chaos Fault Injection",
            icon: "💥",
            badge: result.chaos_resilience ? `${result.chaos_resilience.chaos_resilience_score}%` : null,
            badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          },
          {
            id: "VIEWPORT" as DashboardTab,
            label: lang === "tr" ? "Çoklu Cihaz / Responsive" : "Multi-Viewport Layout",
            icon: "📱",
            badge: result.multi_viewport_report
              ? `${result.multi_viewport_report.overall_responsive_score}%`
              : null,
            badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          },
        ],
      },
      {
        id: "ARCHITECTURE",
        title: lang === "tr" ? "Mimari & Test Zekası" : "Architecture & QA Intelligence",
        icon: "🧠",
        items: [
          {
            id: "CODEBASE" as DashboardTab,
            label: lang === "tr" ? "Kod Tabanı & AST" : "Codebase & AST Architecture",
            icon: "🧬",
            badge: result.codebase_intelligence
              ? `${result.codebase_intelligence.total_symbols} Sembol`
              : null,
            badgeColor: "bg-indigo-950 text-indigo-300 border-indigo-800",
          },
          {
            id: "APICONTRACT" as DashboardTab,
            label: lang === "tr" ? "API Sözleşme (OpenAPI)" : "API Contract Drift",
            icon: "📋",
            badge: result.api_contract_drift
              ? `${result.api_contract_drift.contract_compatibility_score}%`
              : null,
            badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          },
          {
            id: "AUTO_HEAL" as DashboardTab,
            label: lang === "tr" ? "Auto-Heal (Flaky Tests)" : "Self-Healing E2E Tests",
            icon: "🧪",
            badge: result.self_healing_events?.length
              ? `${result.self_healing_events.length} Onarım`
              : null,
            badgeColor: "bg-emerald-950/60 text-emerald-400 border-emerald-800",
          },
          {
            id: "PRD" as DashboardTab,
            label: lang === "tr" ? "PRD Zekası & Spec" : "PRD Requirements Spec",
            icon: "📝",
            badge: result.prd_analysis?.scenarios?.length
              ? `${result.prd_analysis.scenarios.length} Senaryo`
              : null,
            badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          },
        ],
      },
      {
        id: "EXPERIENCE",
        title: lang === "tr" ? "UX, Telemetri & SEO" : "UX, Telemetry & SEO",
        icon: "🌐",
        items: [
          {
            id: "FINDINGS" as DashboardTab,
            label: lang === "tr" ? "Tüm Bulgular & Triyaj" : "All Findings & Triage",
            icon: "📋",
            badge: `${result.findings.length} Bulgu`,
            badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          },
          {
            id: "SESSION_REPLAY" as DashboardTab,
            label: lang === "tr" ? "Isı Haritası & Rage Click" : "Session Replay & Heatmap",
            icon: "🎬",
            badge: result.session_replay?.rage_clicks_count
              ? `${result.session_replay.rage_clicks_count} Rage`
              : "0 Rage",
            badgeColor: result.session_replay?.rage_clicks_count
              ? "bg-amber-950 text-amber-300 border-amber-800"
              : "bg-slate-800 text-slate-400 border-slate-700",
          },
          {
            id: "LOCALIZATION" as DashboardTab,
            label: lang === "tr" ? "Çok Dilli (i18n) & L10n" : "Localization & i18n",
            icon: "🌐",
            badge: result.localization_audit?.total_defects_count
              ? `${result.localization_audit.total_defects_count} Kusur`
              : `${result.localization_audit?.l10n_score ?? 100}%`,
            badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          },
          {
            id: "SEO_DATA" as DashboardTab,
            label: lang === "tr" ? "SEO & Sosyal Paylaşım" : "SEO & Structured Data",
            icon: "🏷️",
            badge: result.seo_structured_data_report
              ? `${result.seo_structured_data_report.seo_health_score}%`
              : null,
            badgeColor: "bg-cyan-950 text-cyan-300 border-cyan-800",
          },
          {
            id: "CRAWL_GRAPH" as DashboardTab,
            label: lang === "tr" ? "Site Keşif Ağacı" : "Autonomous Site Graph",
            icon: "🗺️",
            badge: `${result.crawl_graph?.length ?? result.crawled_pages_count ?? 1} Sayfa`,
            badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          },
        ],
      },
      {
        id: "OPERATIONS",
        title: lang === "tr" ? "Olay Yönetimi & Raporlar" : "Operations & Reporting",
        icon: "📢",
        items: [
          {
            id: "INCIDENT_HUB" as DashboardTab,
            label: lang === "tr" ? "Olay Köprüsü (Webhook)" : "Incident Dispatch Hub",
            icon: "📢",
            badge: result.incident_hub_report
              ? `${result.incident_hub_report.total_incidents_generated} Olay`
              : null,
            badgeColor: "bg-rose-950 text-rose-300 border-rose-800 font-bold",
          },
        ],
      },
    ];
  }, [result, lang]);

  return (
    <div className="min-h-screen bg-[#0a0b10] text-slate-100 font-sans selection:bg-indigo-600 selection:text-white">
      {/* ── ÜST KURUMSAL HEADER ── */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-black text-white text-base shadow-lg shadow-indigo-500/20">
              WG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">
                  WebGuard
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  v2.0 Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Otonom Güvenlik, Performans ve UX Kalite Denetleme Platformu
              </p>
            </div>
          </div>

          {/* Hızlı Aksiyonlar & Dil Seçici */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition ${
                showCodebaseStandalone
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "bg-slate-900 text-indigo-300 border-indigo-500/30 hover:bg-slate-850"
              }`}
              onClick={() => setShowCodebaseStandalone(!showCodebaseStandalone)}
              title="Statik Kod Tabanı ve Mimari Zeka Raporunu İncele"
            >
              🧠 <span className="hidden sm:inline">{lang === "tr" ? "Kod Mimarisi" : "Codebase"}</span>
            </button>

            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                className={`px-2 py-1 text-xs font-semibold rounded-md transition ${
                  lang === "tr" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => setLang("tr")}
              >
                🇹🇷 TR
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-xs font-semibold rounded-md transition ${
                  lang === "en" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => setLang("en")}
              >
                🇬🇧 EN
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── ARAMA VE HEDEF GİRİŞ BARI ── */}
      <section className="bg-gradient-to-b from-slate-950 via-slate-900/60 to-transparent pt-8 pb-6 border-b border-slate-800/40">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          <form onSubmit={handleScan} className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-base">
                🌐
              </span>
              <input
                id="url-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.urlPlaceholder}
                disabled={loading}
                autoComplete="url"
                spellCheck={false}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  <span>{t.btnScanning}</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>{t.btnScan}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowConfigDrawer(!showConfigDrawer)}
              className={`p-3 rounded-xl border text-sm font-semibold transition ${
                showConfigDrawer
                  ? "bg-slate-800 text-cyan-400 border-cyan-500/50 shadow"
                  : "bg-slate-900 text-slate-400 border-slate-700/80 hover:text-slate-200 hover:bg-slate-800"
              }`}
              title="Gelişmiş Tarama ve Sektör Protokolü Ayarları"
            >
              ⚙️
            </button>
          </form>

          {/* Gelişmiş Ayarlar Çekmecesi (Accordion) */}
          {showConfigDrawer && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={enableCrawler}
                    onChange={(e) => setEnableCrawler(e.target.checked)}
                    disabled={loading}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-200">{t.crawlerToggle}</span>
                  <span className="text-slate-400">({t.crawlerSubtitle})</span>
                </label>

                {enableCrawler && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">{t.pageBudget}:</span>
                    {[3, 5, 10].map((count) => (
                      <button
                        type="button"
                        key={count}
                        onClick={() => setMaxPages(count)}
                        disabled={loading}
                        className={`px-2.5 py-1 rounded-md font-semibold text-xs transition ${
                          maxPages === count
                            ? "bg-cyan-500 text-slate-950 font-bold"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {count} Sayfa
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sektörel Uyumluluk Seçici */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <span>🏛️</span>
                  <span>{lang === "tr" ? "Sektörel Uyumluluk Protokolü:" : "Industry Compliance Protocol:"}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(["AUTO", "GENERAL", "ECOMMERCE", "HEALTHCARE", "CORPORATE_GOV", "SAAS_API", "FINTECH_BANKING"] as SectorType[]).map((sec) => {
                    const info = SECTOR_LABELS[lang][sec];
                    const isActive = selectedSector === sec;
                    return (
                      <button
                        type="button"
                        key={sec}
                        onClick={() => setSelectedSector(sec)}
                        disabled={loading}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition flex items-center gap-1 ${
                          isActive
                            ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                            : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                        }`}
                        title={`${info.name} — ${info.standard}`}
                      >
                        <span>{info.icon}</span>
                        <span>{info.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Son Taramalar Çipleri */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-slate-500 font-medium whitespace-nowrap">
                {recentScans.length > 0 ? t.recentAudits : t.quickTargets}:
              </span>
              {(recentScans.length > 0
                ? recentScans
                : ["https://example.com", "https://google.com", "https://github.com"]
              ).map((hUrl) => (
                <button
                  key={hUrl}
                  type="button"
                  onClick={() => {
                    setUrl(hUrl);
                    runScan(hUrl);
                  }}
                  className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition truncate max-w-[200px]"
                >
                  {hUrl}
                </button>
              ))}
            </div>

            {recentScans.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="text-slate-500 hover:text-rose-400 transition ml-2 whitespace-nowrap"
              >
                {t.clear}
              </button>
            )}
          </div>

          {error && (
            <div className="p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── ANA İÇERİK ALANI ── */}
      <main className="max-w-[1520px] mx-auto px-4 py-6">
        {!result && !loading && (
          <div className="max-w-4xl mx-auto space-y-6">
            <PrdIntelligenceCard targetUrl={url} lang={lang} />
            {showCodebaseStandalone && <CodebaseIntelligenceView />}
          </div>
        )}

        {loading && (
          <div className="max-w-4xl mx-auto">
            <LiveScreencastPanel targetUrl={url} isActive={true} lang={lang} />
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* ── 1. KOMUTA MERKEZİ (EXECUTIVE COCKPIT) ÜST BARI ── */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 backdrop-blur-md shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-xl">
                  ✓
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-200 text-sm">{result.target_url}</span>
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-semibold">
                      Denetim Tamamlandı
                    </span>
                    {result.detected_sector && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 font-semibold flex items-center gap-1">
                        <span>{SECTOR_LABELS[lang][result.detected_sector]?.icon}</span>
                        <span>{SECTOR_LABELS[lang][result.detected_sector]?.name}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(result.started_at).toLocaleTimeString("tr-TR")} • {result.crawled_pages_count} Sayfa Taranarak İncelendi
                  </div>
                </div>
              </div>

              {/* Rapor & Dışa Aktarma Eylem Butonları */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowAuditReport(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                  title="Resmi Yönetici Denetim Raporu"
                >
                  <span>📄</span>
                  <span>PDF Raporu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowExecutiveDeck(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                  title="C-Level Yönetici Sunumu (16:9 Deck)"
                >
                  <span>📽️</span>
                  <span>Yönetici Sunumu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLiveScreencast(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                  title="Canlı Tarayıcı HUD Kaydı"
                >
                  <span>📺</span>
                  <span>Canlı HUD</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGeneralControl(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                  title="GeneralControl Kontrol Listesi"
                >
                  <span>🛡️</span>
                  <span>Checklist</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                  title="JSON Dışa Aktar"
                >
                  <span>💾</span>
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* ── 2. EXECUTIVE COCKPIT SAĞLIK KARTLARI ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

            {/* ── 3. KRİTİK EYLEM VE ACİL UYARI ÇUBUĞU ── */}
            {criticalFindings.length > 0 && (
              <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl animate-pulse">🚨</span>
                  <div>
                    <div className="text-xs font-bold text-rose-300">
                      {criticalFindings.length} Kritik & Yüksek Riskli Zafiyet Tespit Edildi!
                    </div>
                    <div className="text-[11px] text-rose-400/80">
                      Öncelikli müdahale gerektiren güvenlik açıkları ve hizmet kesintisi riskleri sistem tarafından işaretlendi.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("FINDINGS")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition shadow"
                  >
                    Bulguları İncele →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("INCIDENT_HUB")}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-800 transition"
                  >
                    📢 Olay Köprüsü (Slack/Jira)
                  </button>
                </div>
              </div>
            )}

            {/* ── 4. İKİ SÜTUNLU ÇALIŞMA ALANI: 5-HUB SOL KENAR ÇUBUĞU + SAĞ ÇALIŞMA ALANI ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ── SOL SÜTUN: 5 TEMATİK HUB MENÜSÜ (260px / 3 COL) ── */}
              <aside className="lg:col-span-3 space-y-4">
                {/* Arama / Filtreleme Çubuğu */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                  <input
                    type="text"
                    value={sidebarFilter}
                    onChange={(e) => setSidebarFilter(e.target.value)}
                    placeholder="Modüllerde ara (WAF, SEO, DAST...)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Genel Bakış Butonu (Cockpit Overview) */}
                <button
                  type="button"
                  onClick={() => setActiveTab("OVERVIEW")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition ${
                    activeTab === "OVERVIEW"
                      ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white border-transparent shadow-lg shadow-indigo-600/20"
                      : "bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-850 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏠</span>
                    <span>Genel Bakış & Özet Cockpit</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950/60 text-cyan-300 border border-cyan-800/40">
                    Cockpit
                  </span>
                </button>

                {/* 5 Tematik Hub Grupları */}
                <div className="space-y-3">
                  {NAVIGATION_HUBS.map((hub) => {
                    const filteredItems = hub.items.filter((item) =>
                      !sidebarFilter || item.label.toLowerCase().includes(sidebarFilter.toLowerCase())
                    );
                    if (filteredItems.length === 0) return null;

                    return (
                      <div
                        key={hub.id}
                        className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm"
                      >
                        <div className="px-3.5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <div className="flex items-center gap-1.5">
                            <span>{hub.icon}</span>
                            <span>{hub.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{filteredItems.length}</span>
                        </div>

                        <div className="p-1 space-y-0.5">
                          {filteredItems.map((item) => {
                            const isActive = activeTab === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                                  isActive
                                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <span>{item.icon}</span>
                                  <span className="truncate">{item.label}</span>
                                </div>
                                {item.badge && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded border whitespace-nowrap ${
                                      isActive
                                        ? "bg-white/20 text-white border-white/30"
                                        : item.badgeColor
                                    }`}
                                  >
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
                </div>
              </aside>

              {/* ── SAĞ SÜTUN: SEÇİLEN MODÜL ÇALIŞMA ALANI (9 COL) ── */}
              <div className="lg:col-span-9 space-y-4">
                {/* ── GENEL BAKIŞ & COCKPIT EKRANI (OVERVIEW) ── */}
                {activeTab === "OVERVIEW" && (
                  <div className="space-y-6">
                    {/* Hızlı Kategori Kartları */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Güvenlik Özeti */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🛡️</span>
                            <h3 className="font-bold text-slate-200 text-sm">Güvenlik & Tehdit Analizi</h3>
                          </div>
                          <button
                            onClick={() => setActiveTab("DAST")}
                            className="text-xs text-cyan-400 hover:underline"
                          >
                            İncele →
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400">DAST Açığı</div>
                            <div className="text-lg font-bold text-rose-400">
                              {result.dast_verification?.confirmed_vulnerabilities_count ?? 0}
                            </div>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400">WAF Skoru</div>
                            <div className="text-lg font-bold text-emerald-400">
                              {result.waf_resilience?.waf_protection_score ?? 100}%
                            </div>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400">SSL Labs</div>
                            <div className="text-lg font-bold text-cyan-400">
                              {result.tls_crypto_report?.ssl_labs_grade ?? "A+"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Performans & SLA Özeti */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            <h3 className="font-bold text-slate-200 text-sm">Performans & Sistem Sağlığı</h3>
                          </div>
                          <button
                            onClick={() => setActiveTab("PERFORMANCE")}
                            className="text-xs text-cyan-400 hover:underline"
                          >
                            İncele →
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400">p95 Gecikme</div>
                            <div className="text-lg font-bold text-amber-400">
                              {result.performance_metrics?.p95_latency_ms ?? 120}ms
                            </div>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400">Bellek Sağlığı</div>
                            <div className="text-lg font-bold text-emerald-400">
                              {result.memory_leak_report?.memory_health_score ?? 100}%
                            </div>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400">Kaos Direnci</div>
                            <div className="text-lg font-bold text-indigo-400">
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
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div>
                          <h3 className="font-bold text-slate-200 text-sm">
                            Öncelikli Eylem Gerektiren Bulgular
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Sistemdeki toplam {result.findings.length} bulgu arasından en yüksek risk taşıyanlar.
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab("FINDINGS")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
                        >
                          Tüm Bulguları Aç ({result.findings.length}) →
                        </button>
                      </div>

                      <div className="space-y-3">
                        {result.findings.slice(0, 5).map((f) => (
                          <FindingCard key={f.id} finding={f} lang={lang} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── MODÜL GÖRÜNÜMLERİ (TAB RENDERING) ── */}

                {/* 1. GÜVENLİK HUB MODÜLLERİ */}
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
                  <div className="space-y-4">
                    {selectedRouteUrl && (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                        <span>
                          {lang === "tr" ? "Filtrelenen Rota:" : "Filtered Route:"}{" "}
                          <strong className="text-cyan-400">{selectedRouteUrl}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedRouteUrl(null)}
                          className="text-slate-400 hover:text-slate-200"
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

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                        <span className="text-xs text-slate-400 font-semibold pr-1">Kategori:</span>
                        {(["ALL", "SECURITY", "UX"] as const).map((cat) => (
                          <button
                            key={cat}
                            className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition ${
                              categoryFilter === cat
                                ? "bg-indigo-600 text-white shadow"
                                : "bg-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                            onClick={() => setCategoryFilter(cat)}
                          >
                            {CATEGORY_LABELS[lang][cat]}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto justify-end">
                        <span className="text-xs text-slate-400 font-semibold pr-1">Seviye:</span>
                        {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((sev) => (
                          <button
                            key={sev}
                            className={`px-2 py-1 text-xs rounded-lg font-semibold transition ${
                              severityFilter === sev
                                ? "bg-slate-200 text-slate-950 shadow"
                                : "bg-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                            onClick={() => setSeverityFilter(sev)}
                          >
                            {SEVERITY_LABELS[lang][sev]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                      <span>{t.findingsSection}</span>
                      <span>
                        {t.showing} {filteredFindings.length} / {result.findings.length} {t.issues}
                      </span>
                    </div>

                    {filteredFindings.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 bg-slate-900/60 border border-slate-800 rounded-xl">
                        {t.noIssues}
                      </div>
                    ) : (
                      <div className="space-y-3" id="findings-list">
                        {filteredFindings.map((f) => (
                          <FindingCard key={f.id} finding={f} lang={lang} />
                        ))}
                      </div>
                    )}
                  </div>
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
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="max-w-4xl w-full">
                  <LiveScreencastPanel
                    targetUrl={result.target_url}
                    isActive={false}
                    lang={lang}
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
