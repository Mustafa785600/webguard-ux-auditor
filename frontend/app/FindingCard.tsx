"use client";

import { useState } from "react";
import type { Finding } from "@/types/scan";
import { type Language, UI_STRINGS, localizeFinding } from "@/lib/i18n";
import DiagnosticBundleModal from "./DiagnosticBundleModal";

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

const RCA_META: Record<string, { labelEn: string; labelTr: string; color: string; icon: string }> = {
  REAL_BUG:          { labelEn: "Real Bug",          labelTr: "Gerçek Hata",         color: "#ef4444", icon: "🔴" },
  TEST_FRAGILITY:    { labelEn: "Test Fragility",     labelTr: "Test Kırılganlığı",    color: "#f59e0b", icon: "🟡" },
  ENV_ISSUE:         { labelEn: "Environment Issue",  labelTr: "Ortam / Sunucu",      color: "#3b82f6", icon: "🔵" },
  EXPECTED_BEHAVIOR: { labelEn: "Expected Behavior",  labelTr: "Beklenen Davranış",   color: "#6b7280", icon: "⚪" },
};

export default function FindingCard({
  finding: rawFinding,
  lang = "en",
}: {
  finding: Finding;
  lang?: Language;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedIde, setCopiedIde] = useState(false);
  const [copiedJira, setCopiedJira] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [screenshotTab, setScreenshotTab] = useState<"before" | "after">("before");
  const [screenshotMode, setScreenshotMode] = useState<"tabs" | "split">("split");

  const finding = localizeFinding(rawFinding, lang);
  const t = UI_STRINGS[lang] || UI_STRINGS.en;

  const rcaMeta = finding.rca_category ? RCA_META[finding.rca_category] : null;
  const rcaLabel = rcaMeta ? (lang === "tr" ? rcaMeta.labelTr : rcaMeta.labelEn) : "";

  const hasScreenshots = Boolean(finding.screenshot_before_b64 || finding.screenshot_after_b64);

  function handleCopyCode(e: React.MouseEvent) {
    e.stopPropagation();
    if (!finding.code_example) return;
    navigator.clipboard.writeText(finding.code_example);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyIdeBundle(e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const reproductionSteps = finding.reproduction_steps && finding.reproduction_steps.length > 0
      ? finding.reproduction_steps
      : [
          `1. Navigate to target URL: ${finding.page_url || "Target Application"}`,
          `2. Inspect component / endpoint: ${finding.target_location || "DOM Document"}`,
          `3. Execute security & UX assertion for rule [${finding.id}]`,
          `4. Anomaly detected: ${finding.title}`,
        ];

    const ideBundle = {
      diagnostic_bundle_version: "1.0",
      generator: "WebGuard & UX Auditor (TestSprite AI Engine)",
      issue: {
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        rca_category: finding.rca_category || "REAL_BUG",
        target_location: finding.target_location || "Unknown",
        line_number: finding.line_number ?? null,
        page_url: finding.page_url || null,
      },
      failure_analysis: {
        root_cause_hypothesis: finding.root_cause_hypothesis || finding.remediation,
        reproduction_trace: reproductionSteps,
        dom_snapshot: finding.dom_snapshot || finding.problematic_code || null,
        deficient_code: finding.problematic_code || null,
        recommended_fix: finding.code_example || finding.remediation,
      },
      instructions_for_ai: (
        `Please resolve the issue '${finding.title}' identified at ${finding.target_location || "the target page"}. ` +
        `Root cause hypothesis: ${finding.root_cause_hypothesis || finding.remediation}. ` +
        `Apply the recommended fix to eliminate this defect and prevent regressions.`
      ),
    };

    navigator.clipboard.writeText(JSON.stringify(ideBundle, null, 2));
    setCopiedIde(true);
    setTimeout(() => setCopiedIde(false), 3000);
  }

  function handleCopyJiraIssue(e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const team = finding.team_assignment || (
      finding.rca_category === "ENV_ISSUE" ? "DevOps & Sistem Yöneticisi" :
      finding.rca_category === "TEST_FRAGILITY" ? "QA & Test Mühendisliği" :
      "Yazılım Geliştirici (Dev Team)"
    );

    const steps = finding.reproduction_steps && finding.reproduction_steps.length > 0
      ? finding.reproduction_steps.map((s) => `# ${s.replace(/^\d+\.\s*/, "")}`).join("\n")
      : `# Target URL: ${finding.page_url || "Target Application"}\n# Inspect: ${finding.target_location || "Target Location"}\n# Observe anomaly: ${finding.title}`;

    const jiraMarkdown = [
      `h2. [WebGuard Audit] ${finding.title}`,
      `*Issue ID:* \`${finding.id}\``,
      `*Severity:* ${finding.severity}`,
      `*RCA Classification:* ${finding.rca_category || "REAL_BUG"} (${rcaLabel})`,
      `*Assigned Team:* ${team}`,
      `*Target Location:* ${finding.target_location || "Application"}${finding.line_number ? ` (Line ${finding.line_number})` : ""}`,
      ...(finding.page_url ? [`*Page Route:* ${finding.page_url}`] : []),
      "",
      "h3. Problem Açıklaması & Etki Analizi",
      finding.description,
      ...(finding.risk_impact ? [`\n*Risk:* ${finding.risk_impact}`] : []),
      "",
      "h3. Kök Neden Teşhisi (Root Cause Analysis)",
      finding.root_cause_hypothesis || finding.remediation,
      "",
      "h3. Yeniden Üretim Adımları (Reproduction Steps)",
      steps,
      "",
      "h3. Önerilen Çözüm (Remediation)",
      finding.remediation,
      ...(finding.code_example ? [
        "",
        "{code:typescript}",
        "// Recommended Fix:",
        finding.code_example,
        "{code}"
      ] : []),
      "",
      `*Labels:* webguard, ${finding.severity.toLowerCase()}, ${(finding.rca_category || "real_bug").toLowerCase().replace(/_/g, "-")}, ${finding.category.toLowerCase()}`
    ].join("\n");

    navigator.clipboard.writeText(jiraMarkdown);
    setCopiedJira(true);
    setTimeout(() => setCopiedJira(false), 3000);
  }

  const hasLocationOrCode = Boolean(
    finding.target_location || finding.line_number || finding.problematic_code || finding.code_example
  );

  return (
    <article className="finding-card" id={`finding-${finding.id}`}>
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
        {rcaMeta && (
          <span
            className="rca-badge"
            style={{ borderColor: rcaMeta.color, color: rcaMeta.color }}
            title={`RCA: ${rcaLabel}`}
          >
            {rcaMeta.icon} {rcaLabel}
          </span>
        )}
        
        <div className="finding-title-group">
          <span className="finding-title">{finding.title}</span>
          {finding.compliance_standard && (
            <span
              className="compliance-badge"
              title={`Uyumluluk Standardı: ${finding.compliance_standard}`}
            >
              ⚖️ {finding.compliance_standard}
            </span>
          )}
          {finding.page_url && (
            <span
              className="finding-location-pill route-pill"
              title={`Page Route: ${finding.page_url}`}
            >
              <span className="pill-icon">🌐</span>
              <span className="pill-path">
                {(() => {
                  try {
                    return new URL(finding.page_url).pathname || "/";
                  } catch {
                    return finding.page_url;
                  }
                })()}
              </span>
            </span>
          )}
          {finding.target_location && (
            <span
              className="finding-location-pill"
              title={`${t.targetFile}: ${finding.target_location}${finding.line_number ? ` (${t.line} ${finding.line_number})` : ""}`}
            >
              <span className="pill-icon">📄</span>
              <span className="pill-path">{finding.target_location}</span>
              {finding.line_number ? (
                <span className="pill-line">:{finding.line_number}</span>
              ) : null}
            </span>
          )}
          {finding.team_assignment && (
            <span
              className="finding-location-pill team-pill"
              title={`Atanan Çözüm Ekibi: ${finding.team_assignment}`}
            >
              🏢 {finding.team_assignment}
            </span>
          )}
        </div>

        <span className={`finding-chevron ${open ? "open" : ""}`} aria-hidden>▾</span>
      </div>

      {open && (
        <div className="finding-body">
          {/* TestSprite Failure Diagnostic Bundle Header Banner */}
          <div className="diagnostic-banner-card">
            <div className="diag-banner-top">
              <div className="diag-banner-badge">
                <span className="banner-icon">🔬</span>
                <span className="banner-title">{t.diagnosticBundleTitle || "TestSprite Failure Diagnostic Bundle"}</span>
              </div>
              <div className="diag-banner-btn-group">
                <button
                  type="button"
                  className={`diag-action-btn copy-ide ${copiedIde ? "copied" : ""}`}
                  onClick={handleCopyIdeBundle}
                  title="Cursor / Claude Code / Windsurf için tam teşhis paketini kopyala"
                >
                  {copiedIde ? (t.copiedForIde || "✓ JSON Kopyalandı!") : (t.copyForIde || "📋 Cursor / Claude Code İçin Kopyala")}
                </button>
                <button
                  type="button"
                  className={`diag-action-btn copy-jira ${copiedJira ? "copied" : ""}`}
                  onClick={handleCopyJiraIssue}
                  title="Virgosol Usulü: Jira / GitHub Issue Formatında Kopyala"
                >
                  {copiedJira ? "✓ Jira Kopyalandı!" : "📋 Jira Issue Kopyala"}
                </button>
                <button
                  type="button"
                  className="diag-action-btn open-modal"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDiagnosticModal(true);
                  }}
                  title="Tam Ekran Öncesi / Sonrası Karşılaştırma ve Teşhis Paneli"
                >
                  ⚡ {t.zoomInspect || "Zengin Teşhis & Öncesi/Sonrası Paneli"}
                </button>
              </div>
            </div>
            <p className="diag-banner-text">
              {t.diagnosticBundleSubtitle || "Öncesi / Sonrası ekran görüntüleri, adım adım hata izi ve yapay zeka kök neden teşhisi."}
            </p>
          </div>

          <p className="finding-desc">{finding.description}</p>

          {/* 1. Risk & Impact Analysis */}
          {finding.risk_impact && (
            <div className="risk-impact-block">
              <div className="risk-impact-header">
                <span className="risk-icon">⚠️</span>
                <span className="risk-label">{t.riskLabel}</span>
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
                      📍 {t.line}: {finding.line_number}
                    </span>
                  ) : (
                    <span className="ide-line-badge">
                      ⚙️ {t.serverBlock}
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
                    {copied ? t.copied : t.copyCode}
                  </button>
                )}
              </div>

              {/* Deficient Code (Current / Before) */}
              {finding.problematic_code && (
                <div className="ide-section ide-section-problem">
                  <div className="ide-section-header problem-header">
                    <span className="ide-tag-badge error-badge">❌ {t.deficientLabel}</span>
                    {finding.line_number && (
                      <span className="ide-target-line">{t.line}: ~{finding.line_number}</span>
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
                    <span className="ide-tag-badge fix-badge">✅ {t.fixLabel}</span>
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
            <div className="remediation-label">{t.remediationLabel}</div>
            <p className="remediation-text">{finding.remediation}</p>
          </div>

          {/* 4. Technical Evidence Log */}
          {finding.evidence && (
            <details className="evidence-details">
              <summary style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>
                {t.rawLog}
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

          {/* 5. Interaction Log (Phase 2) */}
          {finding.interaction_log && finding.interaction_log.length > 0 && (
            <details className="evidence-details">
              <summary style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>
                🤖 {t.interactionLog} ({finding.interaction_log.length} steps)
              </summary>
              <ol style={{
                marginTop: "8px",
                fontSize: "11.5px",
                color: "var(--text-secondary)",
                fontFamily: "'JetBrains Mono', monospace",
                background: "var(--bg-elevated)",
                borderRadius: "6px",
                padding: "10px 12px 10px 28px",
                lineHeight: "1.8",
              }}>
                {finding.interaction_log.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ol>
            </details>
          )}

          {/* 5. Step-by-Step Reproduction Trace (TestSprite Diagnostic) */}
          {finding.reproduction_steps && finding.reproduction_steps.length > 0 && (
            <div className="reproduction-trace-block">
              <div className="reproduction-trace-header">
                <span className="trace-icon">👣</span>
                <span className="trace-title">{t.reproductionTrace || "Adım Adım Hata İzi (Reproduction Trace)"}</span>
              </div>
              <div className="reproduction-trace-list">
                {finding.reproduction_steps.map((step, idx) => (
                  <div key={idx} className="reproduction-step-row">
                    <span className="step-idx">{idx + 1}</span>
                    <span className="step-desc">{step.replace(/^\d+\.\s*/, "")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. AI Root Cause Hypothesis (RCA) */}
          {finding.root_cause_hypothesis && (
            <div className="rca-hypothesis-block">
              <div className="rca-hypothesis-header">
                <span className="rca-icon">🧠</span>
                <span className="rca-title">{t.rootCauseHypothesis || "Yapay Zeka Kök Neden Hipotezi"}</span>
                {rcaMeta && (
                  <span className="rca-sub-badge" style={{ color: rcaMeta.color, borderColor: rcaMeta.color }}>
                    {rcaMeta.icon} {rcaLabel}
                  </span>
                )}
              </div>
              <p className="rca-hypothesis-desc">{finding.root_cause_hypothesis}</p>
            </div>
          )}

          {/* 7. Screenshot Evidence Viewer (Side-by-Side & Tabbed Modes) */}
          {hasScreenshots && (
            <div className="screenshot-viewer">
              <div className="screenshot-header-toolbar">
                <div className="screenshot-modes">
                  <button
                    type="button"
                    className={`screenshot-mode-toggle ${screenshotMode === "split" ? "active" : ""}`}
                    onClick={() => setScreenshotMode("split")}
                  >
                    ⚡ {t.viewSideBySide || "Yan Yana (Split)"}
                  </button>
                  <button
                    type="button"
                    className={`screenshot-mode-toggle ${screenshotMode === "tabs" ? "active" : ""}`}
                    onClick={() => setScreenshotMode("tabs")}
                  >
                    📑 {t.viewTabbed || "Sekmeli"}
                  </button>
                </div>
                <button
                  type="button"
                  className="screenshot-zoom-btn"
                  onClick={() => setShowDiagnosticModal(true)}
                  title="Tam Ekran İncele & Karşılaştır"
                >
                  🔍 {t.zoomInspect || "Büyüt & İncele"}
                </button>
              </div>

              {screenshotMode === "tabs" ? (
                <>
                  <div className="screenshot-tabs">
                    {finding.screenshot_before_b64 && (
                      <button
                        className={`screenshot-tab ${screenshotTab === "before" ? "active" : ""}`}
                        onClick={() => setScreenshotTab("before")}
                      >
                        {t.beforeInteraction}
                      </button>
                    )}
                    {finding.screenshot_after_b64 && (
                      <button
                        className={`screenshot-tab ${screenshotTab === "after" ? "active" : ""}`}
                        onClick={() => setScreenshotTab("after")}
                      >
                        {t.afterInteraction}
                      </button>
                    )}
                  </div>
                  <div className="screenshot-frame">
                    {screenshotTab === "before" && finding.screenshot_before_b64 && (
                      <img
                        src={finding.screenshot_before_b64}
                        alt="Browser state before interaction"
                        className="screenshot-img"
                        onClick={() => setShowDiagnosticModal(true)}
                        style={{ cursor: "zoom-in" }}
                      />
                    )}
                    {screenshotTab === "after" && finding.screenshot_after_b64 && (
                      <img
                        src={finding.screenshot_after_b64}
                        alt="Browser state after interaction"
                        className="screenshot-img"
                        onClick={() => setShowDiagnosticModal(true)}
                        style={{ cursor: "zoom-in" }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="screenshot-split-grid">
                  <div className="split-screen-col">
                    <div className="split-label before">
                      <span className="dot green" /> {t.beforeState || "Öncesi (Baseline)"}
                    </div>
                    {finding.screenshot_before_b64 ? (
                      <img
                        src={finding.screenshot_before_b64}
                        alt="Before"
                        className="screenshot-img"
                        onClick={() => setShowDiagnosticModal(true)}
                        style={{ cursor: "zoom-in" }}
                      />
                    ) : (
                      <div className="screenshot-placeholder">Baseline unavailable</div>
                    )}
                  </div>
                  <div className="split-screen-col">
                    <div className="split-label after">
                      <span className="dot red" /> {t.afterState || "Sonrası (Hata / Anomali)"}
                    </div>
                    {finding.screenshot_after_b64 ? (
                      <img
                        src={finding.screenshot_after_b64}
                        alt="After"
                        className="screenshot-img"
                        onClick={() => setShowDiagnosticModal(true)}
                        style={{ cursor: "zoom-in" }}
                      />
                    ) : (
                      <div className="screenshot-placeholder">Failure state unavailable</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TestSprite Failure Diagnostic Fullscreen Modal */}
      {showDiagnosticModal && (
        <DiagnosticBundleModal
          finding={rawFinding}
          lang={lang}
          onClose={() => setShowDiagnosticModal(false)}
        />
      )}
    </article>
  );
}
