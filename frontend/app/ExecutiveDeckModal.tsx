"use client";

import { useState, useEffect, useMemo } from "react";
import type { ScanResult, Finding, Severity } from "@/types/scan";
import { type Language, SECTOR_LABELS } from "@/lib/i18n";

interface ExecutiveDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ScanResult;
  lang: Language;
}

export default function ExecutiveDeckModal({
  isOpen,
  onClose,
  result,
  lang,
}: ExecutiveDeckModalProps) {
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const totalSlides = 5;

  // Keyboard navigation: Arrow keys, Escape, Space
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setCurrentSlide((prev) => Math.min(totalSlides - 1, prev + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentSlide((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Overall Grade calculation
  const overallScore = Math.round(
    result.security_score * 0.45 +
      (result.compliance_score ?? 100) * 0.35 +
      result.ux_score * 0.2
  );

  let grade = "A+";
  let gradeColor = "#10b981";
  let gradeTextTr = "Mükemmel Kurumsal Duruş";
  let gradeTextEn = "Excellent Corporate Posture";

  if (overallScore >= 90) {
    grade = "A+";
    gradeColor = "#10b981";
    gradeTextTr = "Mükemmel Kurumsal Duruş";
    gradeTextEn = "Excellent Corporate Posture";
  } else if (overallScore >= 80) {
    grade = "A";
    gradeColor = "#22c55e";
    gradeTextTr = "Yüksek Güvenlik & Uyum";
    gradeTextEn = "High Security & Compliance";
  } else if (overallScore >= 70) {
    grade = "B";
    gradeColor = "#eab308";
    gradeTextTr = "Kabul Edilebilir (İyileştirme Gerekir)";
    gradeTextEn = "Acceptable (Remediation Advised)";
  } else if (overallScore >= 55) {
    grade = "C";
    gradeColor = "#f97316";
    gradeTextTr = "Orta Düzey Risk (Müdahale Zorunlu)";
    gradeTextEn = "Moderate Risk (Action Required)";
  } else {
    grade = "F";
    gradeColor = "#ef4444";
    gradeTextTr = "Kritik Kurumsal Risk Seviyesi";
    gradeTextEn = "Critical Corporate Risk Posture";
  }

  const criticalCount = result.findings.filter((f) => f.severity === "CRITICAL").length;
  const highCount = result.findings.filter((f) => f.severity === "HIGH").length;
  const mediumCount = result.findings.filter((f) => f.severity === "MEDIUM").length;
  const lowCount = result.findings.filter((f) => f.severity === "LOW" || f.severity === "INFO").length;

  const activeSector = result.detected_sector ?? result.selected_sector ?? "GENERAL";
  const sectorInfo = SECTOR_LABELS[lang][activeSector] ?? SECTOR_LABELS[lang].GENERAL;

  const formattedDate = new Date(result.started_at || Date.now()).toLocaleDateString(
    lang === "tr" ? "tr-TR" : "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  const reportId = `WG-${(result.scan_id || "AUDIT").slice(0, 8).toUpperCase()}`;

  // Team breakdown
  const teamBreakdown = useMemo(() => {
    const teams: Record<string, { total: number; criticalHigh: number }> = {
      "Yazılım Geliştirici (Dev Team)": { total: 0, criticalHigh: 0 },
      "DevOps & Altyapı (SecOps)": { total: 0, criticalHigh: 0 },
      "QA & Test Mühendisliği": { total: 0, criticalHigh: 0 },
      "Hukuk & Uyum Ekibi (DPO)": { total: 0, criticalHigh: 0 },
    };

    result.findings.forEach((f) => {
      const t = f.team_assignment || "";
      let bucket = "Yazılım Geliştirici (Dev Team)";
      if (t.includes("DevOps") || t.includes("Sistem") || t.includes("Infra")) {
        bucket = "DevOps & Altyapı (SecOps)";
      } else if (t.includes("QA") || t.includes("Test")) {
        bucket = "QA & Test Mühendisliği";
      } else if (t.includes("Hukuk") || t.includes("Uyum") || t.includes("DPO") || f.compliance_standard) {
        bucket = "Hukuk & Uyum Ekibi (DPO)";
      }

      teams[bucket].total += 1;
      if (f.severity === "CRITICAL" || f.severity === "HIGH") {
        teams[bucket].criticalHigh += 1;
      }
    });

    return teams;
  }, [result.findings]);

  // Top 5 Critical Action Items
  const topActionItems = useMemo(() => {
    const severityOrder: Record<Severity, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
      INFO: 4,
    };
    return [...result.findings]
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 5);
  }, [result.findings]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  if (!isOpen) return null;

  return (
    <div className="deck-overlay" role="dialog" aria-modal="true">
      <div className="deck-container">
        {/* Top Control Bar */}
        <div className="deck-nav-bar">
          <div className="deck-nav-left">
            <span className="deck-logo">🛡️ WebGuard</span>
            <span className="deck-badge">
              📽️ {lang === "tr" ? "C-Level Yönetici Sunum Modu" : "Executive Presentation Deck"}
            </span>
            <span className="deck-ref">{reportId}</span>
          </div>

          <div className="deck-nav-center">
            <div className="deck-slide-pills">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`deck-pill-dot ${currentSlide === idx ? "active" : ""}`}
                  onClick={() => setCurrentSlide(idx)}
                  title={`Slayt ${idx + 1}`}
                />
              ))}
            </div>
            <span className="deck-slide-counter">
              {currentSlide + 1} / {totalSlides}
            </span>
          </div>

          <div className="deck-nav-right">
            <button
              type="button"
              className="deck-btn-tool"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Yap"}
            >
              {isFullscreen ? "🗗" : "⛶"}
            </button>
            <button
              type="button"
              className="deck-btn-close"
              onClick={onClose}
              title="Kapat (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Slide Stage (16:9 Aspect Ratio Container) */}
        <div className="deck-stage">
          {/* SLIDE 0: Executive Cover & Overall Grade */}
          {currentSlide === 0 && (
            <div className="deck-slide slide-cover">
              <div className="deck-cover-content">
                <div className="deck-pretitle">
                  {sectorInfo.icon} {sectorInfo.name} &bull; {sectorInfo.standard}
                </div>
                <h1 className="deck-main-title">
                  {lang === "tr"
                    ? "Kurumsal Güvenlik, UX & Mevzuat Yönetici Sunumu"
                    : "Corporate Security, UX & Regulatory Executive Briefing"}
                </h1>
                <p className="deck-target-url">{result.target_url}</p>
                <div className="deck-date-tag">
                  {formattedDate} &bull; WebGuard Autonomous Governance Suite v2.4
                </div>

                <div className="deck-stamp-hero" style={{ borderColor: gradeColor }}>
                  <div className="deck-stamp-inner">
                    <span className="deck-stamp-label">
                      {lang === "tr" ? "GENEL ŞİRKET GÜVENLİK NOTU" : "OVERALL CORPORATE GRADE"}
                    </span>
                    <span className="deck-stamp-val" style={{ color: gradeColor }}>
                      {grade}
                    </span>
                    <span className="deck-stamp-sub">
                      {lang === "tr" ? gradeTextTr : gradeTextEn} ({overallScore} / 100)
                    </span>
                  </div>
                </div>

                <div className="deck-cover-stats">
                  <div className="deck-stat-col">
                    <span className="stat-num">{criticalCount}</span>
                    <span className="stat-lbl red">{lang === "tr" ? "Kritik Risk" : "Critical Risks"}</span>
                  </div>
                  <div className="deck-stat-col">
                    <span className="stat-num">{highCount}</span>
                    <span className="stat-lbl yellow">{lang === "tr" ? "Yüksek Risk" : "High Risks"}</span>
                  </div>
                  <div className="deck-stat-col">
                    <span className="stat-num">{result.findings.length}</span>
                    <span className="stat-lbl blue">{lang === "tr" ? "Toplam Bulgu" : "Total Findings"}</span>
                  </div>
                  <div className="deck-stat-col">
                    <span className="stat-num">
                      {result.performance_metrics?.p95_latency_ms ?? 120}ms
                    </span>
                    <span className="stat-lbl green">{lang === "tr" ? "P95 Yanıt Süresi" : "P95 Latency"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 1: Executive KPI Scorecard & Performance Triad */}
          {currentSlide === 1 && (
            <div className="deck-slide slide-kpi">
              <div className="deck-slide-header">
                <span className="deck-slide-num">SLAYT 02</span>
                <h2 className="deck-slide-title">
                  📊 {lang === "tr" ? "C-Level Yönetici Skor ve Performans Karnesi" : "Executive Scorecard & Performance Metrics"}
                </h2>
                <p className="deck-slide-desc">
                  {lang === "tr"
                    ? "Temel dijital varlık dayanıklılık metrikleri ve uluslararası standartlara uyum oranları."
                    : "Key digital asset resilience metrics and compliance benchmark indicators."}
                </p>
              </div>

              <div className="deck-kpi-cards-grid">
                <div className="deck-kpi-card sec">
                  <div className="deck-kpi-top">
                    <span className="kpi-icon">🛡️</span>
                    <span className="kpi-title">{lang === "tr" ? "Siber Güvenlik Skoru" : "Cybersecurity Score"}</span>
                  </div>
                  <div className="deck-kpi-score" style={{ color: "#818cf8" }}>
                    %{result.security_score}
                  </div>
                  <div className="deck-kpi-bar-track">
                    <div className="deck-kpi-bar-fill" style={{ width: `${result.security_score}%`, background: "#6366f1" }} />
                  </div>
                  <p className="deck-kpi-note">
                    {lang === "tr"
                      ? "OWASP Top 10, SSL/TLS şifreleme ve sunucu başlık sertleştirmesi."
                      : "OWASP Top 10, SSL/TLS encryption, and server header hardening."}
                  </p>
                </div>

                <div className="deck-kpi-card comp">
                  <div className="deck-kpi-top">
                    <span className="kpi-icon">⚖️</span>
                    <span className="kpi-title">{lang === "tr" ? "Mevzuat & Standart Uyumu" : "Compliance & Standards"}</span>
                  </div>
                  <div className="deck-kpi-score" style={{ color: "#f59e0b" }}>
                    %{result.compliance_score ?? 100}
                  </div>
                  <div className="deck-kpi-bar-track">
                    <div className="deck-kpi-bar-fill" style={{ width: `${result.compliance_score ?? 100}%`, background: "#f59e0b" }} />
                  </div>
                  <p className="deck-kpi-note">
                    {lang === "tr"
                      ? "KVKK, GDPR, PCI-DSS v4.0 ve sektörel düzenleyici yönergeler."
                      : "KVKK, GDPR, PCI-DSS v4.0, and regulatory directives."}
                  </p>
                </div>

                <div className="deck-kpi-card ux">
                  <div className="deck-kpi-top">
                    <span className="kpi-icon">✨</span>
                    <span className="kpi-title">{lang === "tr" ? "Kullanıcı Deneyimi & WCAG" : "UX & Accessibility"}</span>
                  </div>
                  <div className="deck-kpi-score" style={{ color: "#34d399" }}>
                    %{result.ux_score}
                  </div>
                  <div className="deck-kpi-bar-track">
                    <div className="deck-kpi-bar-fill" style={{ width: `${result.ux_score}%`, background: "#10b981" }} />
                  </div>
                  <p className="deck-kpi-note">
                    {lang === "tr"
                      ? "WCAG 2.1 erişilebilirlik, mobil duyarlılık ve kırık bağlantı denetimi."
                      : "WCAG 2.1 accessibility, mobile responsiveness, and link integrity."}
                  </p>
                </div>

                <div className="deck-kpi-card autoheal">
                  <div className="deck-kpi-top">
                    <span className="kpi-icon">🧪</span>
                    <span className="kpi-title">{lang === "tr" ? "Test Kırılmazlık & Auto-Heal" : "Test Resilience"}</span>
                  </div>
                  <div className="deck-kpi-score" style={{ color: "#a855f7" }}>
                    %{result.resilience_score ?? 95}
                  </div>
                  <div className="deck-kpi-bar-track">
                    <div className="deck-kpi-bar-fill" style={{ width: `${result.resilience_score ?? 95}%`, background: "#a855f7" }} />
                  </div>
                  <p className="deck-kpi-note">
                    {lang === "tr"
                      ? "TestSprite otonom flaky test direnci ve otomatik seçici iyileştirme."
                      : "TestSprite autonomous flakiness reduction and selector self-healing."}
                  </p>
                </div>
              </div>

              {result.performance_metrics && (
                <div className="deck-perf-banner">
                  <span className="perf-banner-icon">⚡</span>
                  <div>
                    <strong>{lang === "tr" ? "Virgosol Yük & Latency SLA Durumu: " : "Virgosol Load & Latency SLA Status: "}</strong>
                    <span className={`perf-pill ${result.performance_metrics.sla_status.toLowerCase()}`}>
                      {result.performance_metrics.sla_status}
                    </span>
                    {" "}&bull; P95 Gecikme: <strong>{result.performance_metrics.p95_latency_ms}ms</strong> &bull; Throughput: <strong>{result.performance_metrics.throughput_req_per_sec} req/s</strong> &bull; Başarı Oranı: <strong>%{result.performance_metrics.success_rate}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SLIDE 2: 2D Risk Heatmap Matrix */}
          {currentSlide === 2 && (
            <div className="deck-slide slide-heatmap">
              <div className="deck-slide-header">
                <span className="deck-slide-num">SLAYT 03</span>
                <h2 className="deck-slide-title">
                  🗺️ {lang === "tr" ? "Kurumsal Risk Isı Haritası (Olasılık vs. İş Etkisi)" : "Corporate Risk Heatmap (Likelihood vs. Impact)"}
                </h2>
                <p className="deck-slide-desc">
                  {lang === "tr"
                    ? "Tespit edilen açıkların sömürülme olasılığı ve şirkete getireceği regülasyon/finansal etki matrisi."
                    : "Vulnerabilities mapped across likelihood of exploitation and regulatory/financial impact."}
                </p>
              </div>

              <div className="deck-heatmap-wrapper">
                <div className="heatmap-y-label">{lang === "tr" ? "▲ ŞİRKET İŞ ETKİSİ (IMPACT)" : "▲ BUSINESS IMPACT"}</div>
                <div className="heatmap-matrix-grid">
                  {/* High Impact Row */}
                  <div className="heatmap-cell zone-medium">
                    <span className="cell-label">{lang === "tr" ? "Orta Risk" : "Medium Risk"}</span>
                    <span className="cell-count">{Math.round(mediumCount * 0.4)}</span>
                  </div>
                  <div className="heatmap-cell zone-high">
                    <span className="cell-label">{lang === "tr" ? "Yüksek Risk" : "High Risk"}</span>
                    <span className="cell-count">{highCount}</span>
                  </div>
                  <div className="heatmap-cell zone-critical">
                    <span className="cell-label">{lang === "tr" ? "Kritik Acil Risk" : "Critical Risk"}</span>
                    <span className="cell-count">{criticalCount}</span>
                    <span className="cell-hint">{lang === "tr" ? "Derhal Müdahale" : "Immediate Action"}</span>
                  </div>

                  {/* Medium Impact Row */}
                  <div className="heatmap-cell zone-low">
                    <span className="cell-label">{lang === "tr" ? "Düşük Risk" : "Low Risk"}</span>
                    <span className="cell-count">{lowCount}</span>
                  </div>
                  <div className="heatmap-cell zone-medium">
                    <span className="cell-label">{lang === "tr" ? "Orta Risk" : "Medium Risk"}</span>
                    <span className="cell-count">{Math.round(mediumCount * 0.6)}</span>
                  </div>
                  <div className="heatmap-cell zone-high">
                    <span className="cell-label">{lang === "tr" ? "Yüksek Risk" : "High Risk"}</span>
                    <span className="cell-count">0</span>
                  </div>

                  {/* Low Impact Row */}
                  <div className="heatmap-cell zone-low">
                    <span className="cell-label">{lang === "tr" ? "Bilgilendirme" : "Informational"}</span>
                    <span className="cell-count">0</span>
                  </div>
                  <div className="heatmap-cell zone-low">
                    <span className="cell-label">{lang === "tr" ? "Düşük Risk" : "Low Risk"}</span>
                    <span className="cell-count">0</span>
                  </div>
                  <div className="heatmap-cell zone-medium">
                    <span className="cell-label">{lang === "tr" ? "Orta Risk" : "Medium Risk"}</span>
                    <span className="cell-count">0</span>
                  </div>
                </div>
              </div>
              <div className="heatmap-x-label">{lang === "tr" ? "SÖMÜRÜLME OLASILIĞI (LIKELIHOOD) ▶" : "EXPLOIT LIKELIHOOD ▶"}</div>
            </div>
          )}

          {/* SLIDE 3: Departmental Ownership Matrix */}
          {currentSlide === 3 && (
            <div className="deck-slide slide-teams">
              <div className="deck-slide-header">
                <span className="deck-slide-num">SLAYT 04</span>
                <h2 className="deck-slide-title">
                  🏢 {lang === "tr" ? "Departman ve Ekip Triyaj Matrisi" : "Departmental Ownership & Triage Matrix"}
                </h2>
                <p className="deck-slide-desc">
                  {lang === "tr"
                    ? "Virgosol kurumsal triyaj standardı uyarınca bulguların ilgili ekiplere görev dağılımı."
                    : "Virgosol enterprise triage assignment: mapping issues directly to accountable engineering teams."}
                </p>
              </div>

              <div className="deck-teams-grid">
                {Object.entries(teamBreakdown).map(([teamName, stats]) => {
                  const hasCrit = stats.criticalHigh > 0;
                  return (
                    <div key={teamName} className={`deck-team-card ${hasCrit ? "has-critical" : ""}`}>
                      <div className="deck-team-header">
                        <span className="team-icon">
                          {teamName.includes("DevOps") && "🛡️"}
                          {teamName.includes("Yazılım") && "💻"}
                          {teamName.includes("QA") && "🧪"}
                          {teamName.includes("Hukuk") && "⚖️"}
                        </span>
                        <span className="team-name">{teamName}</span>
                      </div>
                      <div className="deck-team-stats">
                        <div className="team-stat-item">
                          <span className="team-stat-val">{stats.total}</span>
                          <span className="team-stat-lbl">{lang === "tr" ? "Toplam Bulgu" : "Total Issues"}</span>
                        </div>
                        <div className="team-stat-item">
                          <span className="team-stat-val text-red">{stats.criticalHigh}</span>
                          <span className="team-stat-lbl">{lang === "tr" ? "Kritik & Yüksek" : "Critical & High"}</span>
                        </div>
                      </div>
                      <div className="team-status-indicator">
                        {stats.total === 0 ? (
                          <span className="team-pill-clean">✓ {lang === "tr" ? "Aksiyon Beklemiyor" : "Zero Issues"}</span>
                        ) : hasCrit ? (
                          <span className="team-pill-urgent">⚠️ {lang === "tr" ? "Öncelikli Müdahale" : "Urgent Backlog"}</span>
                        ) : (
                          <span className="team-pill-normal">ℹ️ {lang === "tr" ? "Rutin İyileştirme" : "Routine Remediation"}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SLIDE 4: Top 5 Strategic Remediation Roadmap */}
          {currentSlide === 4 && (
            <div className="deck-slide slide-roadmap">
              <div className="deck-slide-header">
                <span className="deck-slide-num">SLAYT 05</span>
                <h2 className="deck-slide-title">
                  🎯 {lang === "tr" ? "Yönetici Eylem Planı (Top 5 Öncelikli Müdahale)" : "Strategic Remediation Roadmap (Top 5 Priorities)"}
                </h2>
                <p className="deck-slide-desc">
                  {lang === "tr"
                    ? "Kurumsal riski en hızlı düşürecek ilk 5 stratejik düzeltme adımı."
                    : "The 5 highest-ROI remediation priorities to rapidly lower corporate exposure."}
                </p>
              </div>

              <div className="deck-action-items-list">
                {topActionItems.map((f, idx) => (
                  <div key={f.id + idx} className="deck-action-row">
                    <span className="deck-action-rank">#{idx + 1}</span>
                    <div className="deck-action-body">
                      <div className="deck-action-top">
                        <span className={`finding-sev-badge ${f.severity}`}>{f.severity}</span>
                        <span className="deck-action-title">{f.title}</span>
                        {f.compliance_standard && (
                          <span className="deck-std-tag">⚖️ {f.compliance_standard}</span>
                        )}
                      </div>
                      <p className="deck-action-desc">{f.remediation}</p>
                    </div>
                    <div className="deck-action-team">
                      <span className="team-tag-pill">{f.team_assignment || "Yazılım Geliştirici"}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="deck-conclusion-box">
                <p>
                  <strong>{lang === "tr" ? "C-Level Tavsiyesi: " : "Executive Recommendation: "}</strong>
                  {lang === "tr"
                    ? "Öncelikli olarak yukarıda listelenen kritik aksiyonların sprint backlog'una alınması ve düzeltmelerin ardından WebGuard CI/CD hattı üzerinden otomatik regresyon denetiminin tekrarlanması önerilir."
                    : "Prioritize these top actions into the immediate sprint backlog, then trigger an automated regression re-scan via WebGuard CI/CD pipeline."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Slide Controller Bar */}
        <div className="deck-footer-bar">
          <div className="deck-footer-info">
            {lang === "tr" ? "İpucu: Slaytlar arasında geçiş yapmak için klavyedeki " : "Tip: Navigate using keyboard "}
            <kbd>&larr;</kbd> <kbd>&rarr;</kbd> {lang === "tr" ? "veya Boşluk tuşlarını kullanabilirsiniz." : "or Spacebar."}
          </div>

          <div className="deck-controls">
            <button
              type="button"
              className="deck-btn-prev"
              onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
              disabled={currentSlide === 0}
            >
              &larr; {lang === "tr" ? "Önceki Slayt" : "Previous"}
            </button>
            <button
              type="button"
              className="deck-btn-next"
              onClick={() => setCurrentSlide((prev) => Math.min(totalSlides - 1, prev + 1))}
              disabled={currentSlide === totalSlides - 1}
            >
              {lang === "tr" ? "Sonraki Slayt" : "Next"} &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
