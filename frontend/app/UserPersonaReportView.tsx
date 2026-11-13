"use client";

import React from "react";
import { PersonaAuditReport, UserPersona } from "@/types/scan";

interface UserPersonaReportViewProps {
  report?: PersonaAuditReport;
  lang?: "tr" | "en";
}

const PERSONA_DETAILS: Record<UserPersona, { icon: string; titleTr: string; titleEn: string; descTr: string; descEn: string }> = {
  SHOPPER: {
    icon: "🛒",
    titleTr: "E-Ticaret Alışverişçisi",
    titleEn: "E-Commerce Shopper",
    descTr: "Ürün arama, sepet butonları, fiyat şeffaflığı ve satın alma akışı denetimi.",
    descEn: "Product search, add-to-cart CTAs, pricing transparency and checkout funnel audit."
  },
  RAGE_TESTER: {
    icon: "⚡",
    titleTr: "Sabırsız / Hızlı Kullanıcı (Rage Tester)",
    titleEn: "Impatient / Rapid User (Rage Tester)",
    descTr: "Hızlı kaydırma, art arda çift tıklama (rage click) ve UI donma direnci analizi.",
    descEn: "Fast scrolling, double-click rage tests, and UI responsiveness benchmark."
  },
  ACCESSIBILITY: {
    icon: "👴",
    titleTr: "Erişilebilirlik & Yaşlı Kullanıcı",
    titleEn: "Accessibility & Senior User",
    descTr: "Klavye 'Tab' navigasyonu, görünür odak halkaları, kontrast ve ARIA etiketleri.",
    descEn: "Keyboard Tab navigation, focus rings, text readability, and ARIA labels."
  },
  POWER_EXPLORER: {
    icon: "🔍",
    titleTr: "Kapsamlı Kaşif",
    titleEn: "Power Explorer",
    descTr: "Derin hiyerarşik dropdown menüler, footer linkleri ve kurumsal alt sayfalar.",
    descEn: "Deep dropdown mega-menus, sitemap, footer links, and secondary page traversal."
  }
};

export default function UserPersonaReportView({ report, lang = "tr" }: UserPersonaReportViewProps) {
  if (!report) {
    return (
      <div className="persona-empty-box">
        <span className="persona-empty-icon">🎭</span>
        <h3>{lang === "tr" ? "Kullanıcı Kimliği Denetimi Bekleniyor" : "Awaiting User Persona Audit"}</h3>
        <p>
          {lang === "tr"
            ? "Bu taramada otonom kullanıcı kimliği simülasyonu henüz yürütülmedi veya tamamlanmadı."
            : "Autonomous user persona simulation has not been executed yet for this scan."}
        </p>
      </div>
    );
  }

  const pKey = report.persona || "SHOPPER";
  const details = PERSONA_DETAILS[pKey] || PERSONA_DETAILS.SHOPPER;
  const isTr = lang === "tr";

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return { bg: "rgba(16, 185, 129, 0.15)", border: "#10b981", text: "#34d399", label: isTr ? "Akıcı & Yüksek Memnuniyet" : "Smooth & High Satisfaction" };
    if (score >= 65) return { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", text: "#fbbf24", label: isTr ? "Orta Düzey Sürtünme" : "Moderate Friction" };
    return { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#f87171", label: isTr ? "Kritik Deneyim Engelleri" : "Critical UX Roadblocks" };
  };

  const scoreBadge = getScoreBadgeColor(report.satisfaction_score);

  return (
    <div className="persona-report-container">
      {/* ── 1. PERSONA HERO BANNER ── */}
      <div className="persona-hero-card">
        <div className="persona-hero-main">
          <div className="persona-avatar-circle">
            <span className="persona-avatar-emoji">{report.persona_icon || details.icon}</span>
          </div>
          <div className="persona-hero-text">
            <div className="persona-tag-row">
              <span className="persona-role-badge">
                🎭 {isTr ? "OTONOM KULLANICI KİMLİĞİ DENETİMİ" : "AUTONOMOUS USER PERSONA AUDIT"}
              </span>
              <span className="persona-mode-pill">
                {isTr ? details.titleTr : details.titleEn}
              </span>
            </div>
            <h2 className="persona-hero-title">
              {report.persona_title || (isTr ? details.titleTr : details.titleEn)}
            </h2>
            <p className="persona-hero-desc">
              {isTr ? details.descTr : details.descEn}
            </p>
          </div>
        </div>

        {/* Memnuniyet Skoru Kartı */}
        <div className="persona-score-card" style={{ background: scoreBadge.bg, borderColor: scoreBadge.border }}>
          <div className="persona-score-num" style={{ color: scoreBadge.text }}>
            %{report.satisfaction_score}
          </div>
          <div className="persona-score-lbl">
            {isTr ? "Persona Memnuniyet Skoru" : "Persona Satisfaction Score"}
          </div>
          <div className="persona-score-tag" style={{ color: scoreBadge.text }}>
            {scoreBadge.label}
          </div>
        </div>
      </div>

      {/* ── 2. GÖZLEMLER & SÜRTÜNME NOKTALARI (METRİK KARTLARI) ── */}
      <div className="persona-dual-grid">
        {/* Olumlu Gözlemler */}
        <div className="persona-card card-positive">
          <div className="persona-card-header">
            <span className="persona-card-icon">✨</span>
            <span className="persona-card-title">
              {isTr ? "Kullanıcının Başarıyla Tamamladığı Adımlar" : "Smooth User Actions Completed"}
            </span>
            <span className="persona-pill count-pos">{report.key_observations.length}</span>
          </div>
          <div className="persona-card-body">
            {report.key_observations.length === 0 ? (
              <p className="persona-empty-text">{isTr ? "Kritik olumlu gözlem kaydedilmedi." : "No key observations recorded."}</p>
            ) : (
              <ul className="persona-points-list">
                {report.key_observations.map((obs, idx) => (
                  <li key={idx} className="persona-point-item item-pos">
                    <span className="point-bullet">✓</span>
                    <span className="point-text">{obs}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Karşılaşılan Sürtünme Noktaları / Engeller */}
        <div className="persona-card card-negative">
          <div className="persona-card-header">
            <span className="persona-card-icon">⚠️</span>
            <span className="persona-card-title">
              {isTr ? "Tespit Edilen Deneyim Engelleri & Sürtünmeler" : "Identified Friction Points & Obstacles"}
            </span>
            <span className="persona-pill count-neg">{report.friction_points.length}</span>
          </div>
          <div className="persona-card-body">
            {report.friction_points.length === 0 ? (
              <div className="persona-all-good">
                <span>🎉</span>
                <span>{isTr ? "Bu kullanıcı profili için hiçbir kritik engel tespit edilmedi!" : "No friction points detected for this persona!"}</span>
              </div>
            ) : (
              <ul className="persona-points-list">
                {report.friction_points.map((fr, idx) => (
                  <li key={idx} className="persona-point-item item-neg">
                    <span className="point-bullet">✕</span>
                    <span className="point-text">{fr}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. ZAMAN ÇİZELGESİ VE CANLI ETKİLEŞİM GÜNLÜĞÜ ── */}
      <div className="persona-timeline-card">
        <div className="timeline-header">
          <div className="timeline-header-left">
            <span className="timeline-header-icon">⏱️</span>
            <span className="timeline-title">
              {isTr ? "Otonom Persona Eylem Kronolojisi" : "Autonomous Persona Interaction Timeline"}
            </span>
          </div>
          <span className="timeline-count-badge">
            {report.events.length} {isTr ? "eylem simüle edildi" : "actions simulated"}
          </span>
        </div>

        <div className="timeline-body">
          {report.events.length === 0 ? (
            <p className="timeline-empty">{isTr ? "Kayıtlı eylem verisi bulunamadı." : "No interaction events recorded."}</p>
          ) : (
            report.events.map((ev, index) => (
              <div key={index} className="timeline-row">
                <div className="timeline-col-time">{ev.timestamp}</div>
                <div className={`timeline-col-action badge-${ev.action_type.toLowerCase()}`}>
                  {ev.action_type}
                </div>
                <div className="timeline-col-desc">
                  <div className="timeline-desc-text">{ev.description}</div>
                  <div className="timeline-target-chip">
                    <code>{ev.target}</code>
                  </div>
                </div>
                <div className="timeline-col-outcome">
                  <span className={`outcome-pill outcome-${ev.outcome.toLowerCase()}`}>
                    {ev.outcome === "SUCCESS" ? "✓ Başarılı" : "⚠️ Sürtünme"}
                  </span>
                  {ev.latency_ms !== undefined && (
                    <span className="timeline-latency">{ev.latency_ms}ms</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
