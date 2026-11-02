"use client";

import { useState, useMemo } from "react";
import type { NetworkRequestTrace } from "@/types/scan";

interface NetworkWaterfallCardProps {
  traces: NetworkRequestTrace[];
}

type NetworkFilter = "ALL" | "XHR_FETCH" | "SLOW" | "ERRORS";

export default function NetworkWaterfallCard({ traces }: NetworkWaterfallCardProps) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<NetworkFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const stats = useMemo(() => {
    if (!traces || traces.length === 0) {
      return { total: 0, avg: 0, slow: 0, failed: 0, maxDuration: 1 };
    }
    const total = traces.length;
    const avg = Math.round(traces.reduce((acc, t) => acc + t.duration_ms, 0) / total);
    const slow = traces.filter((t) => t.duration_ms > 2000).length;
    const failed = traces.filter((t) => t.status >= 400).length;
    const maxDuration = Math.max(...traces.map((t) => t.duration_ms), 100);
    return { total, avg, slow, failed, maxDuration };
  }, [traces]);

  const filteredTraces = useMemo(() => {
    return traces.filter((t) => {
      // Filter tab
      if (filter === "XHR_FETCH" && !["fetch", "xhr"].includes(t.resource_type.toLowerCase())) {
        return false;
      }
      if (filter === "SLOW" && t.duration_ms <= 2000) {
        return false;
      }
      if (filter === "ERRORS" && t.status < 400) {
        return false;
      }
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        return (
          t.url.toLowerCase().includes(query) ||
          t.method.toLowerCase().includes(query) ||
          t.status.toString().includes(query) ||
          t.resource_type.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [traces, filter, searchTerm]);

  if (!traces || traces.length === 0) {
    return null;
  }

  function getStatusClass(status: number): string {
    if (status >= 200 && status < 300) return "status-2xx";
    if (status >= 300 && status < 400) return "status-3xx";
    if (status >= 400 && status < 500) return "status-4xx";
    return "status-5xx";
  }

  function getLatencyColor(durationMs: number): string {
    if (durationMs > 2000) return "#ef4444"; // Red
    if (durationMs > 800) return "#f59e0b";  // Orange/Yellow
    return "#10b981"; // Emerald
  }

  return (
    <section className="waterfall-card">
      <div
        className="waterfall-header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
      >
        <div className="waterfall-title-group">
          <span className="waterfall-badge-icon">🌐</span>
          <h2 className="waterfall-title">Network Activity &amp; API Contract Waterfall</h2>
          <span className="waterfall-count-pill">{stats.total} Requests</span>
        </div>

        <div className="waterfall-summary-chips">
          <span className="summary-chip" title="Average Latency">
            ⚡ Avg: <strong>{stats.avg}ms</strong>
          </span>
          {stats.slow > 0 && (
            <span className="summary-chip chip-warning" title="Requests > 2000ms">
              🐢 {stats.slow} Slow
            </span>
          )}
          {stats.failed > 0 && (
            <span className="summary-chip chip-error" title="HTTP Status >= 400">
              ❌ {stats.failed} Failed
            </span>
          )}
          <span className={`finding-chevron ${open ? "open" : ""}`} aria-hidden>▾</span>
        </div>
      </div>

      {open && (
        <div className="waterfall-body">
          {/* Controls: Search and Filter Tabs */}
          <div className="waterfall-controls">
            <div className="waterfall-tabs">
              {(
                [
                  { key: "ALL", label: `All (${stats.total})` },
                  { key: "XHR_FETCH", label: "Fetch / XHR" },
                  { key: "SLOW", label: `Slow >2s (${stats.slow})` },
                  { key: "ERRORS", label: `Errors (${stats.failed})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  className={`waterfall-tab-btn ${filter === tab.key ? "active" : ""}`}
                  onClick={() => setFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="waterfall-search-input"
              placeholder="Search by URL, method, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Traces Table / Timeline List */}
          {filteredTraces.length === 0 ? (
            <div className="waterfall-empty">
              No network requests match the active filter.
            </div>
          ) : (
            <div className="waterfall-list">
              {filteredTraces.map((trace, idx) => {
                const widthPercent = Math.max(
                  Math.min((trace.duration_ms / stats.maxDuration) * 100, 100),
                  2
                );
                const latencyColor = getLatencyColor(trace.duration_ms);

                return (
                  <div key={idx} className="waterfall-row">
                    <div className="waterfall-col-method">
                      <span className={`method-pill method-${trace.method.toLowerCase()}`}>
                        {trace.method}
                      </span>
                    </div>

                    <div className="waterfall-col-status">
                      <span className={`status-pill ${getStatusClass(trace.status)}`}>
                        {trace.status || "ERR"}
                      </span>
                    </div>

                    <div className="waterfall-col-type">
                      <span className="type-pill" title={`Resource type: ${trace.resource_type}`}>
                        {trace.resource_type}
                      </span>
                    </div>

                    <div className="waterfall-col-url" title={trace.url}>
                      <span className="url-text">{trace.url}</span>
                      {trace.cors_allowed && (
                        <span className="cors-pill" title="Cross-Origin Access Allowed">
                          CORS
                        </span>
                      )}
                    </div>

                    <div className="waterfall-col-gantt">
                      <div className="gantt-bar-track">
                        <div
                          className="gantt-bar"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: latencyColor,
                          }}
                        />
                      </div>
                      <span
                        className="duration-text"
                        style={{ color: latencyColor }}
                      >
                        {trace.duration_ms}ms
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

