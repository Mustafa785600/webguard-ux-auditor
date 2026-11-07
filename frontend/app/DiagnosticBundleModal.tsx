"use client";

import { useState, useEffect } from "react";
import type { Finding } from "@/types/scan";
import { type Language, UI_STRINGS } from "@/lib/i18n";

interface DiagnosticBundleModalProps {
  finding: Finding;
  lang?: Language;
  onClose: () => void;
}

const RCA_META: Record<string, { labelEn: string; labelTr: string; color: string; icon: string }> = {
  REAL_BUG:          { labelEn: "Real Bug",          labelTr: "Gerçek Kod Hatası",   color: "#ef4444", icon: "🔴" },
  TEST_FRAGILITY:    { labelEn: "Test Fragility",     labelTr: "Test Kırılganlığı",    color: "#f59e0b", icon: "🟡" },
  ENV_ISSUE:         { labelEn: "Environment Issue",  labelTr: "Sunucu / Altyapı",    color: "#3b82f6", icon: "🔵" },
  EXPECTED_BEHAVIOR: { labelEn: "Expected Behavior",  labelTr: "Beklenen Davranış",   color: "#6b7280", icon: "⚪" },
};

export default function DiagnosticBundleModal({
  finding,
  lang = "tr",
  onClose,
}: DiagnosticBundleModalProps) {
  const [viewMode, setViewMode] = useState<"split" | "before" | "after">("split");
  const [copiedIde, setCopiedIde] = useState(false);
  const [copiedJira, setCopiedJira] = useState(false);
  const [copiedDom, setCopiedDom] = useState(false);

  const t = UI_STRINGS[lang] || UI_STRINGS.tr;
  const rcaMeta = finding.rca_category ? RCA_META[finding.rca_category] : RCA_META.REAL_BUG;
  const rcaLabel = lang === "tr" ? rcaMeta.labelTr : rcaMeta.labelEn;

  // Synthesize reproduction steps if not explicitly provided
  const reproductionSteps = finding.reproduction_steps && finding.reproduction_steps.length > 0
    ? finding.reproduction_steps
    : [
        `1. Navigate to target URL: ${finding.page_url || "Target Application"}`,
        `2. Inspect component / endpoint: ${finding.target_location || "DOM Document"}`,
        `3. Execute security & UX assertion for rule [${finding.id}]`,
        `4. Anomaly detected: ${finding.title}`,
      ];

  const rootCause = finding.root_cause_hypothesis || finding.remediation;
  const domSnapshot = finding.dom_snapshot || finding.problematic_code || `<!-- Offending Target: ${finding.target_location || finding.title} -->`;

  const beforeImg = finding.screenshot_before_b64;
  const afterImg = finding.screenshot_after_b64 || finding.screenshot_before_b64;
  const hasScreenshots = Boolean(beforeImg || afterImg);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleCopyIdeBundle() {
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
        root_cause_hypothesis: rootCause,
        reproduction_trace: reproductionSteps,
        dom_snapshot: domSnapshot,
        deficient_code: finding.problematic_code || null,
        recommended_fix: finding.code_example || finding.remediation,
      },
      instructions_for_ai: (
        `Please resolve the issue '${finding.title}' identified at ${finding.target_location || "the target page"}. ` +
        `Root cause hypothesis: ${rootCause}. ` +
        `Apply the recommended fix to eliminate this defect and prevent regressions.`
      ),
    };

    navigator.clipboard.writeText(JSON.stringify(ideBundle, null, 2));
    setCopiedIde(true);
    setTimeout(() => setCopiedIde(false), 3000);
  }

  function handleCopyJiraIssue() {
    const team = finding.team_assignment || (
      finding.rca_category === "ENV_ISSUE" ? "DevOps & Sistem Yöneticisi" :
      finding.rca_category === "TEST_FRAGILITY" ? "QA & Test Mühendisliği" :
      "Yazılım Geliştirici (Dev Team)"
    );

    const steps = reproductionSteps.map((s) => `# ${s.replace(/^\d+\.\s*/, "")}`).join("\n");

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
      rootCause,
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

  function handleCopyDom() {
    navigator.clipboard.writeText(domSnapshot);
    setCopiedDom(true);
    setTimeout(() => setCopiedDom(false), 2000);
  }

  return (
    <div className="diagnostic-modal-backdrop" onClick={onClose}>
      <div
        className="diagnostic-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Failure Diagnostic Bundle"
      >
        {/* Modal Top Bar */}
        <div className="diagnostic-modal-header">
          <div className="diagnostic-modal-title-wrap">
            <div className="diagnostic-brand-badge">
              <span className="brand-icon">🔬</span>
              <span className="brand-name">TestSprite AI Diagnostic Bundle</span>
            </div>
            <h2 className="diagnostic-modal-heading">{finding.title}</h2>
            <div className="diagnostic-tags-row">
              <span className={`severity-badge ${finding.severity}`}>{finding.severity}</span>
              <span
                className="rca-badge"
                style={{ borderColor: rcaMeta.color, color: rcaMeta.color }}
              >
                {rcaMeta.icon} RCA: {rcaLabel}
              </span>
              {finding.target_location && (
                <span className="diagnostic-loc-tag">
                  📄 {finding.target_location}{finding.line_number ? `:${finding.line_number}` : ""}
                </span>
              )}
              {finding.page_url && (
                <span className="diagnostic-route-tag">
                  🌐 {(() => {
                    try {
                      return new URL(finding.page_url).pathname || "/";
                    } catch {
                      return finding.page_url;
                    }
                  })()}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="diagnostic-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Action Bar (Export to IDE & View Mode Switcher) */}
        <div className="diagnostic-action-toolbar">
          <div className="diagnostic-view-toggles">
            {hasScreenshots && (
              <>
                <button
                  type="button"
                  className={`diag-mode-btn ${viewMode === "split" ? "active" : ""}`}
                  onClick={() => setViewMode("split")}
                >
                  ⚡ {t.viewSideBySide || "Yan Yana (Split)"}
                </button>
                <button
                  type="button"
                  className={`diag-mode-btn ${viewMode === "before" ? "active" : ""}`}
                  onClick={() => setViewMode("before")}
                >
                  🟢 {t.beforeState || "Öncesi (Baseline)"}
                </button>
                <button
                  type="button"
                  className={`diag-mode-btn ${viewMode === "after" ? "active" : ""}`}
                  onClick={() => setViewMode("after")}
                >
                  🔴 {t.afterState || "Sonrası (Hata)"}
                </button>
              </>
            )}
          </div>

          <div className="diag-export-group">
            <button
              type="button"
              className={`diag-ide-export-btn ${copiedIde ? "copied" : ""}`}
              onClick={handleCopyIdeBundle}
              title="Cursor / Claude Code / Windsurf için tam teşhis paketini kopyala"
            >
              <span className="btn-icon">{copiedIde ? "✓" : "📋"}</span>
              <span>
                {copiedIde
                  ? (t.copiedForIde || "✓ JSON Kopyalandı!")
                  : (t.copyForIde || "Cursor / Claude Code")}
              </span>
            </button>

            <button
              type="button"
              className={`diag-jira-export-btn ${copiedJira ? "copied" : ""}`}
              onClick={handleCopyJiraIssue}
              title="Virgosol Usulü: Jira / GitHub Issue Formatında Kopyala"
            >
              <span className="btn-icon">{copiedJira ? "✓" : "🏢"}</span>
              <span>
                {copiedJira
                  ? "✓ Jira Formatı Kopyalandı!"
                  : "Jira Issue Kopyala"}
              </span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="diagnostic-modal-body">
          {/* 1. Visual Before / After Split Viewer */}
          {hasScreenshots && (
            <section className="diag-section visual-diff-section">
              <div className="diag-section-header">
                <span className="section-icon">📸</span>
                <span className="section-title">
                  {lang === "tr" ? "Görsel Kanıt & Öncesi / Sonrası Durum Analizi" : "Visual Evidence & Before / After State Diff"}
                </span>
              </div>

              {viewMode === "split" && (
                <div className="diag-split-grid">
                  {/* Left: Before */}
                  <div className="diag-screenshot-panel panel-before">
                    <div className="panel-status-bar status-before">
                      <span className="status-dot green" />
                      <span className="panel-title">{t.beforeState || "Öncesi (Baseline State)"}</span>
                    </div>
                    <div className="diag-img-wrapper">
                      {beforeImg ? (
                        <img src={beforeImg} alt="Baseline State" className="diag-screen-img" />
                      ) : (
                        <div className="diag-placeholder-screen">Baseline screenshot not available</div>
                      )}
                    </div>
                  </div>

                  {/* Right: After */}
                  <div className="diag-screenshot-panel panel-after">
                    <div className="panel-status-bar status-after">
                      <span className="status-dot red" />
                      <span className="panel-title">{t.afterState || "Sonrası (Hata / Anomali Tetiklendi)"}</span>
                    </div>
                    <div className="diag-img-wrapper">
                      {afterImg ? (
                        <img src={afterImg} alt="Failure State" className="diag-screen-img" />
                      ) : (
                        <div className="diag-placeholder-screen">Failure screenshot not available</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {viewMode === "before" && beforeImg && (
                <div className="diag-single-screen-panel panel-before">
                  <div className="panel-status-bar status-before">
                    <span className="status-dot green" />
                    <span className="panel-title">{t.beforeState || "Öncesi (Baseline)"}</span>
                  </div>
                  <img src={beforeImg} alt="Baseline State" className="diag-screen-img-full" />
                </div>
              )}

              {viewMode === "after" && afterImg && (
                <div className="diag-single-screen-panel panel-after">
                  <div className="panel-status-bar status-after">
                    <span className="status-dot red" />
                    <span className="panel-title">{t.afterState || "Sonrası (Hata / Anomali)"}</span>
                  </div>
                  <img src={afterImg} alt="Failure State" className="diag-screen-img-full" />
                </div>
              )}
            </section>
          )}

          {/* 2. Step-by-Step Reproduction Trace */}
          <section className="diag-section reproduction-section">
            <div className="diag-section-header">
              <span className="section-icon">👣</span>
              <span className="section-title">
                {t.reproductionTrace || "Adım Adım Hata Üretim İzi (Reproduction Trace)"}
              </span>
            </div>
            <div className="diag-steps-timeline">
              {reproductionSteps.map((step, idx) => (
                <div key={idx} className="diag-step-item">
                  <div className="diag-step-num-badge">{idx + 1}</div>
                  <div className="diag-step-content">
                    <span className="diag-step-text">{step.replace(/^\d+\.\s*/, "")}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Offending Element & DOM Snapshot */}
          <section className="diag-section dom-section">
            <div className="diag-section-header">
              <div className="header-left">
                <span className="section-icon">🧬</span>
                <span className="section-title">
                  {t.domSnapshot || "Hedef DOM / Ağ Anlık Görüntüsü"}
                </span>
              </div>
              <button
                type="button"
                className="diag-snippet-copy-btn"
                onClick={handleCopyDom}
              >
                {copiedDom ? "✓ Kopyalandı" : "📋 DOM Kopyala"}
              </button>
            </div>
            <div className="diag-code-box">
              <pre className="diag-code-pre">
                <code>{domSnapshot}</code>
              </pre>
            </div>
          </section>

          {/* 4. AI Root Cause Hypothesis */}
          <section className="diag-section rca-section">
            <div className="diag-section-header">
              <span className="section-icon">🧠</span>
              <span className="section-title">
                {t.rootCauseHypothesis || "Yapay Zeka Kök Neden Hipotezi (RCA)"}
              </span>
            </div>
            <div className="diag-rca-box" style={{ borderLeftColor: rcaMeta.color }}>
              <div className="diag-rca-tag" style={{ color: rcaMeta.color }}>
                {rcaMeta.icon} {rcaLabel} Teşhisi
              </div>
              <p className="diag-rca-text">{rootCause}</p>
            </div>
          </section>

          {/* 5. Recommended Fix Code (If Available) */}
          {finding.code_example && (
            <section className="diag-section fix-section">
              <div className="diag-section-header">
                <span className="section-icon">✅</span>
                <span className="section-title">
                  {lang === "tr" ? "Önerilen Otomatik Çözüm Kodu" : "Recommended Solution Code"}
                </span>
              </div>
              <div className="diag-code-box fix-box">
                <pre className="diag-code-pre">
                  <code>{finding.code_example}</code>
                </pre>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

