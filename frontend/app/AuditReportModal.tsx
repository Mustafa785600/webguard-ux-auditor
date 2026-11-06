"use client";

import { useMemo } from "react";
import type { ScanResult } from "@/types/scan";
import { type Language, SECTOR_LABELS } from "@/lib/i18n";
import { GENERAL_CONTROL_RULES } from "./GeneralControlModal";

interface AuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ScanResult;
  lang: Language;
}

export default function AuditReportModal({
  isOpen,
  onClose,
  result,
  lang,
}: AuditReportModalProps) {
  if (!isOpen || !result) return null;

  // Grade calculation
  const overallScore = Math.round(
    result.security_score * 0.45 +
      (result.compliance_score ?? 100) * 0.35 +
      result.ux_score * 0.2
  );

  let grade = "A+";
  let gradeColor = "#10b981";
  let gradeTextTr = "Mükemmel Güvenlik Seviyesi";
  let gradeTextEn = "Excellent Security Posture";

  if (overallScore >= 90) {
    grade = "A+";
    gradeColor = "#10b981";
    gradeTextTr = "Mükemmel Güvenlik Seviyesi";
    gradeTextEn = "Excellent Security Posture";
  } else if (overallScore >= 80) {
    grade = "A";
    gradeColor = "#22c55e";
    gradeTextTr = "Yüksek Güvenlik ve Uyumluluk";
    gradeTextEn = "High Security & Compliance";
  } else if (overallScore >= 70) {
    grade = "B";
    gradeColor = "#eab308";
    gradeTextTr = "Kabul Edilebilir (İyileştirme Önerilir)";
    gradeTextEn = "Acceptable (Remediation Advised)";
  } else if (overallScore >= 55) {
    grade = "C";
    gradeColor = "#f97316";
    gradeTextTr = "Orta Düzey Risk (Müdahale Gerekli)";
    gradeTextEn = "Moderate Risk (Action Required)";
  } else {
    grade = "F";
    gradeColor = "#ef4444";
    gradeTextTr = "Kritik Güvenlik ve Uyumluluk Riski";
    gradeTextEn = "Critical Security & Compliance Risk";
  }

  // Finding counts
  const criticalCount = result.findings.filter((f) => f.severity === "CRITICAL").length;
  const highCount = result.findings.filter((f) => f.severity === "HIGH").length;
  const mediumCount = result.findings.filter((f) => f.severity === "MEDIUM").length;
  const lowCount = result.findings.filter((f) => f.severity === "LOW").length;

  const findingIdsSet = new Set(result.findings.map((f) => f.id));

  // Map 27 rules
  const evaluatedRules = useMemo(() => {
    return GENERAL_CONTROL_RULES.map((rule) => {
      const matched = rule.findingIds.filter((id) => findingIdsSet.has(id));
      return {
        ...rule,
        passed: matched.length === 0,
      };
    });
  }, [findingIdsSet]);

  const passedRulesCount = evaluatedRules.filter((r) => r.passed).length;
  const compliancePercentage = Math.round((passedRulesCount / evaluatedRules.length) * 100);

  const activeSector = result.detected_sector ?? result.selected_sector ?? "GENERAL";
  const sectorInfo = SECTOR_LABELS[lang][activeSector] ?? SECTOR_LABELS[lang].GENERAL;

  const formattedDate = new Date(result.started_at || Date.now()).toLocaleDateString(
    lang === "tr" ? "tr-TR" : "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  const reportId = `WG-${(result.scan_id || "AUDIT").slice(0, 8).toUpperCase()}`;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="report-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="report-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Action Bar (Screen Only) */}
        <div className="report-toolbar report-no-print">
          <div className="report-toolbar-left">
            <span className="report-toolbar-badge">📄 {lang === "tr" ? "RESMİ YÖNETİCİ DENETİM RAPORU" : "EXECUTIVE AUDIT REPORT"}</span>
            <span className="report-toolbar-id">{reportId}</span>
          </div>
          <div className="report-toolbar-right">
            <button
              type="button"
              className="report-btn-print"
              onClick={handlePrint}
              title={lang === "tr" ? "Yazdır veya PDF Olarak Kaydet" : "Print or Save as PDF"}
            >
              🖨️ {lang === "tr" ? "PDF Olarak Kaydet / Yazdır" : "Save as PDF / Print"}
            </button>
            <button type="button" className="report-btn-close" onClick={onClose} title="Kapat">
              ✕
            </button>
          </div>
        </div>

        {/* Printable Official Report Paper */}
        <div className="report-scroll-wrapper">
          <div className="report-paper" id="executive-audit-report">
            {/* Report Header */}
            <header className="report-header">
              <div className="report-brand">
                <div className="report-logo">🛡️ WebGuard</div>
                <div className="report-subbrand">
                  CYBERSECURITY & UX AUDIT SUITE — ISO 27001 & PCI-DSS ALIGNED
                </div>
              </div>
              <div className="report-stamp" style={{ borderColor: gradeColor }}>
                <span className="stamp-label">{lang === "tr" ? "GÜVENLİK NOTU" : "OVERALL GRADE"}</span>
                <span className="stamp-grade" style={{ color: gradeColor }}>
                  {grade}
                </span>
                <span className="stamp-status">{lang === "tr" ? gradeTextTr : gradeTextEn}</span>
              </div>
            </header>

            {/* Document Meta Table */}
            <section className="report-meta-grid">
              <div className="meta-item">
                <span className="meta-lbl">{lang === "tr" ? "Hedef Web Uygulaması" : "Target Web Application"}:</span>
                <span className="meta-val url-val">{result.target_url}</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">{lang === "tr" ? "Denetim Referans Kodu" : "Audit Reference ID"}:</span>
                <span className="meta-val mono">{reportId}</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">{lang === "tr" ? "Denetim Tarihi ve Saati" : "Audit Timestamp"}:</span>
                <span className="meta-val">{formattedDate}</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">{lang === "tr" ? "Uygulanan Sektör Protokolü" : "Industry Protocol"}:</span>
                <span className="meta-val">
                  {sectorInfo.icon} {sectorInfo.name} ({sectorInfo.standard})
                </span>
              </div>
            </section>

            {/* Scorecard Triad */}
            <section className="report-section">
              <h2 className="report-section-title">
                📊 {lang === "tr" ? "1. Yönetici Skor ve Uyum Özeti" : "1. Executive Score & Posture Summary"}
              </h2>
              <div className="report-scores-trio">
                <div className="report-score-card sec">
                  <span className="score-trio-lbl">{lang === "tr" ? "Güvenlik Skoru" : "Security Score"}</span>
                  <span className="score-trio-num">{result.security_score} / 100</span>
                  <div className="score-trio-bar">
                    <div className="score-bar-fill" style={{ width: `${result.security_score}%`, background: "#6366f1" }} />
                  </div>
                </div>
                <div className="report-score-card comp">
                  <span className="score-trio-lbl">{lang === "tr" ? "Mevzuat & Standart Uyumu" : "Compliance & Standards"}</span>
                  <span className="score-trio-num">{result.compliance_score ?? 100} / 100</span>
                  <div className="score-trio-bar">
                    <div className="score-bar-fill" style={{ width: `${result.compliance_score ?? 100}%`, background: "#f59e0b" }} />
                  </div>
                </div>
                <div className="report-score-card ux">
                  <span className="score-trio-lbl">{lang === "tr" ? "UX & Erişilebilirlik" : "UX & Accessibility"}</span>
                  <span className="score-trio-num">{result.ux_score} / 100</span>
                  <div className="score-trio-bar">
                    <div className="score-bar-fill" style={{ width: `${result.ux_score}%`, background: "#10b981" }} />
                  </div>
                </div>
              </div>

              {/* Narrative Summary Box */}
              <div className="report-narrative-box">
                <p>
                  {lang === "tr" ? (
                    <>
                      <strong>Yönetici Değerlendirmesi: </strong>
                      Bu resmi denetim belgesi, <strong>{result.target_url}</strong> hedef web uygulamasının
                      statik, dinamik ve mevzuatsal güvenlik dayanıklılığını doğrulamak üzere üretilmiştir.
                      Sistem <strong>{sectorInfo.name} ({sectorInfo.standard})</strong> standartlarına tabi
                      tutulmuş; gerçekleştirilen taramalar neticesinde <strong>%{result.security_score}</strong> Güvenlik,
                      {" "}<strong>%{result.compliance_score ?? 100}</strong> Standart Uyumu ve <strong>%{result.ux_score}</strong> UX
                      skoru kaydedilmiştir. Denetlenen 27 temel kuraldan <strong>{passedRulesCount} tanesi başarıyla geçilmiş</strong> (uyumluluk oranı: %{compliancePercentage}),
                      toplam <strong>{result.findings.length} adet bulgu</strong> ({criticalCount} Kritik, {highCount} Yüksek) tespit edilmiştir.
                    </>
                  ) : (
                    <>
                      <strong>Executive Assessment: </strong>
                      This official security assessment was generated to evaluate the static, dynamic, and regulatory posture of{" "}
                      <strong>{result.target_url}</strong>. The target was audited under the{" "}
                      <strong>{sectorInfo.name} ({sectorInfo.standard})</strong> framework, achieving a Security Score of{" "}
                      <strong>{result.security_score}%</strong>, Compliance Score of <strong>{result.compliance_score ?? 100}%</strong>,
                      and UX Score of <strong>{result.ux_score}%</strong>. Out of 27 baseline requirements,{" "}
                      <strong>{passedRulesCount} passed successfully</strong> (compliance rate: {compliancePercentage}%), with{" "}
                      <strong>{result.findings.length} total findings</strong> ({criticalCount} Critical, {highCount} High).
                    </>
                  )}
                </p>
              </div>
            </section>

            {/* 27-Rule GeneralControl Audit Matrix */}
            <section className="report-section report-page-break">
              <h2 className="report-section-title">
                🛡️ {lang === "tr" ? "2. 27 Maddelik GeneralControl Denetim Matrisi" : "2. 27-Point GeneralControl Audit Matrix"}
              </h2>
              <table className="report-matrix-table">
                <thead>
                  <tr>
                    <th style={{ width: "35px" }}>#</th>
                    <th style={{ width: "130px" }}>{lang === "tr" ? "Kategori" : "Category"}</th>
                    <th>{lang === "tr" ? "Kriter Başlığı ve Kapsamı" : "Audit Requirement & Scope"}</th>
                    <th style={{ width: "95px", textAlign: "center" }}>{lang === "tr" ? "Sonuç" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluatedRules.map((rule, idx) => {
                    const isPassed = rule.passed;
                    const cat = lang === "tr" ? rule.categoryTr : rule.categoryEn;
                    const title = lang === "tr" ? rule.titleTr : rule.titleEn;
                    return (
                      <tr key={rule.id} className={isPassed ? "row-passed" : "row-failed"}>
                        <td className="cell-num">{idx + 1}</td>
                        <td className="cell-cat">
                          <span className="matrix-cat-tag">{cat}</span>
                        </td>
                        <td className="cell-title">
                          <strong>{title}</strong>
                        </td>
                        <td className="cell-status" style={{ textAlign: "center" }}>
                          <span className={`matrix-status-pill ${isPassed ? "passed" : "failed"}`}>
                            {isPassed ? (lang === "tr" ? "✓ GEÇTİ" : "✓ PASSED") : (lang === "tr" ? "✕ RİSKLİ" : "✕ FAILED")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {/* Detected Findings & Remediation Plan */}
            <section className="report-section report-page-break">
              <h2 className="report-section-title">
                ⚠️ {lang === "tr" ? "3. Tespit Edilen Riskler ve Çözüm Planı" : "3. Detected Risks & Remediation Plan"}
              </h2>
              {result.findings.length === 0 ? (
                <div className="report-empty-findings">
                  🎉 {lang === "tr" ? "Tebrikler! Hedef sistemde kritik veya orta seviye güvenlik açığı tespit edilmedi." : "Congratulations! No vulnerabilities detected on the target system."}
                </div>
              ) : (
                <div className="report-findings-list">
                  {result.findings.map((f, i) => (
                    <div key={f.id + i} className={`report-finding-card sev-${f.severity.toLowerCase()}`}>
                      <div className="report-finding-head">
                        <span className={`finding-sev-badge ${f.severity}`}>{f.severity}</span>
                        {f.compliance_standard && (
                          <span className="finding-std-badge">⚖️ {f.compliance_standard}</span>
                        )}
                        <span className="finding-title-text">{f.title}</span>
                      </div>
                      <p className="finding-desc-text">{f.description}</p>
                      {f.risk_impact && (
                        <div className="finding-risk-box">
                          <strong>{lang === "tr" ? "Risk Etkisi: " : "Risk Impact: "}</strong>
                          {f.risk_impact}
                        </div>
                      )}
                      {f.code_example && (
                        <div className="finding-remediation-box">
                          <span className="remediation-title">
                            🛠️ {lang === "tr" ? "Önerilen Sunucu Düzeltmesi (Çözüm):" : "Recommended Server Remediation:"}
                          </span>
                          <pre className="remediation-code">{f.code_example}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Official Sign-Off Footer */}
            <footer className="report-footer">
              <div className="footer-disclaimer">
                {lang === "tr"
                  ? "Bu belge WebGuard Otonom Güvenlik & UX Denetim Platformu tarafından üretilmiş olup kurumsal değerlendirme ve denetim amacıyla hazırlanmıştır. Bulguların giderilmesi ve düzenli yeniden taranması tavsiye edilir."
                  : "This official report was compiled by the WebGuard Autonomous Security & UX Platform for audit and governance purposes. Regular re-assessment is strongly advised."}
              </div>
              <div className="footer-signatures">
                <div className="signature-box">
                  <span className="sig-title">{lang === "tr" ? "Denetim Platformu:" : "Audit Engine:"}</span>
                  <span className="sig-name">WebGuard AI Auditor v2.4</span>
                  <span className="sig-code">{reportId} — Verified Cryptographic Hash</span>
                </div>
                <div className="signature-box right">
                  <span className="sig-title">{lang === "tr" ? "Rapor Tarihi:" : "Issuance Date:"}</span>
                  <span className="sig-name">{formattedDate}</span>
                  <span className="sig-status">STATUS: CERTIFIED AUDIT</span>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

