"use client";

import { useState } from "react";
import type { ChaosResilienceReport, ChaosExperimentResult, ChaosVerdict } from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface ChaosEngineeringViewProps {
  report?: ChaosResilienceReport | null;
  lang?: Language;
}

const VERDICT_CONFIG: Record<
  ChaosVerdict,
  { labelTr: string; labelEn: string; icon: string; badge: string }
> = {
  RESILIENT: {
    labelTr: "Dirençli & Şık Hata (Pass)",
    labelEn: "Resilient (Graceful)",
    icon: "🛡️",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  DEGRADED: {
    labelTr: "Kısmi Bozulma (Kabul Edilebilir)",
    labelEn: "Degraded Experience",
    icon: "⚠️",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  CRASH_UNHANDLED: {
    labelTr: "Yakalanmamış JS Çöküşü",
    labelEn: "Unhandled JS Crash",
    icon: "💥",
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/40",
  },
  WHITE_SCREEN_OF_DEATH: {
    labelTr: "Kritik Beyaz Ekran (WSOD)",
    labelEn: "White Screen of Death",
    icon: "☠️",
    badge: "bg-rose-600/20 text-rose-300 border-rose-500/50 animate-pulse font-black",
  },
};

export default function ChaosEngineeringView({
  report,
  lang = "tr",
}: ChaosEngineeringViewProps) {
  const [selectedExperiment, setSelectedExperiment] = useState<ChaosExperimentResult | null>(null);

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">💥</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr" ? "Kaos Mühendisliği Verisi Bulunamadı" : "No Chaos Engineering Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için ağ hata enjeksiyonu denetimi henüz yürütülmedi veya hedef sunucuya erişilemedi."
            : "Chaos fault injection audit was not executed for this scan or target was unreachable."}
        </p>
      </div>
    );
  }

  const r = report;

  const scoreColor =
    r.chaos_resilience_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.chaos_resilience_score >= 60
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık ve Kaos Dayanıklılık Skoru ──────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-rose-950/20 to-slate-900 border border-rose-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">💥</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "Kaos Mühendisliği ve Ağ Hata Enjeksiyonu"
                  : "Chaos Engineering & API Fault Injection"}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                Netflix & TestSprite Standardı
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "Arka plan API servislerine kontrollü HTTP 500 hataları, 3.5s ağ gecikmeleri ve bozuk JSON gövdeleri enjekte edilir. Arayüzün şık bir hata/loading gösterip göstermediği veya Beyaz Ekran Çöküşü (WSOD) yaşayıp yaşamadığı ölçülür."
                : "Simulates production disasters by injecting HTTP 500 errors, network latency spikes, packet drops, and corrupted JSON payloads into background APIs to evaluate frontend fault resilience and error boundary coverage."}
            </p>
          </div>

          {/* Skor Kartı */}
          <div className="flex items-center gap-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="text-center px-4 border-r border-slate-800">
              <div className={`text-3xl font-black ${scoreColor.split(" ")[0]}`}>
                {r.chaos_resilience_score}/100
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Kaos Direnç Skoru
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg text-emerald-400 font-semibold">
                🛡️ {r.resilient_experiments} Dirençli
              </div>
              <div className="bg-amber-950/30 border border-amber-500/20 px-2.5 py-1.5 rounded-lg text-amber-400 font-semibold">
                ⚠️ {r.degraded_experiments} Kısmi Bozulma
              </div>
              <div className="bg-rose-950/30 border border-rose-500/20 px-2.5 py-1.5 rounded-lg text-rose-400 font-semibold">
                💥 {r.crashed_experiments} JS Çöküşü
              </div>
              <div className="bg-rose-950/50 border border-rose-500/30 px-2.5 py-1.5 rounded-lg text-rose-300 font-bold">
                ☠️ {r.white_screens_count} Beyaz Ekran
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Kaos Deneyleri Matrisi Kartları ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {r.experiments.map((exp: ChaosExperimentResult) => {
          const cfg = VERDICT_CONFIG[exp.verdict];
          return (
            <div
              key={exp.experiment_id}
              onClick={() => setSelectedExperiment(exp)}
              className={`p-5 rounded-2xl border bg-slate-900/80 hover:border-indigo-500/50 cursor-pointer transition-all space-y-4 shadow-xl ${
                exp.white_screen_detected
                  ? "border-rose-500/50 bg-rose-950/15"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cfg.icon}</span>
                  <div>
                    <h3 className="font-bold text-white text-sm">{exp.name}</h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      {exp.target_pattern} • {exp.duration_ms} ms
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${cfg.badge}`}
                >
                  {lang === "tr" ? cfg.labelTr : cfg.labelEn}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold">Enjekte Edilen Arıza: </span>
                  <span className="text-slate-200">{exp.injected_fault_description}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">Kullanıcı Arayüzü Tepkisi: </span>
                  <span className="text-indigo-300 font-medium">{exp.ui_reaction}</span>
                </div>
              </div>

              {/* JS İstisnaları Varsa */}
              {exp.js_exceptions && exp.js_exceptions.length > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/20 text-[11px] font-mono text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-rose-400">
                    <span>⚠️</span>
                    <span>Yakalanmamış İstemci İstisnası:</span>
                  </div>
                  <div className="truncate">{exp.js_exceptions[0]}</div>
                </div>
              )}

              {exp.white_screen_detected && (
                <div className="p-2.5 rounded-lg bg-rose-900/40 border border-rose-500/40 text-xs text-rose-200 font-bold flex items-center gap-2">
                  <span>🚨</span>
                  <span>Kritik Hata: Sayfa tamamen beyaz ekrana (WSOD) düştü!</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 3. Kurumsal SRE & Dayanıklılık İyileştirme Rehberi ────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* React Error Boundary */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
            <span>🛡️</span>
            <span>React / Vue Error Boundary Koruması</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Sayfanın beyaz ekrana düşmesini (WSOD) engellemek için kritik sayfa bileşenlerini bir <strong>Error Boundary</strong> ile sarmalayın.
          </p>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
            // React Error Boundary Örneği<br />
            &lt;ErrorBoundary fallback=&#123;&lt;OfflineFallback /&gt;&#125;&gt;<br />
            &nbsp;&nbsp;&lt;UserProfileAndOrders /&gt;<br />
            &lt;/ErrorBoundary&gt;
          </div>
        </div>

        {/* Retry & Circuit Breaker */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <span>🔌</span>
            <span>Circuit Breaker & Üstel Geri Çekilme (Exponential Backoff)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Ağ kesintilerinde veya 500 hatalarında istekleri arka arkaya bombardımana tutmak yerine üstel geri çekilme (exponential backoff) ile 3 kez deneyin.
          </p>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
            // Axios / Fetch Retry Örneği<br />
            axiosRetry(axios, &#123;<br />
            &nbsp;&nbsp;retries: 3,<br />
            &nbsp;&nbsp;retryDelay: axiosRetry.exponentialDelay,<br />
            &nbsp;&nbsp;retryCondition: (e) =&gt; e.response?.status === 500<br />
            &#125;);
          </div>
        </div>
      </div>
    </div>
  );
}
