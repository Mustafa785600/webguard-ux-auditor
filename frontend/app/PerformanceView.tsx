"use client";

import { useState } from "react";
import type { PerformanceMetrics, Finding } from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface PerformanceViewProps {
  metrics?: PerformanceMetrics;
  findings: Finding[];
  lang: Language;
}

export default function PerformanceView({
  metrics,
  findings,
  lang,
}: PerformanceViewProps) {
  const [copied, setCopied] = useState(false);

  if (!metrics) {
    return (
      <div className="perf-empty-card">
        <div className="perf-empty-icon">⚡</div>
        <h3>{lang === "tr" ? "Yük & Performans Verisi Bulunamadı" : "No Performance Data Available"}</h3>
        <p>
          {lang === "tr"
            ? "Bu tarama için yük testi henüz çalıştırılmadı veya hedef sunucuya erişilemedi."
            : "Performance benchmark was not executed for this scan or target was unreachable."}
        </p>
      </div>
    );
  }

  const m = metrics;

  const perfFindings = findings.filter(
    (f) =>
      f.id.startsWith("PERF_") ||
      (f.compliance_standard && f.compliance_standard.includes("BDDK"))
  );

  const slaColor =
    m.sla_status === "EXCELLENT"
      ? "#10b981"
      : m.sla_status === "ACCEPTABLE"
      ? "#f59e0b"
      : "#ef4444";

  const slaLabel =
    m.sla_status === "EXCELLENT"
      ? lang === "tr"
        ? "Mükemmel (SLA Karşılandı: P95 < 500ms)"
        : "Excellent (SLA Met: P95 < 500ms)"
      : m.sla_status === "ACCEPTABLE"
      ? lang === "tr"
        ? "Kabul Edilebilir (500ms - 1500ms)"
        : "Acceptable (500ms - 1500ms)"
      : lang === "tr"
      ? "Kritik SLA İhlali (P95 > 1500ms)"
      : "Critical SLA Breach (P95 > 1500ms)";

  const maxSample = Math.max(...(m.samples.length ? m.samples : [100]), 100);

  function handleCopySlaSummary() {
    const text = `
🏢 VIRGOSOL & WEGUARD PERFORMANCE & SLA AUDIT REPORT
Target: ${m.total_requests} concurrent requests (Concurrency: ${m.concurrency})
------------------------------------------------------------
SLA Status: ${m.sla_status} (${slaLabel})
Success Rate: %${m.success_rate}
Throughput: ${m.throughput_req_per_sec} req/sec
Avg Latency: ${m.avg_latency_ms} ms
TTFB (Time to First Byte): ${m.ttfb_ms ?? "N/A"} ms

Percentiles:
• P50 (Median): ${m.p50_latency_ms} ms
• P90: ${m.p90_latency_ms} ms
• P95 (SLA Standard): ${m.p95_latency_ms} ms
• P99: ${m.p99_latency_ms} ms
• Max Latency: ${m.max_latency_ms} ms

Status Codes:
${Object.entries(m.status_codes)
  .map(([k, v]) => `• HTTP ${k}: ${v} response(s)`)
  .join("\n")}

Active SLA / BDDK Findings: ${perfFindings.length} issue(s)
`.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="perf-view-container">
      {/* Top Banner */}
      <div className="perf-hero-card">
        <div className="perf-hero-header">
          <div>
            <div className="perf-badge">
              ⚡ {lang === "tr" ? "Virgosol Tarzı Yük & Latency SLA Motoru" : "Enterprise Load & Latency SLA Engine"}
            </div>
            <h2 className="perf-title">
              {lang === "tr"
                ? "Kurumsal Yanıt Süresi & Yük Dayanıklılık Analizi"
                : "Enterprise Response Time & Stress Benchmark"}
            </h2>
            <p className="perf-subtitle">
              {lang === "tr"
                ? "Eş zamanlı istekler altında P50/P90/P95 persantil gecikmeleri, Throughput hızı ve BDDK SLA uyumluluğu."
                : "P50/P90/P95 latency percentiles, throughput rate, and BDDK financial SLA compliance."}
            </p>
          </div>
          <button
            type="button"
            className="perf-copy-btn"
            onClick={handleCopySlaSummary}
            title="SLA Özetini Kopyala"
          >
            {copied ? (lang === "tr" ? "✓ Kopyalandı!" : "✓ Copied!") : (lang === "tr" ? "📋 SLA Raporunu Kopyala" : "📋 Copy SLA Report")}
          </button>
        </div>

        {/* SLA Status Pill Banner */}
        <div
          className="perf-sla-banner"
          style={{ borderColor: slaColor, background: `${slaColor}15` }}
        >
          <div className="perf-sla-dot" style={{ backgroundColor: slaColor }} />
          <div>
            <div className="perf-sla-heading" style={{ color: slaColor }}>
              {lang === "tr" ? "Kurumsal Fintek SLA Durumu:" : "Enterprise SLA Status:"} {slaLabel}
            </div>
            <div className="perf-sla-desc">
              {m.sla_status === "EXCELLENT"
                ? lang === "tr"
                  ? "Sistem BDDK ve ödeme sistemleri yüksek hız gereksinimlerini (<500ms) başarıyla karşılıyor."
                  : "System fully satisfies BDDK and high-throughput payment SLA targets (<500ms)."
                : m.sla_status === "ACCEPTABLE"
                ? lang === "tr"
                  ? "Sistem kabul edilebilir sürelerde yanıt veriyor ancak yoğun trafik dalgalanmalarında önbellekleme önerilir."
                  : "System responds within reasonable thresholds; reverse-proxy caching is advised for burst traffic."
                : lang === "tr"
                ? "P95 yanıt süresi 1500ms üzerinde veya istek kayıpları tespit edildi. Acil altyapı optimizasyonu gereklidir."
                : "P95 latency exceeds 1500ms threshold or dropped requests detected. Infrastructure optimization required."}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="perf-kpi-grid">
        <div className="perf-kpi-card highlight">
          <div className="perf-kpi-label">P95 (SLA Benchmark)</div>
          <div className="perf-kpi-value" style={{ color: slaColor }}>
            {m.p95_latency_ms} <span className="perf-kpi-unit">ms</span>
          </div>
          <div className="perf-kpi-sub">
            {lang === "tr" ? "İsteklerin %95'i bu sürenin altında tamamlandı" : "95% of all requests completed within this"}
          </div>
        </div>

        <div className="perf-kpi-card">
          <div className="perf-kpi-label">P50 (Medyan Gecikme)</div>
          <div className="perf-kpi-value">
            {m.p50_latency_ms} <span className="perf-kpi-unit">ms</span>
          </div>
          <div className="perf-kpi-sub">
            {lang === "tr" ? "Tipik kullanıcı deneyimi süresi" : "Typical median user experience"}
          </div>
        </div>

        <div className="perf-kpi-card">
          <div className="perf-kpi-label">Throughput (Verim)</div>
          <div className="perf-kpi-value text-indigo">
            {m.throughput_req_per_sec} <span className="perf-kpi-unit">req/s</span>
          </div>
          <div className="perf-kpi-sub">
            {lang === "tr" ? "Saniyede işlenen ortalama istek" : "Average requests served per second"}
          </div>
        </div>

        <div className="perf-kpi-card">
          <div className="perf-kpi-label">{lang === "tr" ? "Başarı Oranı" : "Success Rate"}</div>
          <div className="perf-kpi-value text-emerald">
            %{m.success_rate}
          </div>
          <div className="perf-kpi-sub">
            {m.total_requests} {lang === "tr" ? "istekten başarıyla dönenler" : "probes completed successfully"}
          </div>
        </div>

        <div className="perf-kpi-card">
          <div className="perf-kpi-label">TTFB (İlk Bayt Süresi)</div>
          <div className="perf-kpi-value">
            {m.ttfb_ms ?? Math.round(m.avg_latency_ms * 0.65)} <span className="perf-kpi-unit">ms</span>
          </div>
          <div className="perf-kpi-sub">
            {lang === "tr" ? "Sunucu ilk yanıt başlama hızı" : "Time to First Byte"}
          </div>
        </div>

        <div className="perf-kpi-card">
          <div className="perf-kpi-label">P99 (Kuyruk Gecikmesi)</div>
          <div className="perf-kpi-value text-amber">
            {m.p99_latency_ms} <span className="perf-kpi-unit">ms</span>
          </div>
          <div className="perf-kpi-sub">
            {lang === "tr" ? "En yavaş %1'lik uç durumlar" : "Worst 1% tail latency"}
          </div>
        </div>
      </div>

      {/* Latency Distribution Histogram */}
      <div className="perf-histogram-card">
        <div className="perf-card-title">
          📊 {lang === "tr" ? "Eşzamanlı İstek Örneklemi ve Gecikme Dağılımı" : "Request Sample Latency Distribution"}
        </div>
        <p className="perf-card-subtitle">
          {lang === "tr"
            ? `${m.concurrency} eş zamanlı istemci ile gönderilen ${m.total_requests} isteğin bireysel gecikme süreleri (ms):`
            : `Individual latencies of ${m.total_requests} requests across ${m.concurrency} concurrent workers:`}
        </p>

        <div className="perf-samples-track">
          {m.samples.map((lat, idx) => {
            const heightPct = Math.max(12, Math.min(100, Math.round((lat / maxSample) * 100)));
            const barColor = lat <= 500 ? "#10b981" : lat <= 1500 ? "#f59e0b" : "#ef4444";
            return (
              <div key={idx} className="perf-sample-col" title={`İstek #${idx + 1}: ${lat}ms`}>
                <div
                  className="perf-sample-bar"
                  style={{ height: `${heightPct}%`, backgroundColor: barColor }}
                />
                <span className="perf-sample-val">{Math.round(lat)}</span>
              </div>
            );
          })}
        </div>

        <div className="perf-chart-legend">
          <span className="legend-item"><span className="legend-dot green" /> &lt; 500ms (Hızlı / SLA Uyumlu)</span>
          <span className="legend-item"><span className="legend-dot yellow" /> 500ms - 1500ms (Kabul Edilebilir)</span>
          <span className="legend-item"><span className="legend-dot red" /> &gt; 1500ms (Yavaş / SLA İhlali)</span>
        </div>
      </div>

      {/* HTTP Status Code Breakdown & BDDK Fintek Checklist */}
      <div className="perf-details-grid">
        <div className="perf-subcard">
          <div className="perf-card-title">
            🎯 {lang === "tr" ? "HTTP Durum Kodu Dağılımı" : "HTTP Status Code Breakdown"}
          </div>
          <div className="status-codes-list">
            {Object.entries(m.status_codes).map(([code, count]) => {
              const num = parseInt(code, 10);
              const is2xx = num >= 200 && num < 300;
              const is4xx = num >= 400 && num < 500;
              const is5xx = num >= 500;
              const pillClass = is2xx ? "pill-success" : is4xx ? "pill-warning" : "pill-danger";

              return (
                <div key={code} className="status-code-row">
                  <span className={`status-code-badge ${pillClass}`}>
                    HTTP {code}
                  </span>
                  <span className="status-code-name">
                    {num === 200 && "OK (Başarılı)"}
                    {num === 429 && "Too Many Requests (Rate Limit)"}
                    {num === 500 && "Internal Server Error"}
                    {num === 502 && "Bad Gateway"}
                    {num === 504 && "Gateway Timeout"}
                    {num !== 200 && num !== 429 && num !== 500 && num !== 502 && num !== 504 && "HTTP Response"}
                  </span>
                  <span className="status-code-count">
                    {count} {lang === "tr" ? "yanıt" : "resps"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="perf-subcard">
          <div className="perf-card-title">
            🏛️ {lang === "tr" ? "BDDK & Fintek Standartları Matrisi" : "BDDK & Fintech Standards Matrix"}
          </div>
          <ul className="bddk-checklist">
            <li className={m.p95_latency_ms <= 500 ? "pass" : "fail"}>
              <span className="check-icon">{m.p95_latency_ms <= 500 ? "✓" : "✗"}</span>
              <div>
                <strong>P95 Yanıt Süresi &lt; 500ms:</strong>
                <p>BDDK Elektronik Bankacılık & Yüksek Hacimli Ödeme SLA Standardı.</p>
              </div>
            </li>
            <li className={m.success_rate >= 95 ? "pass" : "fail"}>
              <span className="check-icon">{m.success_rate >= 95 ? "✓" : "✗"}</span>
              <div>
                <strong>Eşzamanlı Yük Başarı Oranı &gt; %95:</strong>
                <p>Sunucunun ani kullanıcı dalgalanmalarında istek düşürmeme direnci.</p>
              </div>
            </li>
            <li className={findings.some((f) => f.id === "PERF_NO_COMPRESSION") ? "fail" : "pass"}>
              <span className="check-icon">{!findings.some((f) => f.id === "PERF_NO_COMPRESSION") ? "✓" : "✗"}</span>
              <div>
                <strong>Gzip / Brotli İçerik Sıkıştırması:</strong>
                <p>Mobil ve düşük bant genişliğinde veri tasarrufu ve hızlı render.</p>
              </div>
            </li>
            <li className={findings.some((f) => f.id === "BDDK_UNMASKED_IBAN_EXPOSURE" || f.id === "BDDK_UNMASKED_TCKN_EXPOSURE") ? "fail" : "pass"}>
              <span className="check-icon">{!findings.some((f) => f.id === "BDDK_UNMASKED_IBAN_EXPOSURE" || f.id === "BDDK_UNMASKED_TCKN_EXPOSURE") ? "✓" : "✗"}</span>
              <div>
                <strong>Hassas Veri Maskeleme (IBAN / TCKN):</strong>
                <p>BDDK Madde 34 ve KVKK uyarınca açıkta finansal veri olmaması.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
