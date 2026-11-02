"use client";

import React, { useState } from "react";
import { CrawlNode } from "@/types/scan";
import { Language, UI_STRINGS } from "@/lib/i18n";

interface CrawlGraphViewProps {
  nodes?: CrawlNode[];
  lang: Language;
  selectedRouteUrl?: string | null;
  onSelectRoute: (url: string | null) => void;
}

export default function CrawlGraphView({
  nodes = [],
  lang,
  selectedRouteUrl,
  onSelectRoute,
}: CrawlGraphViewProps) {
  const t = UI_STRINGS[lang];
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!nodes || nodes.length === 0) {
    return (
      <div className="crawl-empty-state">
        <div className="crawl-empty-icon">🕸️</div>
        <h3>{t.tabCrawlGraph}</h3>
        <p>{t.crawlEmptyNotice}</p>
      </div>
    );
  }

  // Summary Metrics
  const totalPages = nodes.length;
  const totalLinksDiscovered = nodes.reduce(
    (acc, n) => acc + (n.links_found?.length || 0),
    0
  );
  const totalInteractive = nodes.reduce(
    (acc, n) => acc + (n.forms_count || 0) + (n.buttons_count || 0),
    0
  );
  const routeFailures = nodes.filter(
    (n) => n.status_code >= 400 || n.status_code === 0
  ).length;

  return (
    <div className="crawl-graph-container">
      {/* KPI Overview Strip */}
      <div className="crawl-kpi-grid">
        <div className="crawl-kpi-card">
          <span className="crawl-kpi-num">{totalPages}</span>
          <span className="crawl-kpi-label">{t.pagesExplored}</span>
        </div>
        <div className="crawl-kpi-card">
          <span className="crawl-kpi-num">{totalLinksDiscovered}</span>
          <span className="crawl-kpi-label">{t.routesDiscovered}</span>
        </div>
        <div className="crawl-kpi-card">
          <span className="crawl-kpi-num">{totalInteractive}</span>
          <span className="crawl-kpi-label">{t.formsButtonsTested}</span>
        </div>
        <div className={`crawl-kpi-card ${routeFailures > 0 ? "kpi-alert" : ""}`}>
          <span className="crawl-kpi-num">{routeFailures}</span>
          <span className="crawl-kpi-label">{t.routeFailures}</span>
        </div>
      </div>

      {/* Route Filter Indicator */}
      {selectedRouteUrl && (
        <div className="active-route-filter-bar">
          <span>
            {lang === "tr" ? "Filtrelenen Rota:" : "Filtered Route:"}{" "}
            <strong>{selectedRouteUrl}</strong>
          </span>
          <button
            className="clear-route-filter-btn"
            onClick={() => onSelectRoute(null)}
          >
            ✕ {t.allRoutes}
          </button>
        </div>
      )}

      {/* Crawled Routes Grid */}
      <div className="crawl-nodes-grid">
        {nodes.map((node, idx) => {
          const isSelected = selectedRouteUrl === node.url;
          const isFailed = node.status_code >= 400 || node.status_code === 0;

          return (
            <div
              key={idx}
              className={`crawl-node-card ${isSelected ? "selected" : ""} ${
                isFailed ? "node-failed" : ""
              }`}
            >
              <div className="crawl-card-header">
                <span
                  className={`status-badge ${
                    node.status_code === 200
                      ? "status-200"
                      : isFailed
                      ? "status-400"
                      : "status-other"
                  }`}
                >
                  {node.status_code ? `HTTP ${node.status_code}` : "FAILED"}
                </span>
                <span className="depth-badge">
                  {lang === "tr" ? `Derinlik: ${node.depth}` : `Depth: ${node.depth}`}
                </span>
                {node.load_time_ms && (
                  <span className="load-time-pill">
                    ⚡ {node.load_time_ms} ms
                  </span>
                )}
              </div>

              <div className="crawl-route-title">
                <code className="route-path-text">{node.route}</code>
              </div>

              {node.title && node.title !== node.route && (
                <div className="page-title-text" title={node.title}>
                  {node.title}
                </div>
              )}

              {/* Thumbnail screenshot preview */}
              {node.screenshot_b64 && (
                <div
                  className="crawl-thumb-wrapper"
                  onClick={() => setPreviewImage(node.screenshot_b64 ?? null)}
                  title={lang === "tr" ? "Büyütmek için tıklayın" : "Click to enlarge"}
                >
                  <img
                    src={`data:image/jpeg;base64,${node.screenshot_b64}`}
                    alt={node.route}
                    className="crawl-thumb-img"
                  />
                  <span className="zoom-hint">🔍</span>
                </div>
              )}

              {/* Exploration Stats */}
              <div className="crawl-card-stats">
                <span className="stat-pill">📝 {node.forms_count} form</span>
                <span className="stat-pill">🔘 {node.buttons_count} button</span>
                <span className="stat-pill">🔗 {node.links_found?.length || 0} links</span>
              </div>

              {/* Outgoing links list sample */}
              {node.links_found && node.links_found.length > 0 && (
                <div className="discovered-links-box">
                  <div className="links-header">
                    {lang === "tr" ? "Keşfedilen Rotalar:" : "Outgoing Routes:"}
                  </div>
                  <div className="links-pill-list">
                    {node.links_found.slice(0, 4).map((link, lIdx) => {
                      try {
                        const path = new URL(link).pathname;
                        return (
                          <span key={lIdx} className="mini-link-pill" title={link}>
                            {path || "/"}
                          </span>
                        );
                      } catch {
                        return (
                          <span key={lIdx} className="mini-link-pill">
                            {link}
                          </span>
                        );
                      }
                    })}
                    {node.links_found.length > 4 && (
                      <span className="mini-link-more">
                        +{node.links_found.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="crawl-card-footer">
                <span
                  className={`issue-count-badge ${
                    node.page_issues_count > 0 ? "has-issues" : "clean"
                  }`}
                >
                  {node.page_issues_count > 0
                    ? `⚠️ ${node.page_issues_count} ${t.issues}`
                    : `✓ 0 ${t.issues}`}
                </span>

                <button
                  className={`filter-route-btn ${isSelected ? "active" : ""}`}
                  onClick={() =>
                    onSelectRoute(isSelected ? null : node.url)
                  }
                >
                  {isSelected ? `✓ ${t.allRoutes}` : t.filterByRoute}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for enlarged screenshot preview */}
      {previewImage && (
        <div
          className="screenshot-modal-backdrop"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="screenshot-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setPreviewImage(null)}
            >
              ✕
            </button>
            <img
              src={`data:image/jpeg;base64,${previewImage}`}
              alt="Enlarged screenshot"
              className="modal-full-img"
            />
          </div>
        </div>
      )}
    </div>
  );
}
