"use client";

import { useState } from "react";
import type {
  MemoryLeakReport,
  MemoryLeakItem,
  DetachedDOMCluster,
  DanglingListenerItem,
} from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface MemoryLeakViewProps {
  report?: MemoryLeakReport | null;
  lang?: Language;
}

export default function MemoryLeakView({
  report,
  lang = "tr",
}: MemoryLeakViewProps) {
  const [activeTab, setActiveTab] = useState<"LEAKS" | "DETACHED_DOM" | "LISTENERS" | "REMEDIATION_GUIDE">("LEAKS");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">🧠</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr"
            ? "Bellek ve DOM Sızıntı Denetim Verisi Bulunamadı"
            : "No Memory & DOM Leak Profiling Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için SPA bellek tüketimi, kopuk DOM ağaçları ve temizlenmemiş dinleyiciler henüz analiz edilmedi."
            : "SPA memory consumption, detached DOM trees, and uncleaned event listeners have not been profiled yet."}
        </p>
      </div>
    );
  }

  const r = report;

  const scoreColor =
    r.memory_health_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.memory_health_score >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  const growthColor =
    r.heap_metrics.growth_rate_status === "HEALTHY"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : r.heap_metrics.growth_rate_status === "MODERATE_RISK"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : "text-rose-400 bg-rose-500/10 border-rose-500/30";

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık & Bellek Sağlık Skoru ───────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border border-indigo-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧠</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "SPA Bellek ve DOM Sızıntı Radarı"
                  : "SPA Memory & DOM Leak Profiler"}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold border bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                Chrome DevTools Memory & W3C Standardı
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "Tek Sayfa Uygulamalarında (React / Next.js / Vue) bileşen unmount sonrası kopuk kalan DOM düğümlerini (Detached DOM Nodes), temizlenmemiş yetim event listener'ları ve kontrolsüz JS Heap büyümesini tespit eder."
                : "Detects uncollected detached DOM nodes, dangling event listeners after component unmount, uncleaned timers/observers, and unbounded JS Heap growth in Single Page Apps."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "Heap Durumu:" : "Heap Status:"}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md border font-semibold ${growthColor}`}>
                {r.heap_metrics.growth_rate_status === "HEALTHY"
                  ? "Sağlıklı (Dengeli GC)"
                  : r.heap_metrics.growth_rate_status === "MODERATE_RISK"
                  ? "Orta Risk (+Büyüme Var)"
                  : "Kritik Büyüme (Bloat Riski)"}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "Heap Büyüme Hızı:" : "Growth Delta:"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-indigo-300 font-mono text-[11px]">
                +{r.heap_metrics.heap_growth_delta_mb} MB / Gezinme
              </span>
            </div>
          </div>

          {/* Bellek Sağlık Skoru */}
          <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">
                {lang === "tr" ? "Bellek Sağlık Skoru" : "Memory Health Score"}
              </div>
              <div className="text-[11px] text-slate-500">
                {r.total_leaks_count === 0
                  ? (lang === "tr" ? "Kusursuz GC Temizliği" : "Clean Memory Retention")
                  : `${r.total_leaks_count} ${lang === "tr" ? "Sızıntı Riski" : "Leak Risks"}`}
              </div>
            </div>
            <div className={`px-4 py-2.5 rounded-xl border text-2xl font-black ${scoreColor}`}>
              {r.memory_health_score}
              <span className="text-xs font-normal text-slate-400 ml-0.5">/100</span>
            </div>
          </div>
        </div>

        {/* ── 2. Metrik İstatistik Çubukları & Heap Göstergesi ────────────── */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "Kullanılan JS Heap" : "Used JS Heap"}</span>
              <span className="text-indigo-400 font-bold">{r.heap_metrics.used_js_heap_size_mb} MB</span>
            </div>
            <div className="mt-2 text-base font-bold text-white flex items-baseline gap-1">
              <span>{r.heap_metrics.heap_utilization_pct}%</span>
              <span className="text-[11px] text-slate-400 font-normal">/ {r.heap_metrics.total_js_heap_size_mb} MB</span>
            </div>
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  r.heap_metrics.heap_utilization_pct > 75 ? "bg-rose-500" : "bg-indigo-500"
                }`}
                style={{ width: `${Math.min(100, r.heap_metrics.heap_utilization_pct)}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "Kopuk DOM Düğümleri" : "Detached DOM Nodes"}</span>
              <span className="text-amber-400 font-bold">~{r.detached_dom_nodes_count}</span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.detached_dom_nodes_count > 0 ? (
                <span className="text-amber-300">
                  {r.detached_dom_nodes_count} {lang === "tr" ? "Askıda Düğüm" : "Orphan Nodes"}
                </span>
              ) : (
                <span className="text-emerald-400">{lang === "tr" ? "0 Düğüm (Temiz)" : "0 Nodes (Clean)"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {r.detached_clusters.length} {lang === "tr" ? "farklı portal kümesi" : "portal clusters"}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "Yetim Event Listener" : "Dangling Listeners"}</span>
              <span className="text-rose-400 font-bold">{r.dangling_listeners_count}</span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.dangling_listeners_count > 0 ? (
                <span className="text-rose-300">
                  {r.dangling_listeners_count} {lang === "tr" ? "Temizlenmemiş" : "Uncleaned"}
                </span>
              ) : (
                <span className="text-emerald-400">{lang === "tr" ? "0 Dinleyici (Dengeli)" : "0 Cleaned"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {lang === "tr" ? "window/document dinleyicileri" : "global event bindings"}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "Açık Zamanlayıcılar" : "Active Timers"}</span>
              <span className="text-cyan-400 font-bold">{r.uncleaned_timers_count}</span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.uncleaned_timers_count > 0 ? (
                <span className="text-amber-300">
                  {r.uncleaned_timers_count} {lang === "tr" ? "setInterval" : "Intervals"}
                </span>
              ) : (
                <span className="text-emerald-400">{lang === "tr" ? "Tümü Temizlendi" : "All Cleared"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {lang === "tr" ? "Periyodik polling döngüleri" : "Polling loop cycles"}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Alt Sekmeler (Navigation Tabs) ─────────────────────────────── */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("LEAKS")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "LEAKS"
              ? "border-indigo-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>⚠️ {lang === "tr" ? "Tespit Edilen Sızıntılar" : "Detected Leaks"}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {r.leaks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DETACHED_DOM")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "DETACHED_DOM"
              ? "border-indigo-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>🌲 {lang === "tr" ? "Kopuk DOM Ağaçları" : "Detached DOM Clusters"}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {r.detached_clusters.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LISTENERS")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "LISTENERS"
              ? "border-indigo-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>🎧 {lang === "tr" ? "Yetim Dinleyiciler" : "Dangling Listeners"}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {r.dangling_listeners.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REMEDIATION_GUIDE")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "REMEDIATION_GUIDE"
              ? "border-indigo-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>🛠️ {lang === "tr" ? "React/Next.js Çözüm Rehberi" : "Remediation Recipes"}</span>
        </button>
      </div>

      {/* ── TAB 1: TESPİT EDİLEN SIZINTILAR (LEAKS) ────────────────────────── */}
      {activeTab === "LEAKS" && (
        <div className="space-y-4">
          {r.leaks.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
              <span className="text-3xl">✨</span>
              <h4 className="text-sm font-bold text-white">
                {lang === "tr" ? "Hiçbir Bellek Sızıntısı Tespit Edilmedi" : "No Memory Leaks Detected"}
              </h4>
              <p className="text-xs text-slate-400">
                {lang === "tr"
                  ? "Tüm event listener'lar, zamanlayıcılar ve DOM referansları kurumsal standartlarda optimize edilmiştir."
                  : "All event listeners, timers, and DOM references are cleaned up according to best practices."}
              </p>
            </div>
          ) : (
            r.leaks.map((leak, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-3.5 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        leak.severity === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : leak.severity === "HIGH"
                          ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                          : leak.severity === "MEDIUM"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {leak.severity}
                    </span>
                    <h4 className="text-sm font-bold text-white">{leak.title}</h4>
                  </div>
                  {leak.component_or_symbol && (
                    <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 self-start sm:self-auto">
                      {leak.component_or_symbol}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-300 leading-relaxed">
                  {leak.impact_explanation}
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs font-mono text-slate-400">
                  <span className="text-slate-500 mr-2">Metrik:</span>
                  <span className="text-indigo-300">{leak.metric_snippet}</span>
                </div>

                {leak.remediation && (
                  <div className="text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-lg">
                    <span className="font-semibold">{lang === "tr" ? "Çözüm Önerisi:" : "Remediation:"} </span>
                    {leak.remediation}
                  </div>
                )}

                {leak.code_fix_template && (
                  <div className="relative mt-2">
                    <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                      {leak.code_fix_template}
                    </pre>
                    <button
                      type="button"
                      onClick={() => handleCopy(leak.code_fix_template!, `leak-${idx}`)}
                      className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                    >
                      {copiedId === `leak-${idx}` ? (lang === "tr" ? "Kopyalandı!" : "Copied!") : (lang === "tr" ? "Kodu Kopyala" : "Copy Code")}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 2: KOPUK DOM AĞAÇLARI (DETACHED DOM) ───────────────────────── */}
      {activeTab === "DETACHED_DOM" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            {lang === "tr"
              ? "Kopuk DOM Düğümleri (Detached DOM Nodes), DOM ağacından silindiği halde JavaScript closure'ları, window referansları veya event dinleyicileri tarafından işaret edilmeye devam eden hayalet öğelerdir. Garbage Collector bu öğeleri serbest bırakamaz."
              : "Detached DOM nodes are elements removed from the DOM tree that cannot be garbage-collected because they are still referenced by JS closures, global variables, or active event bindings."}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {r.detached_clusters.map((cluster, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300">
                    &lt;{cluster.tag_name}&gt;
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    ~{cluster.count} {lang === "tr" ? "Düğüm" : "Nodes"}
                  </span>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed">
                  {cluster.description}
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono">
                    Bileşen: {cluster.suspected_component || "Generic"}
                  </span>
                  <span className="text-indigo-400 font-bold font-mono">
                    ~{(cluster.retained_size_bytes_est / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: YETİM EVENT LISTENER'LAR (LISTENERS) ─────────────────────── */}
      {activeTab === "LISTENERS" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            {lang === "tr"
              ? "React ve Next.js bileşenlerinde useEffect içerisinde 'window.addEventListener' kullanıldığında temizleme (cleanup) fonksiyonu döndürülmezse, her rota değişiminde ve unmount işleminde yeni bir dinleyici eklenir ve bellek sızıntısına yol açar."
              : "When using window.addEventListener inside React useEffect, failing to return a removeEventListener cleanup function causes duplicate listener accumulation on each route transition."}
          </div>

          <div className="space-y-4">
            {r.dangling_listeners.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {item.target_object}.{item.event_type}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({item.detected_count} {lang === "tr" ? "Adet Temizlenmemiş Dinleyici" : "Uncleaned Listeners"})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {item.suspected_pattern}
                  </span>
                </div>

                <div className="relative">
                  <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                    {item.remediation_code}
                  </pre>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.remediation_code, `listener-${idx}`)}
                    className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                  >
                    {copiedId === `listener-${idx}` ? (lang === "tr" ? "Kopyalandı!" : "Copied!") : (lang === "tr" ? "Kodu Kopyala" : "Copy Fix")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: REACT / NEXT.JS ÇÖZÜM REHBERİ (REMEDIATION_GUIDE) ───────── */}
      {activeTab === "REMEDIATION_GUIDE" && (
        <div className="space-y-5">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🛡️</span>
              <span>{lang === "tr" ? "Kurumsal Bellek İyileştirme İlkeleri" : "Enterprise Memory Best Practices"}</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              {r.remediation_recipes.map((recipe, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{recipe}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hazır Custom useEventListener Hook */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>⚡</span>
                <span>{lang === "tr" ? "Güvenli Özel Hook: useEventListener" : "Safe Hook: useEventListener"}</span>
              </h4>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `import { useEffect, useRef } from "react";\n\nexport function useEventListener<K extends keyof WindowEventMap>(\n  eventName: K,\n  handler: (event: WindowEventMap[K]) => void,\n  element = typeof window !== "undefined" ? window : null\n) {\n  const savedHandler = useRef(handler);\n  useEffect(() => {\n    savedHandler.current = handler;\n  }, [handler]);\n\n  useEffect(() => {\n    if (!element?.addEventListener) return;\n    const eventListener = (event: Event) => savedHandler.current(event as WindowEventMap[K]);\n    element.addEventListener(eventName, eventListener);\n    return () => element.removeEventListener(eventName, eventListener);\n  }, [eventName, element]);\n}`,
                    "hook-listener"
                  )
                }
                className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                {copiedId === "hook-listener" ? (lang === "tr" ? "Kopyalandı!" : "Copied!") : (lang === "tr" ? "Hook'u Kopyala" : "Copy Hook")}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
{`import { useEffect, useRef } from "react";

export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element = typeof window !== "undefined" ? window : null
) {
  const savedHandler = useRef(handler);
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!element?.addEventListener) return;
    const eventListener = (event: Event) => savedHandler.current(event as WindowEventMap[K]);
    element.addEventListener(eventName, eventListener);
    return () => element.removeEventListener(eventName, eventListener);
  }, [eventName, element]);
}`}
            </pre>
          </div>

          {/* WeakMap ile Güvenli GC Önbelleklemesi */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🧹</span>
              <span>{lang === "tr" ? "DOM Referanslarını Bellekte Tutmadan Önbellekleme (WeakMap)" : "Safe DOM Caching with WeakMap"}</span>
            </h4>
            <p className="text-xs text-slate-400">
              {lang === "tr"
                ? "Bileşenler unmount olduğunda GC'nin DOM elemanını otomatik silmesi için normal nesneler yerine WeakMap veya WeakRef kullanın."
                : "Use WeakMap instead of standard Object/Map so the Garbage Collector can collect unmounted DOM elements automatically."}
            </p>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
{`// DOM elemanları silindiğinde bellekte asılı kalmasını önler:
const elementMetadataCache = new WeakMap<HTMLElement, { scrollPos: number }>();

function cacheElementState(node: HTMLElement) {
  elementMetadataCache.set(node, { scrollPos: window.scrollY });
  // Node DOM'dan söküldüğünde WeakMap otomatik GC tarafından toplanır.
}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
