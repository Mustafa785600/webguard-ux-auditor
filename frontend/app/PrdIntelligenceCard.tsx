"use client";

import { useState } from "react";
import { analyzePRD } from "@/lib/api";
import type { PRDAnalysisResponse, PRDScenario } from "@/types/scan";

interface PrdIntelligenceCardProps {
  targetUrl: string;
  initialAnalysis?: PRDAnalysisResponse | null;
}

const PRD_TEMPLATES = [
  {
    name: "🛒 E-Commerce Cart & Checkout",
    content: `# E-Commerce Storefront PRD
As a Customer, I want to browse products, add items to cart, and checkout securely.
Acceptance Criteria:
- Must display product catalog with price tags.
- Adding product increases cart item badge count.
- Checkout page collects shipping address and credit card details.
- Validates postal code format and declines expired credit cards.
- Successful order displays confirmation receipt with order ID.`,
  },
  {
    name: "🔐 SaaS User Auth & Onboarding",
    content: `# SaaS Platform Auth PRD
As a Registered User, I want to sign in with email and password to access my analytics workspace.
Acceptance Criteria:
- Login form validates valid email formatting.
- Entering incorrect credentials shows error: "Invalid email or password".
- Successful login issues JWT session and redirects to /dashboard.
- Session expires after 30 minutes of inactivity and prompts re-authentication.`,
  },
  {
    name: "🔍 Search & Dynamic Data Filter",
    content: `# Enterprise Search & Filter PRD
As an Analyst, I want to search through inventory records and filter by date range and status.
Acceptance Criteria:
- Search input supports instant auto-complete suggestions.
- Filtering by "Active" status instantly updates the table without a full page refresh.
- Empty query result displays "No records found" along with reset filter suggestions.`,
  },
];

export default function PrdIntelligenceCard({ targetUrl, initialAnalysis }: PrdIntelligenceCardProps) {
  const [open, setOpen] = useState(true);
  const [prdText, setPrdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PRDAnalysisResponse | null>(initialAnalysis ?? null);
  const [copied, setCopied] = useState(false);
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);

  async function handleGenerate() {
    if (!prdText.trim()) {
      setError("Please enter or select a PRD specification text first.");
      return;
    }
    const target = targetUrl?.trim() || "https://example.com";
    setLoading(true);
    setError(null);
    try {
      const data = await analyzePRD(target, prdText.trim());
      setAnalysis(data);
      setActiveScenarioIdx(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to analyze PRD.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopySpec() {
    if (!analysis?.generated_spec_code) return;
    navigator.clipboard.writeText(analysis.generated_spec_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadSpec() {
    if (!analysis?.generated_spec_code) return;
    const blob = new Blob([analysis.generated_spec_code], { type: "text/typescript" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const hostname = targetUrl ? new URL(targetUrl).hostname.replace(/\./g, "_") : "target";
    a.download = `playwright_prd_${hostname}.spec.ts`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <section className="prd-card">
      <div
        className="prd-header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
      >
        <div className="prd-title-group">
          <span className="prd-badge-icon">🧠</span>
          <div>
            <h2 className="prd-title">TestSprite PRD-Driven AI Test Intelligence</h2>
            <p className="prd-subtitle">
              Synthesize user roles, edge cases, and executable Playwright test suites directly from specifications.
            </p>
          </div>
        </div>

        <span className={`finding-chevron ${open ? "open" : ""}`} aria-hidden>▾</span>
      </div>

      {open && (
        <div className="prd-body">
          {/* Quick PRD Templates */}
          <div className="prd-template-bar">
            <span className="prd-template-label">Sample PRD Templates:</span>
            {PRD_TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                className="prd-template-btn"
                onClick={() => setPrdText(tmpl.content)}
              >
                {tmpl.name}
              </button>
            ))}
          </div>

          {/* PRD Textarea Input */}
          <div className="prd-input-wrap">
            <textarea
              className="prd-textarea"
              placeholder="Paste Product Requirements Document (PRD), feature specs, user stories, or acceptance criteria..."
              rows={5}
              value={prdText}
              onChange={(e) => setPrdText(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div className="prd-error">{error}</div>}

          {/* Action Row */}
          <div className="prd-action-row">
            <button
              type="button"
              className="btn-generate-prd"
              onClick={handleGenerate}
              disabled={loading || !prdText.trim()}
            >
              {loading ? (
                <>
                  <span className="btn-spinner" /> Synthesizing AI Scenarios…
                </>
              ) : (
                <>✨ Generate Playwright E2E Suite</>
              )}
            </button>
            <span className="prd-note">
              Target: <strong>{targetUrl || "https://example.com"}</strong>
            </span>
          </div>

          {/* Analysis Results View */}
          {analysis && (
            <div className="prd-results-container">
              {/* Summary Bar */}
              <div className="prd-summary-bar">
                <div className="prd-summary-text">{analysis.summary}</div>
                <div className="prd-roles-list">
                  <span className="roles-label">Roles:</span>
                  {analysis.user_roles.map((role, idx) => (
                    <span key={idx} className="prd-role-pill">
                      👤 {role}
                    </span>
                  ))}
                </div>
              </div>

              {/* Scenarios & Playwright Code Columns */}
              <div className="prd-columns-grid">
                {/* Left: Scenarios List */}
                <div className="prd-scenarios-panel">
                  <div className="panel-title">
                    Extracted User Flow Scenarios ({analysis.scenarios.length})
                  </div>
                  <div className="scenario-chips">
                    {analysis.scenarios.map((sc, idx) => (
                      <button
                        key={idx}
                        className={`scenario-nav-item ${activeScenarioIdx === idx ? "active" : ""}`}
                        onClick={() => setActiveScenarioIdx(idx)}
                      >
                        <span className="sc-idx">#{idx + 1}</span>
                        <span className="sc-title">{sc.title}</span>
                      </button>
                    ))}
                  </div>

                  {analysis.scenarios[activeScenarioIdx] && (
                    <div className="scenario-detail-card">
                      <div className="sc-card-header">
                        <span className="sc-role-badge">
                          Role: {analysis.scenarios[activeScenarioIdx].role}
                        </span>
                        <h4 className="sc-card-title">
                          {analysis.scenarios[activeScenarioIdx].title}
                        </h4>
                      </div>

                      <div className="sc-steps-section">
                        <span className="sc-section-label">Execution Steps:</span>
                        <ol className="sc-steps-list">
                          {analysis.scenarios[activeScenarioIdx].steps.map((st, i) => (
                            <li key={i}>{st}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="sc-expected-section">
                        <span className="sc-section-label">Expected Result:</span>
                        <p className="sc-expected-text">
                          {analysis.scenarios[activeScenarioIdx].expected_result}
                        </p>
                      </div>

                      {analysis.scenarios[activeScenarioIdx].edge_cases?.length > 0 && (
                        <div className="sc-edge-section">
                          <span className="sc-section-label">Edge Cases Tested:</span>
                          <div className="sc-edge-tags">
                            {analysis.scenarios[activeScenarioIdx].edge_cases.map((ec, i) => (
                              <span key={i} className="edge-tag">
                                ⚠️ {ec}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Playwright Spec Code Viewer */}
                <div className="prd-code-panel">
                  <div className="ide-titlebar">
                    <div className="ide-dots">
                      <span className="ide-dot dot-red" />
                      <span className="ide-dot dot-yellow" />
                      <span className="ide-dot dot-green" />
                    </div>
                    <div className="ide-file-info">
                      <span className="ide-file-icon">📄</span>
                      <span className="ide-file-path">tests/e2e/prd_generated.spec.ts</span>
                    </div>
                    <div className="prd-code-actions">
                      <button
                        type="button"
                        className={`ide-copy-btn ${copied ? "copied" : ""}`}
                        onClick={handleCopySpec}
                        title="Copy Playwright Spec"
                      >
                        {copied ? "✓ Copied" : "📋 Copy"}
                      </button>
                      <button
                        type="button"
                        className="ide-copy-btn download-btn"
                        onClick={handleDownloadSpec}
                        title="Download .spec.ts"
                      >
                        📥 Download
                      </button>
                    </div>
                  </div>

                  <pre className="prd-code-block">
                    <code>{analysis.generated_spec_code}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

