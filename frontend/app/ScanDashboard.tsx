"use client";

import { useState, useEffect, useMemo } from "react";
import { startScan } from "@/lib/api";
import type { ScanResult, Severity, Category, RCACategory } from "@/types/scan";
import FindingCard from "./FindingCard";
import ScoreCard from "./ScoreCard";
import NetworkWaterfallCard from "./NetworkWaterfallCard";
import PrdIntelligenceCard from "./PrdIntelligenceCard";
import {
  type Language,
  UI_STRINGS,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  RCA_LABELS,
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

    try {
      const data = await startScan(targetUrl.trim());
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
      return matchCat && matchSev && matchRca;
    });
  }, [result, categoryFilter, severityFilter, rcaFilter]);

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

        <div className="history-section">
          <div className="history-header">
            <span className="history-title">
              {recentScans.length > 0 ? t.recentAudits : t.quickTargets}
            </span>
            {recentScans.length > 0 && (
              <button className="history-clear-btn" onClick={clearHistory}>
                {t.clear}
              </button>
            )}
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
        {!result && !loading && <PrdIntelligenceCard targetUrl={url} />}

        {loading && (
          <div className="scan-loading" aria-live="polite">
            <div className="spinner" role="status" aria-label="Scanning" />
            <p>
              {lang === "tr" ? "Denetleniyor: " : "Scanning "}
              <strong>{url}</strong>…
            </p>
            <p style={{ fontSize: "13px", marginTop: "6px", color: "var(--text-muted)" }}>
              {t.scanningMsg}
            </p>
          </div>
        )}

        {result && (
          <>
            <div className="results-bar">
              <span className="results-bar-label">{t.scanned}</span>
              <span className="results-bar-url">{result.target_url}</span>
              <div className="results-actions">
                <button className="btn-action" onClick={handleExportJson} title="Export JSON">
                  {t.exportJson}
                </button>
                <button className="btn-action" onClick={() => window.print()} title="Print / PDF">
                  {t.printPdf}
                </button>
              </div>
            </div>

            <div className="scores-grid">
              <ScoreCard label={t.securityScore} score={result.security_score} color="#6366f1" />
              <ScoreCard label={t.uxScore} score={result.ux_score} color="#34d399" />
            </div>

            {result.network_traces && result.network_traces.length > 0 && (
              <NetworkWaterfallCard traces={result.network_traces} />
            )}

            <PrdIntelligenceCard
              targetUrl={result.target_url}
              initialAnalysis={result.prd_analysis}
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
      </main>
    </>
  );
}
