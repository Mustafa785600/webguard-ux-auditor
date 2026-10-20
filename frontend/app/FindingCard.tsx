"use client";

import { useState } from "react";
import type { Finding } from "@/types/scan";

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

  const hasLocationInfo = Boolean(
    finding.target_location || finding.line_number || finding.problematic_code
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
        <span className="finding-title">{finding.title}</span>
        <span className={`finding-chevron ${open ? "open" : ""}`} aria-hidden>▾</span>
      </div>

      {open && (
        <div className="finding-body">
          <p className="finding-desc">{finding.description}</p>

          {/* 1. Risk Açıklaması (Risk & Impact) */}
          {finding.risk_impact && (
            <div className="risk-impact-block">
              <div className="risk-impact-header">
                <span className="risk-icon">⚠️</span>
                <span className="risk-label">RİSK AÇIKLAMASI &amp; ETKİ ANALİZİ</span>
              </div>
              <p className="risk-text">{finding.risk_impact}</p>
            </div>
          )}

          {/* 2. Düzeltilecek Bölüm & Konum (Target File, Line & Problematic Code) */}
          {hasLocationInfo && (
            <div className="location-block">
              <div className="location-header">
                <div className="location-left">
                  <span className="location-pin">📍</span>
                  <span className="location-title">DÜZELTİLECEK BÖLÜM &amp; KONUM</span>
                </div>
                <div className="location-tags">
                  {finding.target_location && (
                    <span className="location-badge" title="Dosya / Yapılandırma">
                      📄 {finding.target_location}
                    </span>
                  )}
                  {finding.line_number && (
                    <span className="line-badge" title="Kaynak koddaki satır">
                      Satır: {finding.line_number}
                    </span>
                  )}
                </div>
              </div>
              {finding.problematic_code && (
                <div className="problematic-wrapper">
                  <div className="problematic-sublabel">Mevcut / Hatalı Kod veya Durum:</div>
                  <pre className="problematic-pre">
                    <code>{finding.problematic_code}</code>
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* 3. Çözüm Rehberi (Remediation) */}
          <div className="remediation-block">
            <div className="remediation-label">ÇÖZÜM REHBERİ (REMEDIATION)</div>
            <p className="remediation-text">{finding.remediation}</p>
          </div>

          {/* 4. Nasıl Düzeltilir? Örnek Çözüm Kodu */}
          {finding.code_example && (
            <div className="code-example-block">
              <div className="code-example-header">
                <span className="code-example-title">🛠️ NASIL DÜZELTİLİR? (ÖRNEK ÇÖZÜM KODU)</span>
                <button
                  type="button"
                  className={`code-copy-btn ${copied ? "copied" : ""}`}
                  onClick={handleCopyCode}
                  title="Kodu kopyala"
                >
                  {copied ? "✓ Kopyalandı" : "📋 Kodu Kopyala"}
                </button>
              </div>
              <pre className="code-example-pre">
                <code>{finding.code_example}</code>
              </pre>
            </div>
          )}

          {/* 5. Teknik Kanıt (Technical Evidence) */}
          {finding.evidence && (
            <details className="evidence-details">
              <summary style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>
                Teknik Kanıt (Evidence Log)
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
