"use client";

import React, { useState } from "react";
import type {
  EthicalSecurityReport,
  OpenDoorProbe,
  WAFCanaryProbe,
  OpenDoorStatus,
} from "@/types/scan";

interface EthicalSecurityReportViewProps {
  report?: EthicalSecurityReport | null;
  lang?: "tr" | "en";
}

export default function EthicalSecurityReportView({
  report,
  lang = "tr",
}: EthicalSecurityReportViewProps) {
  const isTr = lang === "tr";
  const [openDoorFilter, setOpenDoorFilter] = useState<"ALL" | "EXPOSED" | "SECURE">("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  if (!report) {
    return (
      <div className="ethical-empty-box">
        <span className="ethical-empty-icon">🛡️</span>
        <h3>{isTr ? "Etik Siber Güvenlik Raporu Bekleniyor" : "Awaiting Ethical Cyber Security Report"}</h3>
        <p>
          {isTr
            ? "Bu taramada beyaz şapkalı siber dayanıklılık ve saldırı yüzeyi denetimi henüz yürütülmedi veya tamamlanmadı."
            : "White-hat cyber resilience and attack surface audit has not been executed yet for this target."}
        </p>
      </div>
    );
  }

  // Tier configuration
  const getTierInfo = (tier: string, score: number) => {
    if (score >= 90 || tier === "FORTRESS") {
      return {
        badge: isTr ? "🏰 SİBER KALE" : "🏰 CYBER FORTRESS",
        colorClass: "tier-fortress",
        subtext: isTr
          ? "WAF aktif, hız sınırı devrede ve kritik açık kapılar kapalı."
          : "WAF active, rate limiting enforced, attack surface sealed.",
      };
    }
    if (score >= 75 || tier === "RESILIENT") {
      return {
        badge: isTr ? "🛡️ DİRENÇLİ" : "🛡️ RESILIENT",
        colorClass: "tier-resilient",
        subtext: isTr
          ? "Temel kalkanlar devrede; bazı mikro-servis veya hız sınırı iyileştirmeleri gerekir."
          : "Perimeter shields up; minor rate-limiting or header tuning advised.",
      };
    }
    if (score >= 50 || tier === "VULNERABLE") {
      return {
        badge: isTr ? "⚠️ SAVUNMASIZ" : "⚠️ VULNERABLE",
        colorClass: "tier-vulnerable",
        subtext: isTr
          ? "WAF veya Rate-Limiting eksik; saldırgan botların suistimaline açık yüzeyler mevcut."
          : "WAF or Rate-Limiting missing; exposed to automated brute-force.",
      };
    }
    return {
      badge: isTr ? "🚨 KRİTİK RİSKLİ" : "🚨 COMPROMISED",
      colorClass: "tier-compromised",
      subtext: isTr
        ? "Kritik yapılandırma veya veritabanı yedeği sızıntısı tespit edildi!"
        : "Critical config or database leak verified on public attack surface!",
    };
  };

  const tierInfo = getTierInfo(report.resilience_tier, report.cyber_resilience_score);

  // Filtered open doors
  const filteredOpenDoors = (report.open_doors || []).filter((p: OpenDoorProbe) => {
    const matchesSearch =
      p.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.target_type.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (openDoorFilter === "EXPOSED") return p.status === "EXPOSED";
    if (openDoorFilter === "SECURE") return p.status === "SECURE" || p.status === "FILTERED";
    return true;
  });

  return (
    <div className="ethical-report-container">
      {/* ── 1. WHITE-HAT HERO BANNER ── */}
      <div className="ethical-hero-card">
        <div className="ethical-hero-main">
          <div className="ethical-shield-visual">
            <div className={`ethical-shield-outer ${tierInfo.colorClass}`}>
              <span className="ethical-shield-icon">🛡️</span>
            </div>
            <div className="ethical-score-bubble">
              <span className="score-val">{report.cyber_resilience_score}</span>
              <span className="score-label">/ 100</span>
            </div>
          </div>

          <div className="ethical-hero-info">
            <div className="ethical-hero-tag-row">
              <span className={`ethical-tier-pill ${tierInfo.colorClass}`}>
                {tierInfo.badge}
              </span>
              <span className="ethical-method-pill">
                🎯 {isTr ? "ZARARSIZ BEYAZ ŞAPKALI DENETİM" : "NON-DESTRUCTIVE WHITE-HAT"}
              </span>
              <span className="ethical-target-pill">
                🌐 {report.target_url}
              </span>
            </div>

            <h2 className="ethical-hero-title">
              {isTr ? "Siber Dayanıklılık & Güvenlik Kalkanı Denetimi" : "Cyber Resilience & Security Shield Audit"}
            </h2>
            <p className="ethical-hero-desc">
              {report.executive_verdict || tierInfo.subtext}
            </p>

            <div className="ethical-meta-strip">
              <span>⏱️ {new Date(report.scan_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span>•</span>
              <span>🔍 {report.open_doors_probed} {isTr ? "Kritik Yol Tarandı" : "Paths Probed"}</span>
              <span>•</span>
              <span>⚡ {report.burst_requests_sent} {isTr ? "Mikro-İstek Gönderildi" : "Micro-bursts Fired"}</span>
            </div>
          </div>
        </div>

        {/* ── 3 PILLARS SUMMARY METRIC CARDS ── */}
        <div className="ethical-pillars-grid">
          {/* Pillar 1: WAF */}
          <div className="pillar-metric-card">
            <div className="pillar-header">
              <span className="pillar-icon">🏰</span>
              <div className="pillar-title-box">
                <h4>{isTr ? "WAF Çevre Kalkanı" : "WAF Perimeter Defense"}</h4>
                <p className="pillar-sub">
                  {report.waf_detected
                    ? (report.waf_vendor ? `Aktif (${report.waf_vendor})` : (isTr ? "WAF Algılandı" : "WAF Detected"))
                    : (isTr ? "WAF İmzası Yok" : "No WAF Fingerprint")}
                </p>
              </div>
            </div>
            <div className="pillar-bar-wrap">
              <div
                className="pillar-bar-fill fill-waf"
                style={{ width: `${Math.min(100, Math.max(10, report.waf_filtering_score))}%` }}
              />
            </div>
            <div className="pillar-footer">
              <span className="pillar-score-text">
                %{report.waf_filtering_score} {isTr ? "Filtreleme Başarısı" : "Filtering Rate"}
              </span>
              <span className={`pillar-status-chip ${report.waf_detected ? "chip-ok" : "chip-warn"}`}>
                {report.waf_detected ? (isTr ? "Korumalı" : "Protected") : (isTr ? "Savunmasız" : "Unprotected")}
              </span>
            </div>
          </div>

          {/* Pillar 2: Rate Limit */}
          <div className="pillar-metric-card">
            <div className="pillar-header">
              <span className="pillar-icon">⚡</span>
              <div className="pillar-title-box">
                <h4>{isTr ? "Hız Sınırı & DDoS Toleransı" : "Rate-Limit & Burst Resilience"}</h4>
                <p className="pillar-sub">
                  {report.burst_429_received
                    ? (isTr ? "HTTP 429 Aşırı Yük Koruması Aktif" : "HTTP 429 Overload Protection Active")
                    : (isTr ? "Mikro-Burst Kısıtlanmadı" : "Burst Requests Not Throttled")}
                </p>
              </div>
            </div>
            <div className="pillar-bar-wrap">
              <div
                className="pillar-bar-fill fill-burst"
                style={{ width: `${Math.min(100, Math.max(10, report.burst_ddos_tolerance_score))}%` }}
              />
            </div>
            <div className="pillar-footer">
              <span className="pillar-score-text">
                %{report.burst_ddos_tolerance_score} {isTr ? "Direnç Skoru" : "Resilience Score"}
              </span>
              <span className={`pillar-status-chip ${report.burst_429_received ? "chip-ok" : "chip-info"}`}>
                {report.burst_429_received ? "429 Too Many Req" : (isTr ? "Geçiş İzni" : "Allowed")}
              </span>
            </div>
          </div>

          {/* Pillar 3: Open Doors */}
          <div className="pillar-metric-card">
            <div className="pillar-header">
              <span className="pillar-icon">🚪</span>
              <div className="pillar-title-box">
                <h4>{isTr ? "Saldırı Yüzeyi / Açık Kapılar" : "Attack Surface Exposure"}</h4>
                <p className="pillar-sub">
                  {report.open_doors_exposed_count > 0
                    ? (isTr ? `${report.open_doors_exposed_count} Kritik Açık Kapı Bulundu!` : `${report.open_doors_exposed_count} Sensitive Endpoints Leaking!`)
                    : (isTr ? "Tüm Hassas Yollar Mühürlü" : "All Sensitive Paths Sealed")}
                </p>
              </div>
            </div>
            <div className="pillar-bar-wrap">
              <div
                className={`pillar-bar-fill ${report.open_doors_exposed_count === 0 ? "fill-sealed" : "fill-danger"}`}
                style={{
                  width: `${report.open_doors_exposed_count === 0 ? 100 : Math.max(15, 100 - report.open_doors_exposed_count * 30)}%`,
                }}
              />
            </div>
            <div className="pillar-footer">
              <span className="pillar-score-text">
                {report.open_doors_probed - report.open_doors_exposed_count} / {report.open_doors_probed} {isTr ? "Güvenli" : "Secure"}
              </span>
              <span className={`pillar-status-chip ${report.open_doors_exposed_count === 0 ? "chip-ok" : "chip-danger"}`}>
                {report.open_doors_exposed_count === 0 ? (isTr ? "Mühürlü (0 Sızıntı)" : "Sealed") : (isTr ? "Açık Var!" : "Exposed!")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. STRENGTHS & VULNERABILITIES DUAL PANEL ── */}
      <div className="ethical-findings-grid">
        {/* Güçlü Savunmalar */}
        <div className="ethical-finding-card card-strengths">
          <div className="card-top">
            <span className="card-badge-icon">✅</span>
            <h3>{isTr ? "Doğrulanmış Güçlü Savunmalar" : "Verified Cyber Defenses"}</h3>
          </div>
          <ul className="strength-list">
            {(report.key_strengths || []).map((strength: string, idx: number) => (
              <li key={idx} className="strength-item">
                <span className="check-bullet">🛡️</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Kritik Riskler ve Açıklar */}
        <div className="ethical-finding-card card-vulnerabilities">
          <div className="card-top">
            <span className="card-badge-icon">⚠️</span>
            <h3>{isTr ? "Gözlemlenen Güvenlik Boşlukları" : "Observed Security Gaps"}</h3>
          </div>
          {report.critical_vulnerabilities && report.critical_vulnerabilities.length > 0 ? (
            <ul className="vuln-list">
              {report.critical_vulnerabilities.map((vuln: string, idx: number) => (
                <li key={idx} className="vuln-item">
                  <span className="warn-bullet">🚨</span>
                  <span>{vuln}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="no-vuln-state">
              <span className="no-vuln-icon">🎉</span>
              <p>
                {isTr
                  ? "Tebrikler! Dışa açık kritik sızıntı veya kontrolsüz çöküş saptanmadı."
                  : "Great! No critical public leaks or unhandled 500 crashes were observed."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. ATTACK SURFACE / OPEN DOORS MATRIX TABLE ── */}
      <div className="ethical-section-card">
        <div className="section-header-row">
          <div>
            <h3 className="section-title">
              🚪 {isTr ? "Saldırı Yüzeyi & Açık Kapı Matrisi (Zero False-Positive)" : "Attack Surface & Open Door Matrix (Zero False-Positive)"}
            </h3>
            <p className="section-subtitle">
              {isTr
                ? "Git depoları, ortam değişkenleri (.env), veritabanı yedekleri ve gizli anahtarlar akıllı içerik doğrulayıcılarıyla (magic bytes) denetlenir."
                : "Git repos, env files, database dumps and keys verified with magic byte payload validation."}
            </p>
          </div>

          <div className="table-controls">
            <input
              type="text"
              placeholder={isTr ? "Yol veya hedef türü ara..." : "Filter path or type..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="table-search-input"
            />
            <div className="filter-pill-group">
              <button
                type="button"
                className={`filter-btn ${openDoorFilter === "ALL" ? "active" : ""}`}
                onClick={() => setOpenDoorFilter("ALL")}
              >
                {isTr ? "Tümü" : "All"} ({report.open_doors?.length || 0})
              </button>
              <button
                type="button"
                className={`filter-btn btn-danger ${openDoorFilter === "EXPOSED" ? "active" : ""}`}
                onClick={() => setOpenDoorFilter("EXPOSED")}
              >
                {isTr ? "Açıklar" : "Exposed"} ({report.open_doors_exposed_count})
              </button>
              <button
                type="button"
                className={`filter-btn btn-safe ${openDoorFilter === "SECURE" ? "active" : ""}`}
                onClick={() => setOpenDoorFilter("SECURE")}
              >
                {isTr ? "Korumalı" : "Secure"} ({(report.open_doors?.length || 0) - report.open_doors_exposed_count})
              </button>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="ethical-table">
            <thead>
              <tr>
                <th>{isTr ? "Hedef Dosya / Dizin" : "Target Path / Asset"}</th>
                <th>{isTr ? "Varlık Türü" : "Asset Type"}</th>
                <th>{isTr ? "HTTP Kodu" : "HTTP Status"}</th>
                <th>{isTr ? "Doğrulama Sonucu" : "Verdict"}</th>
                <th>{isTr ? "Boyut / Gecikme" : "Size / Latency"}</th>
                <th>{isTr ? "Risk Seviyesi" : "Risk Level"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpenDoors.map((probe: OpenDoorProbe, index: number) => {
                const isExposed = probe.status === "EXPOSED";
                return (
                  <tr key={index} className={isExposed ? "row-danger" : "row-normal"}>
                    <td className="code-font font-bold">
                      <code>{probe.path}</code>
                    </td>
                    <td>
                      <span className="type-badge">{probe.target_type}</span>
                    </td>
                    <td>
                      <span
                        className={`status-code-badge ${
                          probe.http_status === 200
                            ? (isExposed ? "code-200-danger" : "code-200-ok")
                            : probe.http_status === 403
                            ? "code-403"
                            : "code-404"
                        }`}
                      >
                        {probe.http_status}
                      </span>
                    </td>
                    <td>
                      {probe.status === "EXPOSED" ? (
                        <span className="verdict-chip chip-exposed">
                          🚨 {isTr ? "KRİTİK SIZINTI" : "CRITICAL LEAK"}
                        </span>
                      ) : probe.status === "FILTERED" ? (
                        <span className="verdict-chip chip-filtered">
                          🛡️ {isTr ? "WAF Engelledi" : "WAF Filtered"}
                        </span>
                      ) : (
                        <span className="verdict-chip chip-secure">
                          🔒 {isTr ? "Korumalı (Erişilemez)" : "Protected (404/403)"}
                        </span>
                      )}
                    </td>
                    <td className="metric-cell">
                      <span>{probe.response_size_bytes > 0 ? `${(probe.response_size_bytes / 1024).toFixed(1)} KB` : "0 B"}</span>
                      <span className="latency-sub">({probe.latency_ms.toFixed(0)}ms)</span>
                    </td>
                    <td>
                      <span className={`risk-badge risk-${probe.risk_level.toLowerCase()}`}>
                        {probe.risk_level}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. SYNTHETIC CANARY WAF PROBES TABLE ── */}
      <div className="ethical-section-card">
        <div className="section-header-row">
          <div>
            <h3 className="section-title">
              🧪 {isTr ? "Sentetik Kanarya Enjeksiyonları (Zararsız WAF / DAST Probları)" : "Synthetic Canary Injections (Harmless WAF / DAST Probes)"}
            </h3>
            <p className="section-subtitle">
              {isTr
                ? "Sisteme zarar vermeyen sentetik kanarya payload'ları sunucunun hata yönetimi ve WAF engelleme refleksini test eder."
                : "Safe synthetic canary payloads to evaluate error handling resilience without service degradation."}
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="ethical-table">
            <thead>
              <tr>
                <th>{isTr ? "Saldırı Vektörü" : "Attack Vector"}</th>
                <th>{isTr ? "Sentetik Test Yükü (Canary Payload)" : "Synthetic Canary Payload"}</th>
                <th>{isTr ? "HTTP Kodu" : "HTTP Status"}</th>
                <th>{isTr ? "WAF Engelleme Refleksi" : "WAF Enforcement"}</th>
                <th>{isTr ? "Sunucu Yanıt İmzası" : "Server Signature"}</th>
              </tr>
            </thead>
            <tbody>
              {(report.canary_probes || []).map((canary: WAFCanaryProbe, index: number) => (
                <tr key={index}>
                  <td className="font-bold">
                    <span className="vector-pill">{canary.vector}</span>
                  </td>
                  <td className="code-font payload-col">
                    <code>{canary.payload}</code>
                  </td>
                  <td>
                    <span
                      className={`status-code-badge ${
                        canary.http_status === 403 || canary.http_status === 400
                          ? "code-403"
                          : canary.http_status >= 500
                          ? "code-500"
                          : "code-200-ok"
                      }`}
                    >
                      {canary.http_status}
                    </span>
                  </td>
                  <td>
                    {canary.blocked ? (
                      <span className="verdict-chip chip-secure">
                        🛡️ {isTr ? "WAF Kalkanı Bloke Etti" : "Blocked by WAF"}
                      </span>
                    ) : (
                      <span className="verdict-chip chip-clean">
                        🧼 {isTr ? "Temizce Karşılandı (Çökmedi)" : "Handled Cleanly (No 500)"}
                      </span>
                    )}
                  </td>
                  <td className="sig-col">
                    <span className="sig-text">{canary.response_signature}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. WHITE-HAT REMEDIATION DIRECTIVES ── */}
      <div className="ethical-remediation-card">
        <div className="remediation-header">
          <span className="rem-icon">🛠️</span>
          <div>
            <h3>{isTr ? "Beyaz Şapkalı Güvenlik ve Sıkılaştırma (Hardening) Yönergesi" : "White-Hat Hardening & Security Directives"}</h3>
            <p>
              {isTr
                ? "Siber saldırganların otomatik keşif araçlarına karşı sisteminizi güçlendirmek için önerilen acil yapılandırma kuralları:"
                : "Immediate server hardening directives to seal the attack surface against automated recon botnets:"}
            </p>
          </div>
        </div>

        <div className="code-blocks-row">
          <div className="code-block-item">
            <span className="code-block-title">Nginx: Gizli Dosyaları & Yedekleri Blokla</span>
            <pre className="code-box">
{`# 1. Gizli (.git, .env vb.) ve hassas yedek dosyalarını engelle
location ~ /\\.(?!well-known) {
    deny all;
    return 404;
}

location ~* \\.(sql|bak|backup|tar|gz|zip|conf|ini|log)$ {
    deny all;
    return 404;
}`}
            </pre>
          </div>

          <div className="code-block-item">
            <span className="code-block-title">Nginx: Burst DDoS & Hız Sınırı (Rate Limit)</span>
            <pre className="code-box">
{`# 2. IP başına hız sınırı tanımla
limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;

server {
    location / {
        limit_req zone=one burst=20 nodelay;
        limit_req_status 429;
    }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
