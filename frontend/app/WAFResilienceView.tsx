"use client";

import { useState, useMemo } from "react";
import type { WAFResilienceReport, WAFProbeResult, WAFProbeStatus } from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface WAFResilienceViewProps {
  report?: WAFResilienceReport | null;
  lang?: Language;
}

const STATUS_CONFIG: Record<
  WAFProbeStatus,
  { labelTr: string; labelEn: string; icon: string; badge: string }
> = {
  BLOCKED_BY_WAF: {
    labelTr: "WAF Engelledi (Güvenli)",
    labelEn: "Blocked by WAF",
    icon: "🛡️",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  HANDLED_CLEANLY: {
    labelTr: "Temizce İşlendi",
    labelEn: "Handled Cleanly",
    icon: "🧼",
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  },
  UNHANDLED_500_CRASH: {
    labelTr: "İşlenmemiş 500 Çöküşü",
    labelEn: "Unhandled 500 Crash",
    icon: "⚠️",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  STACK_TRACE_LEAK: {
    labelTr: "Kritik Hata Sızıntısı",
    labelEn: "Critical Stack Leak",
    icon: "🚨",
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/40 animate-pulse",
  },
};

export default function WAFResilienceView({
  report,
  lang = "tr",
}: WAFResilienceViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">🛡️</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr" ? "WAF Direnç Verisi Bulunamadı" : "No WAF Resilience Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için WAF ve hata sızıntısı direnç denetimi henüz yürütülmedi veya hedef sunucuya ulaşılamadı."
            : "WAF and error leakage probe was not executed for this scan or target was unreachable."}
        </p>
      </div>
    );
  }

  const r = report;

  const categories = useMemo(() => {
    const set = new Set<string>();
    r.probe_results.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [r]);

  const filteredProbes = useMemo(() => {
    return r.probe_results.filter((probe) => {
      const matchesCategory = selectedCategory === "ALL" || probe.category === selectedCategory;
      const matchesSearch =
        probe.probe_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        probe.payload_sample.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (probe.detected_leakage || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [r, selectedCategory, searchQuery]);

  const scoreColor =
    r.waf_protection_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.waf_protection_score >= 60
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık ve WAF Skor Özeti ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "WAF ve Hata Sızıntısı Direnç Testi"
                  : "WAF & Error Leakage Resilience Audit"}
              </h2>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold border ${
                  r.waf_detected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
              >
                {r.waf_detected
                  ? lang === "tr"
                    ? "WAF Aktif"
                    : "WAF Active"
                  : lang === "tr"
                  ? "Doğrudan Açık (WAF Yok)"
                  : "Direct Exposure (No WAF)"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "Virgosol kurumsal standartlarında sentetik güvenlik probları (SQLi, XSS, Path Traversal, bozuk JSON) gönderilerek sunucunun bu isteklere nasıl tepki verdiği ölçülür. 500 çöküşü veya stack trace sızıntısı varlığı denetlenir."
                : "Audits server behavior against synthetic, non-destructive attack vectors (SQLi, XSS, LFI, malformed JSON) to verify clean 400/403 rejection vs unhandled 500 crashes and stack trace exposures."}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Tespit Edilen Koruma:</span>
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-950 text-indigo-300 border border-indigo-500/30">
                {r.waf_vendor}
              </span>
            </div>
          </div>

          {/* Skor Kartı */}
          <div className="flex items-center gap-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="text-center px-4 border-r border-slate-800">
              <div className={`text-3xl font-black ${scoreColor.split(" ")[0]}`}>
                {r.waf_protection_score}/100
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                WAF Direnç Skoru
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg text-emerald-400 font-semibold">
                🛡️ {r.probes_blocked_by_waf} Engellendi
              </div>
              <div className="bg-sky-950/30 border border-sky-500/20 px-2.5 py-1.5 rounded-lg text-sky-400 font-semibold">
                🧼 {r.probes_handled_cleanly} Temiz
              </div>
              <div className="bg-amber-950/30 border border-amber-500/20 px-2.5 py-1.5 rounded-lg text-amber-400 font-semibold">
                ⚠️ {r.unhandled_500_crashes} 500 Çöküşü
              </div>
              <div className="bg-rose-950/30 border border-rose-500/20 px-2.5 py-1.5 rounded-lg text-rose-400 font-semibold">
                🚨 {r.stack_trace_leaks} Sızıntı
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Filtreler ve Arama Çubuğu ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === "ALL"
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            Tüm Problar ({r.total_probes_executed})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 text-xs">
            🔍
          </span>
          <input
            type="text"
            placeholder="Prob veya yük ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* ── 3. Sentetik Problar Matrisi Tablosu ──────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Kategori & Prob</th>
              <th className="py-3 px-3">Vektör</th>
              <th className="py-3 px-3">Sentetik Yük (Payload)</th>
              <th className="py-3 px-3 text-center">HTTP Durum</th>
              <th className="py-3 px-3 text-center">Süre</th>
              <th className="py-3 px-4">Sunucu / WAF Yanıtı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredProbes.map((p: WAFProbeResult, idx: number) => {
              const cfg = STATUS_CONFIG[p.probe_status];
              return (
                <tr
                  key={idx}
                  className="hover:bg-slate-800/40 transition-colors font-mono"
                >
                  <td className="py-3 px-4 font-sans">
                    <div className="font-bold text-white text-xs">{p.probe_name}</div>
                    <div className="text-[11px] text-slate-400">{p.category}</div>
                  </td>

                  <td className="py-3 px-3 text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] border border-slate-700">
                      {p.target_vector}
                    </span>
                  </td>

                  <td className="py-3 px-3 max-w-xs truncate text-amber-300 font-mono text-[11px]" title={p.payload_sample}>
                    {p.payload_sample}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        p.status_code === 403
                          ? "bg-emerald-500/10 text-emerald-400"
                          : p.status_code === 400
                          ? "bg-sky-500/10 text-sky-400"
                          : p.status_code >= 500
                          ? "bg-rose-500/20 text-rose-400 font-black"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      HTTP {p.status_code}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center text-slate-400">
                    {p.response_time_ms} ms
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${cfg.badge} self-start`}
                      >
                        <span>{cfg.icon}</span>
                        <span>{lang === "tr" ? cfg.labelTr : cfg.labelEn}</span>
                      </span>

                      {p.detected_leakage && (
                        <span className="text-[10px] text-rose-400 font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
                          İç İfşa: {p.detected_leakage}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── 4. Kurumsal Güvenlik ve İyileştirme Matrisi ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WAF Güçlendirme */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
            <span>🛡️</span>
            <span>WAF Ağ Kenarı (Edge) Koruma Kuralı</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Uygulamanın önüne Cloudflare WAF veya AWS WAF kuralları ekleyerek SQLi ve XSS desenlerini uygulama sunucusuna ulaşmadan <strong>HTTP 403</strong> ile engelleyin.
          </p>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
            # Cloudflare Managed Ruleset: Enabled<br />
            # OWASP Core Ruleset (CRS): Paranoia Level 2<br />
            # Action: Block (403 Forbidden)
          </div>
        </div>

        {/* Global Exception Handler */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <span>🧼</span>
            <span>Genel İstisna Yakalayıcı (Global Error Handler)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Backend kodunuzda yakalanmayan hataların ekrana stack trace basmasını engelleyin. Kullanıcıya her zaman standart, temiz bir JSON/HTML dönün.
          </p>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
            // Express.js / Node.js<br />
            app.use((err, req, res, next) =&gt; &#123;<br />
            &nbsp;&nbsp;logger.error(err);<br />
            &nbsp;&nbsp;res.status(500).json(&#123; error: &quot;Sunucu hatası oluştu.&quot; &#125;);<br />
            &#125;);
          </div>
        </div>
      </div>
    </div>
  );
}

