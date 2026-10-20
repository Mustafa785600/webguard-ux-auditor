"use client";

import { useState } from "react";
import type { Finding } from "@/types/scan";

function CodeBlockWithLines({
  code,
  startLine = 1,
  variant,
}: {
  code: string;
  startLine?: number;
  variant: "error" | "fix";
}) {
  const lines = code.trim().split("\n");

  return (
    <div className={`ide-code-container ${variant}`}>
      {lines.map((lineText, idx) => {
        const lineNum = startLine ? startLine + idx : idx + 1;
        return (
          <div key={idx} className={`ide-code-row ${variant}`}>
            <span className="ide-line-number">{lineNum}</span>
            <span className="ide-line-symbol">{variant === "error" ? "−" : "+"}</span>
            <span className="ide-line-content">{lineText || " "}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopyCode(e: React.MouseEvent) {
    e.stopPropagation();
    if (!finding.code_example) return;
    navigator.clipboard.writeText(finding.code_example);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasLocationOrCode = Boolean(
    finding.target_location || finding.line_number || finding.problematic_code || finding.code_example
  );

  return (
    <article className="finding-card">
      <div
        className="finding-header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
      >
        <span className={`finding-category-dot ${finding.category}`} aria-label={finding.category} />
        <span className={`severity-badge ${finding.severity}`}>{finding.severity}</span>
        
        <div className="finding-title-group">
          <span className="finding-title">{finding.title}</span>
          {finding.target_location && (
            <span
              className="finding-location-pill"
              title={`Target File: ${finding.target_location}${finding.line_number ? ` (Line ${finding.line_number})` : ""}`}
            >
              <span className="pill-icon">📄</span>
              <span className="pill-path">{finding.target_location}</span>
              {finding.line_number ? (
                <span className="pill-line">:{finding.line_number}</span>
              ) : null}
            </span>
          )}
        </div>

        <span className={`finding-chevron ${open ? "open" : ""}`} aria-hidden>▾</span>
      </div>

      {open && (
        <div className="finding-body">
          <p className="finding-desc">{finding.description}</p>

          {/* 1. Risk & Impact Analysis */}
          {finding.risk_impact && (
            <div className="risk-impact-block">
              <div className="risk-impact-header">
                <span className="risk-icon">⚠️</span>
                <span className="risk-label">RISK &amp; IMPACT ANALYSIS</span>
              </div>
              <p className="risk-text">{finding.risk_impact}</p>
            </div>
          )}

          {/* 2. Mini IDE Code Inspector (Source + Line + Before / After Code) */}
          {hasLocationOrCode && (
            <div className="ide-window">
              {/* IDE Window Titlebar */}
              <div className="ide-titlebar">
                <div className="ide-dots">
                  <span className="ide-dot dot-red" />
                  <span className="ide-dot dot-yellow" />
                  <span className="ide-dot dot-green" />
                </div>
                <div className="ide-file-info">
                  <span className="ide-file-icon">📄</span>
                  <span className="ide-file-path">
                    {finding.target_location || "index.html"}
                  </span>
                  {finding.line_number ? (
                    <span className="ide-line-badge highlight">
                      📍 Line: {finding.line_number}
                    </span>
                  ) : (
                    <span className="ide-line-badge">
                      Config File
                    </span>
                  )}
                </div>
                {finding.code_example && (
                  <button
                    type="button"
                    className={`ide-copy-btn ${copied ? "copied" : ""}`}
                    onClick={handleCopyCode}
                    title="Copy solution code"
                  >
                    {copied ? "✓ Copied" : "📋 Copy Code"}
                  </button>
                )}
              </div>

              {/* Deficient Code (Current / Before) */}
              {finding.problematic_code && (
                <div className="ide-section ide-section-problem">
                  <div className="ide-section-header problem-header">
                    <span className="ide-tag-badge error-badge">❌ CURRENT DEFICIENT CODE</span>
                    {finding.line_number && (
                      <span className="ide-target-line">Target Line: ~{finding.line_number}</span>
                    )}
                  </div>
                  <CodeBlockWithLines
                    code={finding.problematic_code}
                    startLine={finding.line_number ?? 1}
                    variant="error"
                  />
                </div>
              )}

              {/* Solution Code (Recommended Fix / After) */}
              {finding.code_example && (
                <div className="ide-section ide-section-fix">
                  <div className="ide-section-header fix-header">
                    <span className="ide-tag-badge fix-badge">✅ RECOMMENDED FIX (SOLUTION)</span>
                  </div>
                  <CodeBlockWithLines
                    code={finding.code_example}
                    startLine={finding.line_number ?? 1}
                    variant="fix"
                  />
                </div>
              )}
            </div>
          )}

          {/* 3. Remediation Guidance */}
          <div className="remediation-block">
            <div className="remediation-label">REMEDIATION GUIDANCE</div>
            <p className="remediation-text">{finding.remediation}</p>
          </div>

          {/* 4. Technical Evidence Log */}
          {finding.evidence && (
            <details className="evidence-details">
              <summary style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>
                Technical Evidence (Raw Log)
              </summary>
              <pre style={{
                marginTop: "8px",
                fontSize: "11.5px",
                color: "var(--text-secondary)",
                fontFamily: "'JetBrains Mono', monospace",
                background: "var(--bg-elevated)",
                borderRadius: "6px",
                padding: "10px 12px",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}>
                {JSON.stringify(finding.evidence, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
