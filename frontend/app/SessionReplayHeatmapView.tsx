"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type {
  SessionReplayReport,
  SessionEvent,
  ClickHotspot,
} from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface SessionReplayHeatmapViewProps {
  report?: SessionReplayReport | null;
  lang?: Language;
}

export default function SessionReplayHeatmapView({
  report,
  lang = "tr",
}: SessionReplayHeatmapViewProps) {
  const [activeTab, setActiveTab] = useState<"PLAYER" | "HEATMAP" | "SCROLL" | "FRICTION">("PLAYER");

  // Replay Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentProgressMs, setCurrentProgressMs] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [heatmapFilter, setHeatmapFilter] = useState<"ALL" | "RAGE" | "DEAD">("ALL");
  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number | null>(null);

  const maxDurationMs = useMemo(() => {
    if (!report || !report.events || report.events.length === 0) return 15000;
    return Math.max(10000, report.events[report.events.length - 1].timestamp_ms + 1000);
  }, [report]);

  // Current active event and cursor position interpolated
  const { currentCursor, activeEventsList } = useMemo(() => {
    if (!report || !report.events || report.events.length === 0) {
      return { currentCursor: { x: 50, y: 30, type: "MOUSE_MOVE", text: "" }, activeEventsList: [] };
    }

    const pastEvents = report.events.filter((e) => e.timestamp_ms <= currentProgressMs);
    const lastEvent = pastEvents[pastEvents.length - 1] || report.events[0];

    return {
      currentCursor: {
        x: lastEvent.x_pct,
        y: lastEvent.y_pct,
        type: lastEvent.event_type,
        text: lastEvent.element_text,
      },
      activeEventsList: pastEvents.slice(-6).reverse(),
    };
  }, [report, currentProgressMs]);

  // Playback Animation Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      lastTickTimeRef.current = null;
      return;
    }

    const animate = (now: number) => {
      if (lastTickTimeRef.current !== null) {
        const delta = now - lastTickTimeRef.current;
        setCurrentProgressMs((prev) => {
          const nextVal = prev + delta * playbackSpeed;
          if (nextVal >= maxDurationMs) {
            setIsPlaying(false);
            return maxDurationMs;
          }
          return nextVal;
        });
      }
      lastTickTimeRef.current = now;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, maxDurationMs]);

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">🎬</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr" ? "Oturum Kaydı ve Isı Haritası Verisi Bulunamadı" : "No Session Replay Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için kullanıcı oturum telemetrisi ve tıklama ısı haritası henüz oluşturulmadı."
            : "User session telemetry and heatmap data has not been recorded for this scan yet."}
        </p>
      </div>
    );
  }

  const r = report;

  const scoreColor =
    r.ux_friction_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.ux_friction_score >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  const filteredHotspots = r.click_hotspots.filter((h) => {
    if (heatmapFilter === "RAGE") return h.is_rage_click;
    if (heatmapFilter === "DEAD") return (h.selector || "").startsWith("div") || (h.selector || "").startsWith("p");
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık ve Sürtünme Skoru Özeti ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎬</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "Kullanıcı Oturum Kaydı ve Isı Haritası (Session Replay & Heatmap)"
                  : "Session Replay & Click / Scroll Heatmap"}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/30">
                Hotjar / FullStory Standardı
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "Kullanıcının sayfa üzerindeki fare hareketlerini, tıklamalarını, kaydırma derinliğini ve arayüzde takıldığı noktaları (Kızgın Tıklamalar / Ölü Tıklamalar) interaktif olarak yeniden oynatır ve görsel ısı haritası sunar."
                : "Replays user cursor movements, clicks, and scroll depth with visual heatmaps to detect rage clicks and dead interactions."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                Oturum ID: <strong className="text-amber-400">{r.session_id}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                Süre: <strong className="text-white">{r.duration_seconds}s</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 font-medium">
                ✓ KVKK / GDPR Otomatik Maskeli
              </span>
            </div>
          </div>

          {/* Skor Kartı & Temel KPI */}
          <div className="flex items-center gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="text-center px-4 border-r border-slate-800">
              <div className={`text-3xl font-black ${scoreColor.split(" ")[0]}`}>
                {r.ux_friction_score}/100
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                {lang === "tr" ? "Akıcılık Skoru" : "Friction Score"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300">
                Tıklamalar: <strong className="text-white">{r.total_clicks}</strong>
              </div>

              <div
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  r.rage_clicks_count > 0
                    ? "bg-rose-950/30 border-rose-500/30 text-rose-400 animate-pulse"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                😡 {r.rage_clicks_count} Kızgın Tıklama
              </div>

              <div
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  r.dead_clicks_count > 0
                    ? "bg-amber-950/30 border-amber-500/30 text-amber-400"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                ⚠️ {r.dead_clicks_count} Ölü Tıklama
              </div>

              <div className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300">
                Kaydırma: <strong className="text-cyan-400">%{r.max_scroll_depth_pct}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Sekmeler (Tabs Bar) ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("PLAYER")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
            activeTab === "PLAYER"
              ? "bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-950/50"
              : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
          }`}
        >
          <span>🎬</span>
          <span>{lang === "tr" ? "Oturum Oynatıcı (Replay)" : "Session Replay"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HEATMAP")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
            activeTab === "HEATMAP"
              ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-950/50"
              : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
          }`}
        >
          <span>🌡️</span>
          <span>{lang === "tr" ? "Tıklama Isı Haritası" : "Click Heatmap"} ({r.click_hotspots.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SCROLL")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
            activeTab === "SCROLL"
              ? "bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-950/50"
              : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
          }`}
        >
          <span>📉</span>
          <span>{lang === "tr" ? "Kaydırma Tutundurma (Scroll)" : "Scroll Retention"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("FRICTION")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
            activeTab === "FRICTION"
              ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-950/50"
              : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
          }`}
        >
          <span>⚠️</span>
          <span>{lang === "tr" ? "Sürtünme Kusurları" : "Friction Defects"} ({r.rage_clicks_count + r.dead_clicks_count})</span>
        </button>
      </div>

      {/* ── 3. TAB 1: Oturum Oynatıcı (Session Replay Player) ─────────────── */}
      {activeTab === "PLAYER" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sol: Simüle Edilmiş Tarayıcı ve Canlı İmleç (8 Kolon) */}
          <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            {/* Sanal Tarayıcı Başlığı */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-slate-400">https://webguard-virtual-session.local</span>
              </div>
              <span className="font-mono text-amber-400 font-bold">
                {Math.floor(currentProgressMs / 1000)}s / {Math.floor(maxDurationMs / 1000)}s
              </span>
            </div>

            {/* Sanal Sayfa Görünümü ve Animasyonlu İmleç */}
            <div className="relative w-full h-[400px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex flex-col justify-between p-6 select-none">
              {/* Sayfa Arka Plan İskeleti (Wireframe DOM Mock) */}
              <div className="space-y-4 opacity-40 pointer-events-none">
                <div className="h-8 bg-slate-800 rounded-lg w-1/3" />
                <div className="h-4 bg-slate-800/60 rounded w-2/3" />
                <div className="grid grid-cols-3 gap-3 pt-4">
                  <div className="h-28 bg-slate-800/50 rounded-xl border border-slate-700/50" />
                  <div className="h-28 bg-slate-800/50 rounded-xl border border-slate-700/50" />
                  <div className="h-28 bg-slate-800/50 rounded-xl border border-slate-700/50" />
                </div>
                <div className="h-10 bg-amber-500/20 rounded-xl w-40 mt-6" />
              </div>

              {/* Canlı Hareketli Fare İmleci */}
              <div
                className="absolute z-20 pointer-events-none transition-all duration-150 ease-out flex flex-col items-start"
                style={{
                  left: `${currentCursor.x}%`,
                  top: `${currentCursor.y}%`,
                  transform: "translate(-2px, -2px)",
                }}
              >
                {/* SVG İmleç Oku */}
                <svg
                  className="w-6 h-6 drop-shadow-md text-amber-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3 3l7 18 3-7 7-3L3 3z" />
                </svg>

                {/* Tıklama Dalga Efekti (Ripple) */}
                {currentCursor.type === "CLICK" && (
                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full border-2 border-cyan-400 animate-ping opacity-75" />
                )}
                {currentCursor.type === "RAGE_CLICK" && (
                  <div className="absolute -top-3 -left-3 w-12 h-12 rounded-full border-2 border-rose-500 animate-ping opacity-90" />
                )}

                {/* İmleç Etiketi */}
                {currentCursor.text && (
                  <span className="ml-4 -mt-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] text-white font-mono whitespace-nowrap shadow-lg">
                    {currentCursor.text}
                  </span>
                )}
              </div>

              {/* Alt Bilgi */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-900">
                <span>Viewport: 1440x900</span>
                <span>Olay: <strong className="text-slate-300 font-mono">{currentCursor.type}</strong></span>
              </div>
            </div>

            {/* Oynatıcı Kontrolleri ve Arama Çubuğu */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={maxDurationMs}
                  value={currentProgressMs}
                  onChange={(e) => setCurrentProgressMs(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition flex items-center gap-1.5"
                  >
                    <span>{isPlaying ? "⏸️ Duraklat" : "▶️ Oynat"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentProgressMs(0);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
                  >
                    ⏮️ Başa Sar
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <span className="text-[11px] text-slate-400 px-2">Hız:</span>
                  {[1, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition ${
                        playbackSpeed === speed
                          ? "bg-amber-500 text-slate-950"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sağ: Gerçek Zamanlı Olay Günlüğü Akışı (4 Kolon) */}
          <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>📜</span> Canlı Olay Günlüğü
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {r.events.length} Olay
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {activeEventsList.map((ev, idx) => {
                  const isRage = ev.event_type === "RAGE_CLICK";
                  const isDead = ev.event_type === "DEAD_CLICK";
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-xs font-mono transition-all ${
                        isRage
                          ? "bg-rose-950/40 border-rose-500/40 text-rose-300"
                          : isDead
                          ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                          : "bg-slate-950 border-slate-800 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{ev.event_type}</span>
                        <span>{Math.round(ev.timestamp_ms)}ms</span>
                      </div>
                      <div className="mt-1 font-semibold text-white truncate">
                        {ev.selector || ev.element_text || `Koordinat: (${Math.round(ev.x_pct)}%, ${Math.round(ev.y_pct)}%)`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-slate-200 block mb-0.5">🔒 KVKK Gizlilik Koruması:</strong>
              Kullanıcının form alanlarına girdiği parolalar ve özel veriler oturumda asla depolanmaz, otomatik maskelenir.
            </div>
          </div>
        </div>
      )}

      {/* ── 4. TAB 2: Tıklama Isı Haritası (Heatmap Overlay) ──────────────── */}
      {activeTab === "HEATMAP" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Görüntüleme Filtresi:</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setHeatmapFilter("ALL")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    heatmapFilter === "ALL"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  Tüm Sıcak Noktalar ({r.click_hotspots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapFilter("RAGE")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    heatmapFilter === "RAGE"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  😡 Kızgın Noktalar ({r.rage_clicks_count})
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapFilter("DEAD")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    heatmapFilter === "DEAD"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ⚠️ Ölü Tıklamalar ({r.dead_clicks_count})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-3 h-3 rounded-full bg-cyan-400/80" /> Düşük Yoğunluk
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-3 h-3 rounded-full bg-amber-400/80" /> Orta Yoğunluk
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-3 h-3 rounded-full bg-rose-500/90" /> Yüksek / Kızgın Tıklama
              </span>
            </div>
          </div>

          {/* Isı Haritası Tuvali (Heatmap Canvas) */}
          <div className="relative w-full h-[540px] bg-slate-950 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-2xl p-6">
            {/* Sayfa Taslağı (Wireframe) */}
            <div className="space-y-6 opacity-25 pointer-events-none">
              <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <div className="h-8 bg-slate-700 rounded w-44" />
                <div className="flex gap-4">
                  <div className="h-4 bg-slate-700 rounded w-20" />
                  <div className="h-4 bg-slate-700 rounded w-20" />
                  <div className="h-4 bg-slate-700 rounded w-20" />
                </div>
              </div>

              <div className="h-20 bg-slate-800 rounded-2xl w-3/4 mx-auto" />

              <div className="grid grid-cols-3 gap-6 pt-6">
                <div className="h-48 bg-slate-800 rounded-xl" />
                <div className="h-48 bg-slate-800 rounded-xl" />
                <div className="h-48 bg-slate-800 rounded-xl" />
              </div>
            </div>

            {/* Isı Haritası Tıklama Parıltıları (Radial Heatspots) */}
            {filteredHotspots.map((hotspot, idx) => {
              const size = Math.max(50, hotspot.click_count * 28);
              const color = hotspot.is_rage_click
                ? "radial-gradient(circle, rgba(244,63,94,0.9) 0%, rgba(244,63,94,0.4) 40%, transparent 70%)"
                : hotspot.intensity > 0.6
                ? "radial-gradient(circle, rgba(251,191,36,0.9) 0%, rgba(251,191,36,0.4) 40%, transparent 70%)"
                : "radial-gradient(circle, rgba(34,211,238,0.8) 0%, rgba(34,211,238,0.3) 40%, transparent 70%)";

              return (
                <div
                  key={idx}
                  className="absolute pointer-events-auto cursor-pointer group transition-transform hover:scale-125"
                  style={{
                    left: `${hotspot.x_pct}%`,
                    top: `${hotspot.y_pct}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    transform: "translate(-50%, -50%)",
                    background: color,
                    borderRadius: "50%",
                  }}
                >
                  {/* Tooltip on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-mono text-white whitespace-nowrap shadow-2xl z-30 pointer-events-none">
                    <div className="font-bold text-amber-400">
                      {hotspot.click_count} Tıklama {hotspot.is_rage_click ? "(Kızgın)" : ""}
                    </div>
                    <div className="text-slate-300">{hotspot.selector || "Bileşen"}</div>
                    {hotspot.element_text && <div className="text-slate-500">&quot;{hotspot.element_text}&quot;</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. TAB 3: Kaydırma Derinlik Şelalesi (Scroll Retention Waterfall) ─ */}
      {activeTab === "SCROLL" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📉</span> Sayfa Kaydırma Derinlik Şelalesi
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ziyaretçilerin sayfanın ne kadarlık kısmını aşağı kaydırarak görüntülediğini ve
              hangi derinlikte sayfayı terk ettiğini analiz eder.
            </p>

            <div className="space-y-3 pt-2">
              {r.scroll_milestones.map((m) => (
                <div key={m.depth_percentage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      %{m.depth_percentage} Derinlik {m.depth_percentage === 25 ? "(Ekranın Üstü - Fold)" : ""}
                    </span>
                    <span className="font-mono font-bold text-cyan-400">
                      %{m.visitors_reached_pct} Kullanıcı
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${m.visitors_reached_pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 text-right">
                    Ortalama Kalış Süresi: {m.avg_time_spent_seconds}s
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>💡</span> Kaydırma Dönüşüm Tavsiyeleri
            </h3>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-amber-400 block">Kritik Eylem Butonlarını (CTA) Üste Taşıyın</strong>
                Kullanıcıların %82&apos;si sayfanın ilk %50&apos;sinden sonrasına inmeden ayrılmaktadır. Ana dönüşüm butonları ilk %25&apos;lik alanda yer almalıdır.
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-cyan-400 block">Görsel Kaydırma İpuçları Ekleyin</strong>
                Aşağı doğru kaydırmayı teşvik eden animasyonlu oklar veya &quot;Devamı aşağıda&quot; göstergeleri alt bölüm erişimini %30 artırır.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. TAB 4: Sürtünme Kusurları (Rage & Dead Click Breakdown) ─────── */}
      {activeTab === "FRICTION" && (
        <div className="space-y-3">
          {r.rage_clicks_count === 0 && r.dead_clicks_count === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-3xl">🎉</span>
              <h4 className="text-sm font-bold text-emerald-400">
                Sıfır UX Sürtünmesi!
              </h4>
              <p className="text-xs text-slate-400">
                Oturum boyunca hiçbir kızgın tıklama (rage click) veya ölü tıklama tespit edilmedi. Arayüz tepkileri son derece akıcıdır.
              </p>
            </div>
          ) : (
            <>
              {r.rage_clicks_count > 0 && (
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <span>😡</span> Kızgın Tıklama (Rage Click) Sorunları ({r.rage_clicks_count} Küme)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      MEDIUM SEVERITY
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Kullanıcılar arayüzün tepki vermediğini düşünerek aynı öğeye kısa sürede art arda tıklamıştır.
                    Buton tıklamalarına loading/spinner durumları ve debouncing eklenmelidir.
                  </p>
                </div>
              )}

              {r.dead_clicks_count > 0 && (
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>⚠️</span> Ölü Tıklama (Dead Click) Sorunları ({r.dead_clicks_count} Öğe)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      LOW SEVERITY
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tıklanabilir gibi görünen metin ve kartlar tıklandığında hiçbir işlem yapmamaktadır.
                    Kullanıcı kafa karışıklığını önlemek için cursor: pointer stilini kaldırın veya öğeyi ilgili sayfaya bağlayın.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
