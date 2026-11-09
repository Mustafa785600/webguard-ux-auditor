"use client";

import { useState } from "react";
import type {
  DatabaseLeakReport,
  DatabaseLeakItem,
  SlowQueryCandidate,
  TimeProbeResult,
} from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface DatabaseSlowQueryViewProps {
  report?: DatabaseLeakReport | null;
  lang?: Language;
}

export default function DatabaseSlowQueryView({
  report,
  lang = "tr",
}: DatabaseSlowQueryViewProps) {
  const [activeTab, setActiveTab] = useState<"LEAKS" | "SLOW_QUERIES" | "TIME_PROBES" | "ORM_FIXES">("LEAKS");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">🗄️</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr"
            ? "Veritabanı ve Yavaş Sorgu Denetim Verisi Bulunamadı"
            : "No Database Leak & Slow Query Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için veritabanı hata sızıntısı ve yavaş sorgu telemetrisi henüz toplanmadı."
            : "Database error leakage and slow query telemetry has not been recorded for this scan yet."}
        </p>
      </div>
    );
  }

  const r = report;

  const scoreColor =
    r.db_health_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.db_health_score >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık & Sağlık Skoru ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border border-indigo-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗄️</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "Veritabanı ve Yavaş Sorgu Sızıntı Denetimi"
                  : "Database Leak & Slow Query Prober"}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold border bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                OWASP A05 & CWE-209 Standardı
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "HTTP yanıtlarında aleni ifşa olan SQL sözdizimi hatalarını, açık veritabanı bağlantı URI'lerini (CWE-200), kabul edilebilir 800ms SLA eşiğini aşan yavaş API/SQL sorgularını ve N+1 sorgu paternlerini otonom denetler."
                : "Audits exposed SQL syntax errors, database connection URIs, slow queries breaching 800ms SLAs, and N+1 query patterns."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "Algılanan Veritabanları:" : "Detected Engines:"}
              </span>
              {r.detected_engines.map((eng) => (
                <span
                  key={eng}
                  className="px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-indigo-300 font-mono"
                >
                  ⚡ {eng}
                </span>
              ))}
            </div>
          </div>

          {/* Sağlık Skoru */}
          <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">
                {lang === "tr" ? "DB Güvenlik & Performans Skoru" : "DB Health Score"}
              </div>
              <div className="text-2xl font-black text-white">{r.db_health_score} / 100</div>
            </div>
            <div
              className={`w-14 h-14 rounded-xl border flex items-center justify-center font-black text-xl shadow-lg ${scoreColor}`}
            >
              %{r.db_health_score}
            </div>
          </div>
        </div>

        {/* Özet Kartları */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">
              {lang === "tr" ? "Kritik Sızıntılar" : "Database Leaks"}
            </div>
            <div className={`text-xl font-bold mt-1 ${r.total_leaks_count > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {r.total_leaks_count} {lang === "tr" ? "Tespit" : "Found"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">
              {lang === "tr" ? "Yavaş Sorgular (>800ms)" : "Slow Queries (>800ms)"}
            </div>
            <div className={`text-xl font-bold mt-1 ${r.slow_queries_count > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {r.slow_queries_count} {lang === "tr" ? "Uç Nokta" : "Endpoints"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">
              {lang === "tr" ? "N+1 Patern Şüphesi" : "N+1 Query Suspects"}
            </div>
            <div className={`text-xl font-bold mt-1 ${r.n_plus_one_suspects_count > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {r.n_plus_one_suspects_count} {lang === "tr" ? "Patern" : "Patterns"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">
              {lang === "tr" ? "Zaman Probu Durumu" : "Time Probe Status"}
            </div>
            <div className="text-xl font-bold mt-1 text-indigo-400">
              {r.time_probes.every((p) => p.status === "SAFE") ? "Korumalı (Safe)" : "Gecikme Şüphesi"}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Sekme Butonları ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-800 space-x-2 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("LEAKS")}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === "LEAKS"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🛡️ {lang === "tr" ? "Veritabanı Sızıntıları" : "Database Leaks"} ({r.leaks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("SLOW_QUERIES")}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === "SLOW_QUERIES"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          ⏱️ {lang === "tr" ? "Yavaş Sorgular & N+1" : "Slow Queries & N+1"} ({r.slow_queries.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("TIME_PROBES")}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === "TIME_PROBES"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🧪 {lang === "tr" ? "Zaman Bazlı Problama" : "Time Probing"} ({r.time_probes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ORM_FIXES")}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === "ORM_FIXES"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          💡 {lang === "tr" ? "ORM & İndeks Çözüm Rehberi" : "ORM & Index Guides"}
        </button>
      </div>

      {/* ── 3. Sekme İçerikleri ───────────────────────────────────────────── */}

      {/* SEKME 1: SIZINTILAR */}
      {activeTab === "LEAKS" && (
        <div className="space-y-4">
          {r.leaks.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800 text-emerald-400">
              <span className="text-3xl">✅</span>
              <h4 className="text-base font-bold mt-2 text-white">
                {lang === "tr" ? "Sıfır Veritabanı Hata Sızıntısı" : "No Database Leaks Detected"}
              </h4>
              <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">
                {lang === "tr"
                  ? "HTTP yanıtlarında hiçbir SQL sözdizimi hatası, ORM stack trace'i veya açık veritabanı bağlantı dizesi tespit edilmedi."
                  : "No raw SQL errors, stack traces, or exposed connection URIs found in responses."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {r.leaks.map((leak, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          leak.severity === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : leak.severity === "HIGH"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {leak.severity}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-indigo-300 border border-indigo-500/30">
                        {leak.leak_type}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        Motor: <strong className="text-white">{leak.detected_engine}</strong>
                      </span>
                    </div>

                    <span className="text-xs font-mono text-slate-400 truncate max-w-md">
                      {leak.endpoint}
                    </span>
                  </div>

                  <p className="text-sm text-slate-300">{leak.description}</p>

                  {/* Sızıntı Örneği */}
                  <div className="relative p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-rose-300">
                    <div className="text-[10px] text-slate-500 font-sans uppercase mb-1">
                      {lang === "tr" ? "Yanıtta Yakalanan Sızıntı Kesiti:" : "Captured Leak Snippet:"}
                    </div>
                    <code>{leak.leak_sample}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(leak.leak_sample, `leak-${idx}`)}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition"
                    >
                      {copiedIndex === `leak-${idx}` ? "Kopyalandı!" : "Kopyala"}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/40 text-xs text-indigo-200">
                    <strong>💡 {lang === "tr" ? "Önerilen Çözüm:" : "Remediation:"}</strong> {leak.remediation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEKME 2: YAVAŞ SORGULAR VE N+1 */}
      {activeTab === "SLOW_QUERIES" && (
        <div className="space-y-4">
          {r.slow_queries.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800 text-emerald-400">
              <span className="text-3xl">⚡</span>
              <h4 className="text-base font-bold mt-2 text-white">
                {lang === "tr" ? "Tüm API ve Veritabanı Çağrıları Hızlı" : "All Database Endpoints Fast"}
              </h4>
              <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">
                {lang === "tr"
                  ? "Hiçbir uç nokta 800ms SLA eşiğini aşmadı ve N+1 sorgu paternine rastlanmadı."
                  : "No queries breached the 800ms SLA threshold and no N+1 query patterns found."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {r.slow_queries.map((q, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">
                        {q.method}
                      </span>
                      <span className="font-mono text-sm font-semibold text-white">
                        {q.endpoint}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          q.severity === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : q.severity === "HIGH"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                        }`}
                      >
                        ⏱️ {q.observed_latency_ms} ms
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 font-semibold block mb-1">
                        {lang === "tr" ? "Şüpheli Darboğaz Nedeni:" : "Suspected Cause:"}
                      </span>
                      <span className="text-amber-300 font-medium">{q.suspected_cause}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 font-semibold block mb-1">
                        {lang === "tr" ? "Muhtemel SQL Sorgusu:" : "Query Pattern Hint:"}
                      </span>
                      <code className="text-indigo-300 font-mono text-[11px]">
                        {q.query_pattern_hint || "N/A"}
                      </code>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-xs text-emerald-200">
                    <strong>🚀 {lang === "tr" ? "ORM / İndeks İyileştirmesi:" : "ORM Optimization:"}</strong>{" "}
                    {q.orm_fix_recommendation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEKME 3: ZAMAN BAZLI PROBLAMA */}
      {activeTab === "TIME_PROBES" && (
        <div className="space-y-4">
          <div className="grid gap-3">
            {r.time_probes.map((probe, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">{probe.probe_name}</h4>
                    <span className="text-xs text-slate-400 font-mono">{probe.endpoint}</span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      probe.status === "SAFE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {probe.status === "SAFE" ? "✅ Korumalı (Safe)" : "⚠️ Gecikme Şüphesi"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">TABAN SÜRE</span>
                    <span className="text-slate-200 font-bold">{probe.baseline_latency_ms} ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">PROB SÜRESİ</span>
                    <span className="text-indigo-300 font-bold">{probe.probed_latency_ms} ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">GECİKME FARKI</span>
                    <span
                      className={`font-bold ${
                        probe.latency_delta_ms > 1200 ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      +{probe.latency_delta_ms} ms
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300">{probe.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEKME 4: ORM VE İNDEKS ÇÖZÜM REHBERİ */}
      {activeTab === "ORM_FIXES" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📚</span> {lang === "tr" ? "Kurumsal ORM ve Veritabanı Optimizasyon Standartları" : "Enterprise ORM Standards"}
            </h4>

            <div className="grid gap-3">
              {r.orm_recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300">
                  <span className="text-indigo-400 text-sm">✓</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
              <div className="text-[11px] text-slate-400 font-sans font-bold">
                {lang === "tr" ? "Örnek: PostgreSQL CONCURRENTLY İndeksleme ve FastAPI / SQLAlchemy Eager Load" : "Example Optimizations"}
              </div>
              <pre className="text-emerald-400 overflow-x-auto p-2 bg-slate-900/90 rounded-lg">
{`# 1. PostgreSQL Ağır Sorgu İndeksi (Kilitlenme olmadan)
CREATE INDEX CONCURRENTLY idx_orders_user_created 
ON orders (user_id, created_at DESC);

# 2. SQLAlchemy / FastAPI Eager Loading (N+1 Önleme)
from sqlalchemy.orm import selectinload, joinedload
query = select(User).options(selectinload(User.orders)).where(User.is_active == True)`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
