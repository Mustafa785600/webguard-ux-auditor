"use client";

import { useState, useEffect, useMemo } from "react";
import { startScan } from "@/lib/api";
import type { ScanResult, Severity, Category } from "@/types/scan";
import FindingCard from "./FindingCard";
import ScoreCard from "./ScoreCard";

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4,
};

const STORAGE_KEY = "webguard_recent_scans";

export default function ScanDashboard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | Category>("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | Severity>("ALL");

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
      return matchCat && matchSev;
    });
  }, [result, categoryFilter, severityFilter]);

  return (
    <>
      <header className="hero">
        <div className="hero-badge">🛡️ Security &amp; UX Audit Platform</div>
        <h1>Scan. Detect. Remediate.</h1>
        <p>
          Instantly audit any website for security vulnerabilities, UX
          deficiencies, and accessibility issues.
        </p>
        <form className="scan-form" onSubmit={handleScan} id="scan-form">
          <label htmlFor="url-input" style={{ display: "none" }}>Target URL</label>
          <input
            id="url-input"
            className="scan-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={loading}
            autoComplete="url"
            spellCheck={false}
          />
          <button className="btn-scan" type="submit" disabled={loading || !url.trim()} id="btn-scan">
            {loading ? "Scanning…" : "Scan"}
          </button>
        </form>

        <div className="history-section">
          <div className="history-header">
            <span className="history-title">
              {recentScans.length > 0 ? "Recent Audits" : "Quick Test Targets"}
            </span>
            {recentScans.length > 0 && (
              <button className="history-clear-btn" onClick={clearHistory}>Clear</button>
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
        {loading && (
          <div className="scan-loading" aria-live="polite">
            <div className="spinner" role="status" aria-label="Scanning" />
            <p>Scanning <strong>{url}</strong>…</p>
            <p style={{ fontSize: "13px", marginTop: "6px", color: "var(--text-muted)" }}>
              Running all security and UX checks in parallel
            </p>
          </div>
        )}

        {result && (
          <>
            <div className="results-bar">
              <span className="results-bar-label">Scanned:</span>
              <span className="results-bar-url">{result.target_url}</span>
              <div className="results-actions">
                <button className="btn-action" onClick={handleExportJson} title="Export JSON">
                  📥 Export JSON
                </button>
                <button className="btn-action" onClick={() => window.print()} title="Print / PDF">
                  🖨️ Print / PDF
                </button>
              </div>
            </div>

            <div className="scores-grid">
              <ScoreCard label="Security Score" score={result.security_score} color="#6366f1" />
              <ScoreCard label="UX Score" score={result.ux_score} color="#34d399" />
            </div>

            <div className="filters-bar">
              <div className="filter-group">
                <span className="filter-label">Category:</span>
                {(["ALL", "SECURITY", "UX"] as const).map((cat) => (
                  <button
                    key={cat}
                    className={`filter-pill ${categoryFilter === cat ? "active" : ""}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="filter-group">
                <span className="filter-label">Severity:</span>
                {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((sev) => (
                  <button
                    key={sev}
                    className={`filter-pill ${severityFilter === sev ? "active" : ""}`}
                    onClick={() => setSeverityFilter(sev)}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-header">
              <span className="section-title">Findings</span>
              <span className="findings-count">
                Showing {filteredFindings.length} of {result.findings.length} issue{result.findings.length !== 1 ? "s" : ""}
              </span>
            </div>

            {filteredFindings.length === 0 ? (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>
                No issues match the selected filters.
              </p>
            ) : (
              <div className="findings-list" id="findings-list">
                {filteredFindings.map((f) => (
                  <FindingCard key={f.id} finding={f} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

