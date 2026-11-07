"use client";

import type { Finding, RCACategory } from "@/types/scan";
import { type Language } from "@/lib/i18n";

interface RcaTriageBarProps {
  findings: Finding[];
  selectedRca: "ALL" | RCACategory;
  onSelectRca: (rca: "ALL" | RCACategory) => void;
  lang?: Language;
}

const RCA_CONFIG = [
  {
    key: "REAL_BUG" as RCACategory,
    labelTr: "Gerçek Kod Hatası",
    labelEn: "Real Bug",
    teamTr: "👨‍💻 Yazılım Ekibi (Dev)",
    teamEn: "👨‍💻 Dev Team",
    color: "#ef4444",
    bgClass: "bar-real-bug",
    icon: "🔴",
  },
  {
    key: "ENV_ISSUE" as RCACategory,
    labelTr: "Altyapı / Sunucu",
    labelEn: "Environment Issue",
    teamTr: "🛠️ DevOps & Altyapı",
    teamEn: "🛠️ DevOps & Infra",
    color: "#3b82f6",
    bgClass: "bar-env-issue",
    icon: "🔵",
  },
  {
    key: "TEST_FRAGILITY" as RCACategory,
    labelTr: "Test Kırılganlığı",
    labelEn: "Test Fragility",
    teamTr: "🧪 QA & Otomasyon",
    teamEn: "🧪 QA Automation",
    color: "#f59e0b",
    bgClass: "bar-test-fragility",
    icon: "🟡",
  },
  {
    key: "EXPECTED_BEHAVIOR" as RCACategory,
    labelTr: "Beklenen / Bilgi",
    labelEn: "Expected / Info",
    teamTr: "⚪ Ürün & Analist",
    teamEn: "⚪ Product Analyst",
    color: "#94a3b8",
    bgClass: "bar-expected-behavior",
    icon: "⚪",
  },
];

export default function RcaTriageBar({
  findings,
  selectedRca,
  onSelectRca,
  lang = "tr",
}: RcaTriageBarProps) {
  const total = findings.length;
  if (total === 0) return null;

  // Calculate counts per category
  const counts: Record<string, number> = {
    REAL_BUG: 0,
    ENV_ISSUE: 0,
    TEST_FRAGILITY: 0,
    EXPECTED_BEHAVIOR: 0,
  };

  findings.forEach((f) => {
    const cat = f.rca_category || "REAL_BUG";
    counts[cat] = (counts[cat] || 0) + 1;
  });

  return (
    <div className="rca-triage-container">
      {/* Header Row */}
      <div className="rca-triage-header">
        <div className="rca-triage-title-wrap">
          <span className="rca-icon">🔬</span>
          <span className="rca-title">
            {lang === "tr"
              ? "TestSprite 4'lü RCA Dağılımı & Virgosol Ekip Triyajı"
              : "TestSprite 4-Tier RCA Breakdown & Team Triage"}
          </span>
          <span className="rca-total-badge">{total} {lang === "tr" ? "Bulgu Sınıflandırıldı" : "Issues Triage-Tagged"}</span>
        </div>
        {selectedRca !== "ALL" && (
          <button
            type="button"
            className="rca-reset-btn"
            onClick={() => onSelectRca("ALL")}
          >
            ✕ {lang === "tr" ? "Filtreyi Temizle" : "Clear Filter"}
          </button>
        )}
      </div>

      {/* Segmented Progress Bar */}
      <div className="rca-progress-track">
        {RCA_CONFIG.map((cfg) => {
          const count = counts[cfg.key] || 0;
          const pct = Math.max(0, Math.round((count / total) * 100));
          if (count === 0) return null;
          const isSelected = selectedRca === cfg.key;

          return (
            <div
              key={cfg.key}
              className={`rca-progress-segment ${cfg.bgClass} ${isSelected ? "selected" : ""}`}
              style={{ width: `${pct}%`, backgroundColor: cfg.color }}
              onClick={() => onSelectRca(selectedRca === cfg.key ? "ALL" : cfg.key)}
              title={`${lang === "tr" ? cfg.labelTr : cfg.labelEn}: ${count} (${pct}%) — Tıkla ve Filtrele`}
            />
          );
        })}
      </div>

      {/* Interactive Team Triage Cards */}
      <div className="rca-team-cards-grid">
        {RCA_CONFIG.map((cfg) => {
          const count = counts[cfg.key] || 0;
          const pct = Math.round((count / total) * 100);
          const isSelected = selectedRca === cfg.key;
          const label = lang === "tr" ? cfg.labelTr : cfg.labelEn;
          const team = lang === "tr" ? cfg.teamTr : cfg.teamEn;

          return (
            <button
              key={cfg.key}
              type="button"
              className={`rca-team-card ${isSelected ? "active" : ""}`}
              style={{
                borderColor: isSelected ? cfg.color : undefined,
                boxShadow: isSelected ? `0 0 12px ${cfg.color}40` : undefined,
              }}
              onClick={() => onSelectRca(selectedRca === cfg.key ? "ALL" : cfg.key)}
            >
              <div className="card-top">
                <span className="rca-badge-pill" style={{ color: cfg.color }}>
                  {cfg.icon} {label}
                </span>
                <span className="rca-count" style={{ color: cfg.color }}>
                  {count}
                </span>
              </div>
              <div className="card-bottom">
                <span className="rca-team-label">{team}</span>
                <span className="rca-pct">%{pct}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

