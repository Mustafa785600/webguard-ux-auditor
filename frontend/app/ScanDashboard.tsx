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

export default function ScanDashboard() {
  const [lang, setLang] = useState<Language>("tr");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | Category>("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | Severity>("ALL");
  const [rcaFilter, setRcaFilter] = useState<"ALL" | RCACategory>("ALL");

  // Autonomous Crawler state (enabled by default for multi-page audits)
  const [enableCrawler, setEnableCrawler] = useState<boolean>(true);
  const [maxPages, setMaxPages] = useState<number>(5);
  const [selectedRouteUrl, setSelectedRouteUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"FINDINGS" | "PRD" | "CRAWL_GRAPH" | "AUTO_HEAL" | "PERFORMANCE" | "CODEBASE" | "WAF" | "CHAOS" | "RATELIMIT" | "VIEWPORT" | "APICONTRACT" | "DAST" | "SESSION_REPLAY" | "DATABASE" | "LOCALIZATION" | "MEMORY" | "THIRDPARTY" | "TLS_CRYPTO" | "INCIDENT_HUB">("FINDINGS");
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
      // Ignore localStorage write error
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

  return (
    <>
      <header className="hero">
        {/* Top Bar with Language Switcher */}
        <div className="hero-topbar">
          <div className="hero-badge">{t.heroBadge}</div>
          <div className="lang-switcher">
            <button
              type="button"
              className={`lang-btn ${lang === "tr" ? "active" : ""}`}
              onClick={() => setLang("tr")}
              title="Türkçe arayüz"
            >
              🇹🇷 TR
            </button>
            <button
              type="button"
              className={`lang-btn ${lang === "en" ? "active" : ""}`}
              onClick={() => setLang("en")}
              title="English interface"
            >
              🇬🇧 EN
            </button>
          </div>
        </div>

        <h1>{t.heroTitle}</h1>
        <p>{t.heroSubtitle}</p>

        <form className="scan-form" onSubmit={handleScan} id="scan-form">
          <label htmlFor="url-input" style={{ display: "none" }}>
            Target URL
          </label>
          <input
            id="url-input"
            className="scan-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t.urlPlaceholder}
            disabled={loading}
            autoComplete="url"
            spellCheck={false}
          />
          <button
            className="btn-scan"
            type="submit"
            disabled={loading || !url.trim()}
            id="btn-scan"
          >
            {loading ? t.btnScanning : t.btnScan}
          </button>
        </form>

        {/* Autonomous Crawler Config Option */}
        <div className="crawler-options-bar">
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
                  {count}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sectoral Compliance Protocol Selector */}
        <div className="sector-selector-bar">
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

        <div className="history-section">
          <div className="history-header">
            <span className="history-title">
              {recentScans.length > 0 ? t.recentAudits : t.quickTargets}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition ${
                  showCodebaseStandalone
                    ? "bg-indigo-600 text-white border-indigo-500"
                    : "bg-slate-800/80 text-indigo-300 border-indigo-500/30 hover:bg-slate-800"
                }`}
                onClick={() => setShowCodebaseStandalone(!showCodebaseStandalone)}
              >
                🧠 {lang === "tr" ? "Kod Tabanı & Mimari Zeka" : "Codebase Architecture"}
              </button>
              {recentScans.length > 0 && (
                <button className="history-clear-btn" onClick={clearHistory}>
                  {t.clear}
                </button>
              )}
            </div>
          </div>
          <div className="history-list">
            {(recentScans.length > 0
              ? recentScans
              : ["https://example.com", "https://google.com", "https://github.com"]
            ).map((hUrl) => (
              <button
                key={hUrl}
                className="history-chip"
                onClick={() => {
                  setUrl(hUrl);
                  runScan(hUrl);
                }}
              >
                {hUrl}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="scan-error" role="alert">{error}</div>}
      </header>

      <main className="container">
        {!result && !loading && <PrdIntelligenceCard targetUrl={url} lang={lang} />}

        {showCodebaseStandalone && !result && !loading && (
          <div className="mt-8">
            <CodebaseIntelligenceView />
          </div>
        )}

        {loading && (
          <div className="scan-live-streaming-section">
            <LiveScreencastPanel
              targetUrl={url}
              isActive={true}
              lang={lang}
            />
          </div>
        )}

        {result && (
          <>
            <div className="results-bar">
              <span className="results-bar-label">{t.scanned}</span>
              <span className="results-bar-url">{result.target_url}</span>
              <div className="results-actions">
                <button
                  type="button"
                  className="btn-action btn-checklist"
                  onClick={() => setShowGeneralControl(true)}
                  title={lang === "tr" ? "GeneralControl Denetim Listesi" : "GeneralControl Checklist"}
                >
                  🛡️ {lang === "tr" ? "GeneralControl Listesi" : "GeneralControl Checklist"}
                </button>
                <button
                  type="button"
                  className="btn-action btn-report-trigger"
                  onClick={() => setShowAuditReport(true)}
                  title={lang === "tr" ? "Resmi Yönetici Denetim Raporu" : "Executive Audit Report"}
                >
                  📄 {lang === "tr" ? "Resmi PDF Raporu" : "Executive PDF Report"}
                </button>
                <button
                  type="button"
                  className="btn-action btn-deck-trigger"
                  onClick={() => setShowExecutiveDeck(true)}
                  title={lang === "tr" ? "Virgosol Tarzı C-Level Yönetici Sunumu (16:9 Deck)" : "Executive Presentation Deck"}
                >
                  📽️ {lang === "tr" ? "Yönetici Sunumu (Deck)" : "Executive Deck"}
                </button>
                <button
                  type="button"
                  className="btn-action btn-checklist"
                  onClick={() => setShowLiveScreencast(true)}
                  title={lang === "tr" ? "TestSprite Tarzı Canlı Tarayıcı Ekranı & HUD Kaydı" : "Live Browser Stream & Action HUD"}
                >
                  📺 {lang === "tr" ? "Canlı Kayıt & HUD" : "Live HUD Replay"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "CODEBASE" ? "active" : ""}`}
                  onClick={() => setActiveTab("CODEBASE")}
                  title={lang === "tr" ? "Bütünsel Kod Tabanı ve Mimari Zeka Raporu" : "Codebase Intelligence Report"}
                >
                  🧠 {lang === "tr" ? "Kod Zeka" : "Codebase"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "WAF" ? "active" : ""}`}
                  onClick={() => setActiveTab("WAF")}
                  title={lang === "tr" ? "WAF ve Hata Sızıntısı Direnç Raporu" : "WAF & Error Leakage Resilience"}
                >
                  🛡️ {lang === "tr" ? "WAF Direnci" : "WAF"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "CHAOS" ? "active" : ""}`}
                  onClick={() => setActiveTab("CHAOS")}
                  title={lang === "tr" ? "Kaos Mühendisliği ve Ağ Hata Enjeksiyonu" : "Chaos Engineering & Fault Injection"}
                >
                  💥 {lang === "tr" ? "Kaos Testi" : "Chaos"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "RATELIMIT" ? "active" : ""}`}
                  onClick={() => setActiveTab("RATELIMIT")}
                  title={lang === "tr" ? "Hız Sınırı ve Kaba Kuvvet Direnç Raporu" : "Rate-Limiting & Brute-Force Resilience"}
                >
                  ⏱️ {lang === "tr" ? "Hız Sınırı" : "Rate-Limit"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "VIEWPORT" ? "active" : ""}`}
                  onClick={() => setActiveTab("VIEWPORT")}
                  title={lang === "tr" ? "Çoklu Cihaz ve Duyarlı Tasarım Raporu" : "Multi-Viewport & Responsive Layout"}
                >
                  📱 {lang === "tr" ? "Çoklu Cihaz" : "Viewport"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "APICONTRACT" ? "active" : ""}`}
                  onClick={() => setActiveTab("APICONTRACT")}
                  title={lang === "tr" ? "API Sözleşme ve Şema Sapması Raporu" : "API Contract & Schema Drift"}
                >
                  📋 {lang === "tr" ? "API Sözleşme" : "API Contract"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "DAST" ? "active" : ""}`}
                  onClick={() => setActiveTab("DAST")}
                  title={lang === "tr" ? "Güvenlik Açığı Otomatik Doğrulaması (DAST)" : "DAST Exploit Verification"}
                >
                  🎯 {lang === "tr" ? "DAST Doğrulama" : "DAST Verify"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "SESSION_REPLAY" ? "active" : ""}`}
                  onClick={() => setActiveTab("SESSION_REPLAY")}
                  title={lang === "tr" ? "Kullanıcı Oturum Kaydı & Isı Haritası" : "Session Replay & Heatmap"}
                >
                  🎬 {lang === "tr" ? "Isı Haritası" : "Heatmap"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "DATABASE" ? "active" : ""}`}
                  onClick={() => setActiveTab("DATABASE")}
                  title={lang === "tr" ? "Veritabanı ve Yavaş Sorgu Sızıntı Denetimi" : "Database & Slow Query Prober"}
                >
                  🗄️ {lang === "tr" ? "Veritabanı" : "Database"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "LOCALIZATION" ? "active" : ""}`}
                  onClick={() => setActiveTab("LOCALIZATION")}
                  title={lang === "tr" ? "Çok Dilli (i18n) ve Lokalizasyon Denetimi" : "Localization & i18n Quality"}
                >
                  🌐 {lang === "tr" ? "Çok Dilli / i18n" : "i18n / L10n"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "MEMORY" ? "active" : ""}`}
                  onClick={() => setActiveTab("MEMORY")}
                  title={lang === "tr" ? "SPA Bellek ve DOM Sızıntı Radarı" : "SPA Memory & DOM Leak Profiler"}
                >
                  🧠 {lang === "tr" ? "Bellek Radarı" : "Memory Leaks"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "THIRDPARTY" ? "active" : ""}`}
                  onClick={() => setActiveTab("THIRDPARTY")}
                  title={lang === "tr" ? "Üçüncü Taraf Script ve CSP Sandbox Denetimi" : "Third-Party Trackers & CSP Sandbox"}
                >
                  🛡️ {lang === "tr" ? "3. Taraf & CSP" : "3rd-Party & CSP"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "TLS_CRYPTO" ? "active" : ""}`}
                  onClick={() => setActiveTab("TLS_CRYPTO")}
                  title={lang === "tr" ? "SSL/TLS Sertifika Zinciri ve Modern Kriptografi" : "SSL/TLS & Cryptography Auditor"}
                >
                  🔐 {lang === "tr" ? "SSL/TLS & Kripto" : "TLS & Crypto"}
                </button>
                <button
                  type="button"
                  className={`btn-action ${activeTab === "INCIDENT_HUB" ? "active" : ""}`}
                  onClick={() => setActiveTab("INCIDENT_HUB")}
                  title={lang === "tr" ? "Otonom Olay Köprüsü ve Webhook Entegrasyon Merkezi" : "Automated Incident & Webhook Integration Hub"}
                >
                  📢 {lang === "tr" ? "Olay Köprüsü" : "Incident Hub"} {result.incident_hub_report && result.incident_hub_report.critical_count > 0 ? `(${result.incident_hub_report.critical_count} Kritik)` : ""}
                </button>
                <button className="btn-action" onClick={handleExportJson} title="Export JSON">
                  {t.exportJson}
                </button>
                <button className="btn-action" onClick={() => setShowAuditReport(true)} title="Print / PDF">
                  {t.printPdf}
                </button>
              </div>
            </div>

            {result.detected_sector && (
              <div className="sector-status-banner">
                <span className="sector-banner-label">
                  🏛️ {lang === "tr" ? "Uygulanan Sektörel Standart:" : "Active Industry Standard:"}
                </span>
                <span className="sector-banner-tag">
                  {SECTOR_LABELS[lang][result.detected_sector]?.icon}{" "}
                  <strong>{SECTOR_LABELS[lang][result.detected_sector]?.name}</strong> —{" "}
                  {SECTOR_LABELS[lang][result.detected_sector]?.standard}
                </span>
                {result.selected_sector === "AUTO" && (
                  <span className="sector-auto-badge">
                    ✨ {lang === "tr" ? "Yapay Zeka Tarafından Otomatik Belirlendi" : "Auto-Detected by AI"}
                  </span>
                )}
              </div>
            )}

            <div className="scores-grid">
              <ScoreCard label={t.securityScore} score={result.security_score} color="#6366f1" />
              <ScoreCard label={t.uxScore} score={result.ux_score} color="#34d399" />
              {result.compliance_score !== undefined && (
                <ScoreCard
                  label={lang === "tr" ? "Uyumluluk & Mevzuat Skoru" : "Compliance & Standards"}
                  score={result.compliance_score}
                  color="#f59e0b"
                />
              )}
              {result.bddk_compliance_score !== undefined && (
                <ScoreCard
                  label={lang === "tr" ? "BDDK & Finans Mevzuat Skoru" : "BDDK Banking Compliance"}
                  score={result.bddk_compliance_score}
                  color="#0ea5e9"
                />
              )}
            </div>

            {result.network_traces && result.network_traces.length > 0 && (
              <NetworkWaterfallCard traces={result.network_traces} />
            )}

            {/* View Switcher Tabs: Findings | PRD | Site Route Graph */}
            <div className="view-tabs-bar">
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "FINDINGS" ? "active" : ""}`}
                onClick={() => setActiveTab("FINDINGS")}
              >
                📋 {t.tabFindings} ({filteredFindings.length})
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "PRD" ? "active" : ""}`}
                onClick={() => setActiveTab("PRD")}
              >
                🧠 {t.tabPrd}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "CRAWL_GRAPH" ? "active" : ""}`}
                onClick={() => setActiveTab("CRAWL_GRAPH")}
              >
                🗺️ {t.tabCrawlGraph} ({result.crawl_graph?.length ?? result.crawled_pages_count ?? 1})
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "AUTO_HEAL" ? "active" : ""}`}
                onClick={() => setActiveTab("AUTO_HEAL")}
              >
                🧪 {t.tabAutoHeal || "Auto-Heal"} ({result.self_healing_events?.length ?? 0})
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "PERFORMANCE" ? "active" : ""}`}
                onClick={() => setActiveTab("PERFORMANCE")}
              >
                ⚡ {t.tabPerformance || "Yük & Performans (SLA)"} {result.performance_metrics ? `(${result.performance_metrics.p95_latency_ms}ms)` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "CODEBASE" ? "active" : ""}`}
                onClick={() => setActiveTab("CODEBASE")}
              >
                🧠 {lang === "tr" ? "Kod Zeka & Mimari" : "Codebase Architecture"} {result.codebase_intelligence ? `(${result.codebase_intelligence.total_symbols})` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "WAF" ? "active" : ""}`}
                onClick={() => setActiveTab("WAF")}
              >
                🛡️ {lang === "tr" ? "WAF & Hata Direnci" : "WAF Resilience"} {result.waf_resilience ? `(${result.waf_resilience.waf_protection_score}%)` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "CHAOS" ? "active" : ""}`}
                onClick={() => setActiveTab("CHAOS")}
              >
                💥 {lang === "tr" ? "Kaos & Hata Enjeksiyonu" : "Chaos Engineering"} {result.chaos_resilience ? `(${result.chaos_resilience.chaos_resilience_score}%)` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "RATELIMIT" ? "active" : ""}`}
                onClick={() => setActiveTab("RATELIMIT")}
              >
                ⏱️ {lang === "tr" ? "Hız Sınırı & Kaba Kuvvet" : "Rate-Limiting"} {result.rate_limit_resilience ? `(${result.rate_limit_resilience.resilience_score}%)` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "VIEWPORT" ? "active" : ""}`}
                onClick={() => setActiveTab("VIEWPORT")}
              >
                📱 {lang === "tr" ? "Çoklu Cihaz & Responsive" : "Multi-Viewport"} {result.multi_viewport_report ? `(${result.multi_viewport_report.overall_responsive_score}%)` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "APICONTRACT" ? "active" : ""}`}
                onClick={() => setActiveTab("APICONTRACT")}
              >
                📋 {lang === "tr" ? "API Sözleşme & Şema" : "API Contract"} {result.api_contract_drift ? `(${result.api_contract_drift.contract_compatibility_score}%)` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "DAST" ? "active" : ""}`}
                onClick={() => setActiveTab("DAST")}
              >
                🎯 {lang === "tr" ? "DAST Doğrulama" : "DAST Verify"} {result.dast_verification ? `(${result.dast_verification.confirmed_vulnerabilities_count > 0 ? `${result.dast_verification.confirmed_vulnerabilities_count} Açık` : "Temiz"})` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "SESSION_REPLAY" ? "active" : ""}`}
                onClick={() => setActiveTab("SESSION_REPLAY")}
              >
                🎬 {lang === "tr" ? "Oturum Kaydı & Isı Haritası" : "Session Replay & Heatmap"} {result.session_replay ? `(${result.session_replay.rage_clicks_count} Rage)` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "DATABASE" ? "active" : ""}`}
                onClick={() => setActiveTab("DATABASE")}
              >
                🗄️ {lang === "tr" ? "Veritabanı & Yavaş Sorgu" : "DB & Slow Query"} {result.database_leak_report ? `(${result.database_leak_report.total_leaks_count > 0 ? `${result.database_leak_report.total_leaks_count} Sızıntı` : `${result.database_leak_report.db_health_score}%`})` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "LOCALIZATION" ? "active" : ""}`}
                onClick={() => setActiveTab("LOCALIZATION")}
              >
                🌐 {lang === "tr" ? "Çok Dilli / i18n" : "i18n / L10n"} {result.localization_audit ? `(${result.localization_audit.total_defects_count > 0 ? `${result.localization_audit.total_defects_count} Kusur` : `${result.localization_audit.l10n_score}%`})` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "MEMORY" ? "active" : ""}`}
                onClick={() => setActiveTab("MEMORY")}
              >
                🧠 {lang === "tr" ? "Bellek & DOM Sızıntısı" : "Memory & DOM Leak"} {result.memory_leak_report ? `(${result.memory_leak_report.total_leaks_count > 0 ? `${result.memory_leak_report.total_leaks_count} Sızıntı` : `${result.memory_leak_report.memory_health_score}%`})` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "THIRDPARTY" ? "active" : ""}`}
                onClick={() => setActiveTab("THIRDPARTY")}
              >
                🛡️ {lang === "tr" ? "3. Taraf Script & CSP" : "3rd-Party & CSP"} {result.third_party_security_report ? `(${result.third_party_security_report.csp_grade} / ${result.third_party_security_report.security_score}%)` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "TLS_CRYPTO" ? "active" : ""}`}
                onClick={() => setActiveTab("TLS_CRYPTO")}
              >
                🔐 {lang === "tr" ? "SSL/TLS & Kripto" : "TLS & Crypto"} {result.tls_crypto_report ? `(${result.tls_crypto_report.ssl_labs_grade} / ${result.tls_crypto_report.crypto_score}%)` : ""}
              </button>
              <button
                type="button"
                className={`view-tab-btn ${activeTab === "INCIDENT_HUB" ? "active" : ""}`}
                onClick={() => setActiveTab("INCIDENT_HUB")}
              >
                📢 {lang === "tr" ? "Olay Köprüsü & Webhook" : "Incident Hub & Webhook"} {result.incident_hub_report ? `(${result.incident_hub_report.total_incidents_generated} Olay)` : ""}
              </button>
            </div>

            {/* TAB: Otonom Olay Köprüsü ve Webhook Entegrasyon Merkezi */}
            {activeTab === "INCIDENT_HUB" && result.incident_hub_report && (
              <IncidentHubView report={result.incident_hub_report} />
            )}

            {/* TAB: SSL/TLS Sertifika Zinciri ve Modern Kriptografi Sağlığı */}
            {activeTab === "TLS_CRYPTO" && (
              <TLSCryptoView report={result.tls_crypto_report} lang={lang} />
            )}

            {/* TAB: Üçüncü Taraf Script, İzleyici ve CSP Sandbox Denetimi */}
            {activeTab === "THIRDPARTY" && (
              <ThirdPartySecurityView report={result.third_party_security_report} lang={lang} />
            )}

            {/* TAB: SPA Bellek ve DOM Sızıntı Radarı */}
            {activeTab === "MEMORY" && (
              <MemoryLeakView report={result.memory_leak_report} lang={lang} />
            )}

            {/* TAB: Virgosol Çok Dilli (i18n) ve Lokalizasyon Kusurları */}
            {activeTab === "LOCALIZATION" && (
              <LocalizationAuditView report={result.localization_audit} lang={lang} />
            )}

            {/* TAB: Virgosol Veritabanı ve Yavaş Sorgu Sızıntı Denetimi */}
            {activeTab === "DATABASE" && (
              <DatabaseSlowQueryView report={result.database_leak_report} lang={lang} />
            )}

            {/* TAB: Virgosol & Hotjar Tarzı Kullanıcı Oturum Kaydı & Isı Haritası */}
            {activeTab === "SESSION_REPLAY" && (
              <SessionReplayHeatmapView report={result.session_replay} lang={lang} />
            )}

            {/* TAB: Virgosol DAST Güvenlik Açığı Otomatik Doğrulama */}
            {activeTab === "DAST" && (
              <DASTVerificationView report={result.dast_verification} lang={lang} />
            )}

            {/* TAB: Virgosol API Sözleşme ve Şema Sapması */}
            {activeTab === "APICONTRACT" && (
              <APIContractDriftView report={result.api_contract_drift} lang={lang} />
            )}

            {/* TAB: Virgosol Çoklu Cihaz ve Duyarlı Tasarım */}
            {activeTab === "VIEWPORT" && (
              <MultiViewportView report={result.multi_viewport_report} lang={lang} />
            )}

            {/* TAB: Virgosol Hız Sınırı ve Kaba Kuvvet Direnci */}
            {activeTab === "RATELIMIT" && (
              <RateLimitResilienceView report={result.rate_limit_resilience} lang={lang} />
            )}

            {/* TAB: Virgosol & Netflix Kaos Mühendisliği */}
            {activeTab === "CHAOS" && (
              <ChaosEngineeringView report={result.chaos_resilience} lang={lang} />
            )}

            {/* TAB: Virgosol WAF ve Hata Sızıntısı Direnci */}
            {activeTab === "WAF" && (
              <WAFResilienceView report={result.waf_resilience} lang={lang} />
            )}

            {/* TAB: Bütünsel Kod Tabanı ve Mimari Zeka */}
            {activeTab === "CODEBASE" && (
              <CodebaseIntelligenceView initialReport={result.codebase_intelligence} />
            )}

            {/* TAB 1: TestSprite PRD Intelligence */}
            {activeTab === "PRD" && (
              <PrdIntelligenceCard
                targetUrl={result.target_url}
                initialAnalysis={result.prd_analysis}
                lang={lang}
              />
            )}

            {/* TAB 2: Autonomous Crawler & Route Graph */}
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

            {/* TAB 3: TestSprite Autonomous Auto-Heal & Flaky Tests */}
            {activeTab === "AUTO_HEAL" && (
              <AutoHealView
                targetUrl={result.target_url}
                selfHealingEvents={result.self_healing_events}
                resilienceScore={result.resilience_score}
                lang={lang}
              />
            )}

            {/* TAB 4: Virgosol Enterprise Load & Performance Benchmark */}
            {activeTab === "PERFORMANCE" && (
              <PerformanceView
                metrics={result.performance_metrics}
                findings={result.findings}
                lang={lang}
              />
            )}

            {/* TAB 5: Main Findings List */}
            {activeTab === "FINDINGS" && (
              <>
                {selectedRouteUrl && (
                  <div className="active-route-filter-bar">
                    <span>
                      {lang === "tr" ? "Filtrelenen Rota:" : "Filtered Route:"}{" "}
                      <strong>{selectedRouteUrl}</strong>
                    </span>
                    <button
                      type="button"
                      className="clear-route-filter-btn"
                      onClick={() => setSelectedRouteUrl(null)}
                    >
                      ✕ {t.allRoutes}
                    </button>
                  </div>
                )}

                {/* TestSprite 4-Tier RCA Breakdown & Virgosol Team Triage Bar */}
                <RcaTriageBar
                  findings={result.findings}
                  selectedRca={rcaFilter}
                  onSelectRca={(rca) => setRcaFilter(rca)}
                  lang={lang}
                />

                <div className="filters-bar">
                  <div className="filter-group">
                    <span className="filter-label">{t.filterCategory}</span>
                    {(["ALL", "SECURITY", "UX"] as const).map((cat) => (
                      <button
                        key={cat}
                        className={`filter-pill ${categoryFilter === cat ? "active" : ""}`}
                        onClick={() => setCategoryFilter(cat)}
                      >
                        {CATEGORY_LABELS[lang][cat]}
                      </button>
                    ))}
                  </div>

                  <div className="filter-group">
                    <span className="filter-label">{t.filterSeverity}</span>
                    {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((sev) => (
                      <button
                        key={sev}
                        className={`filter-pill ${severityFilter === sev ? "active" : ""}`}
                        onClick={() => setSeverityFilter(sev)}
                      >
                        {SEVERITY_LABELS[lang][sev]}
                      </button>
                    ))}
                  </div>

                  <div className="filter-group">
                    <span className="filter-label">{t.filterRca}</span>
                    {(["ALL", "REAL_BUG", "TEST_FRAGILITY", "ENV_ISSUE", "EXPECTED_BEHAVIOR"] as const).map(
                      (rca) => (
                        <button
                          key={rca}
                          className={`filter-pill ${rcaFilter === rca ? "active" : ""}`}
                          onClick={() => setRcaFilter(rca)}
                        >
                          {RCA_LABELS[lang][rca]}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="section-header">
                  <span className="section-title">{t.findingsSection}</span>
                  <span className="findings-count">
                    {t.showing} {filteredFindings.length} {t.of} {result.findings.length} {t.issues}
                  </span>
                </div>

                {filteredFindings.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>
                    {t.noIssues}
                  </p>
                ) : (
                  <div className="findings-list" id="findings-list">
                    {filteredFindings.map((f) => (
                      <FindingCard key={f.id} finding={f} lang={lang} />
                    ))}
                  </div>
                )}
              </>
            )}

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
              <div className="live-screencast-container expanded">
                <LiveScreencastPanel
                  targetUrl={result.target_url}
                  isActive={false}
                  lang={lang}
                  onClose={() => setShowLiveScreencast(false)}
                />
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
