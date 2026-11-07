"use client";

import { useState, useEffect, useMemo } from "react";
import type {
  CodebaseIntelligenceReport,
  CodeSymbolNode,
  ArchitectureLayer,
  FullStackFlow,
} from "@/types/scan";
import { getCodebaseIntelligence } from "@/lib/api";

interface CodebaseIntelligenceViewProps {
  initialReport?: CodebaseIntelligenceReport | null;
}

const LAYER_CONFIG: Record<
  ArchitectureLayer,
  { label: string; icon: string; bg: string; border: string; text: string; badge: string }
> = {
  FRONTEND_UI: {
    label: "Frontend & UI",
    icon: "🎨",
    bg: "bg-sky-950/20",
    border: "border-sky-500/30",
    text: "text-sky-400",
    badge: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  },
  API_CONTROLLER: {
    label: "API Kontrolcüleri",
    icon: "⚡",
    bg: "bg-amber-950/20",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  },
  SERVICE_LOGIC: {
    label: "İş Mantığı & Servisler",
    icon: "⚙️",
    bg: "bg-emerald-950/20",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  },
  SECURITY_GUARD: {
    label: "Güvenlik & Savunma",
    icon: "🛡️",
    bg: "bg-rose-950/20",
    border: "border-rose-500/30",
    text: "text-rose-400",
    badge: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  },
  DATA_MODEL: {
    label: "Veri Modelleri (Schema)",
    icon: "📦",
    bg: "bg-purple-950/20",
    border: "border-purple-500/30",
    text: "text-purple-400",
    badge: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  },
  INFRA_CONFIG: {
    label: "Altyapı & Yapılandırma",
    icon: "🔧",
    bg: "bg-slate-900/40",
    border: "border-slate-700/40",
    text: "text-slate-300",
    badge: "bg-slate-800 text-slate-300 border-slate-700",
  },
};

export default function CodebaseIntelligenceView({
  initialReport,
}: CodebaseIntelligenceViewProps) {
  const [report, setReport] = useState<CodebaseIntelligenceReport | null>(initialReport ?? null);
  const [loading, setLoading] = useState<boolean>(!initialReport);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedLayer, setSelectedLayer] = useState<string>("ALL");
  const [selectedSymbol, setSelectedSymbol] = useState<CodeSymbolNode | null>(null);
  const [activeTab, setActiveTab] = useState<"SYMBOLS" | "FLOWS" | "PIPELINE">("SYMBOLS");

  useEffect(() => {
    if (!report) {
      setLoading(true);
      getCodebaseIntelligence()
        .then((data) => {
          setReport(data);
          if (data.symbols?.length > 0) {
            setSelectedSymbol(data.symbols[0]);
          }
        })
        .catch((err) => {
          console.error("Codebase intelligence fetch failed:", err);
        })
        .finally(() => setLoading(false));
    } else if (!selectedSymbol && report.symbols?.length > 0) {
      setSelectedSymbol(report.symbols[0]);
    }
  }, [report, selectedSymbol]);

  const filteredSymbols = useMemo(() => {
    if (!report?.symbols) return [];
    return report.symbols.filter((sym) => {
      const matchesSearch =
        sym.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sym.file_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sym.purpose_summary.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLayer = selectedLayer === "ALL" || sym.layer === selectedLayer;
      return matchesSearch && matchesLayer;
    });
  }, [report, searchQuery, selectedLayer]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-mono text-slate-400">
          Kod tabanı AST hiyerarşisi taranıyor ve mimari bağlantılar çözümleniyor...
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800">
        <p className="text-rose-400 text-sm font-semibold">
          Kod tabanı mimari zeka raporu yüklenemedi. Backend servisinin çalıştığından emin olun.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Mimari Sağlık ve İstatistik Başlığı ───────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧠</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                Bütünsel Kod Tabanı ve Mimari Zeka Motoru
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                A+ Bütünsel Kavrama
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl leading-relaxed">
              Tüm projenin kaynak kodlarını tek parça halinde kavrar. Her bir kod bloğunun neden yazıldığını,
              servisler arası çağrı hiyerarşisini, uçtan uca veri akışlarını ve değişiklik etki alanını (blast radius)
              otonom olarak haritalar.
            </p>
          </div>

          {/* Hızlı Sağlık Göstergesi */}
          <div className="flex items-center gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-2xl font-black text-emerald-400">
                {report.architectural_health_score}/100
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Mimari Sağlık
              </div>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-xl font-bold text-white">{report.total_files}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Dosya
              </div>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-xl font-bold text-sky-400">
                {report.total_lines_of_code.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Satır (LOC)
              </div>
            </div>
            <div className="text-center px-3">
              <div className="text-xl font-bold text-indigo-400">{report.total_symbols}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Sembol/Bileşen
              </div>
            </div>
          </div>
        </div>

        {/* Framework Etiketleri */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Bağlantılı Teknolojiler:</span>
          {report.detected_frameworks?.map((fw) => (
            <span
              key={fw}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800/80 text-slate-300 border border-slate-700"
            >
              {fw}
            </span>
          ))}
        </div>
      </div>

      {/* ── 2. Görünüm Sekmeleri (Semboller / Sistem Akışları / Mimari Boru Hattı) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("SYMBOLS")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "SYMBOLS"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            🧩 Sembol ve Kod Müfettişi ({report.total_symbols})
          </button>
          <button
            onClick={() => setActiveTab("FLOWS")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "FLOWS"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            🔄 Uçtan Uca Sistem Akışları ({report.full_stack_flows?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("PIPELINE")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "PIPELINE"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            🏛️ 5 Katmanlı Mimari Boru Hattı
          </button>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            getCodebaseIntelligence().then((d) => {
              setReport(d);
              setLoading(false);
            });
          }}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700 transition"
        >
          <span>↻</span> Yeniden Tara
        </button>
      </div>

      {/* ── TAB 1: SEMBOL VE KOD MÜFETTİŞİ (Neden Yazıldı? & Etki Alanı) ── */}
      {activeTab === "SYMBOLS" && (
        <div className="space-y-4">
          {/* Arama & Katman Filtreleri */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="Kod adına, fonksiyona, dosyaya veya amaca göre ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedLayer("ALL")}
                className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedLayer === "ALL"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                Hepsi ({report.symbols.length})
              </button>
              {(Object.keys(LAYER_CONFIG) as ArchitectureLayer[]).map((layer) => {
                const cfg = LAYER_CONFIG[layer];
                const count = report.layer_distribution?.[layer] ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={layer}
                    onClick={() => setSelectedLayer(layer)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
                      selectedLayer === layer
                        ? `${cfg.badge} border shadow-sm`
                        : "bg-slate-900 text-slate-400 hover:text-white border border-transparent"
                    }`}
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.label}</span>
                    <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* İki Panel: Sol Liste + Sağ Detay & Etki Alanı */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sol Liste */}
            <div className="lg:col-span-5 space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {filteredSymbols.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-slate-800 text-slate-500 text-sm">
                  Aramanıza uygun sembol bulunamadı.
                </div>
              ) : (
                filteredSymbols.map((sym) => {
                  const cfg = LAYER_CONFIG[sym.layer] || LAYER_CONFIG.INFRA_CONFIG;
                  const isSelected = selectedSymbol?.id === sym.id;
                  return (
                    <div
                      key={sym.id}
                      onClick={() => setSelectedSymbol(sym)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/50"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-white truncate">
                          {sym.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${cfg.badge}`}
                        >
                          {cfg.icon} {sym.symbol_type}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-slate-400 truncate font-mono">
                        {sym.file_path}:{sym.line_start}
                      </div>

                      <p className="mt-2 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {sym.purpose_summary}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Etki Alanı: {sym.blast_radius_score}</span>
                        <span>Çağrılan: {sym.calls?.length || 0} | Çağıran: {sym.called_by?.length || 0}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sağ Detay & Mimari Amaç & Etki Alanı Kartı */}
            <div className="lg:col-span-7">
              {selectedSymbol ? (
                <div className="sticky top-6 rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-6 shadow-xl">
                  {/* Başlık ve Katman */}
                  <div className="border-b border-slate-800 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {LAYER_CONFIG[selectedSymbol.layer]?.icon || "📦"}
                        </span>
                        <h3 className="text-lg font-bold font-mono text-white">
                          {selectedSymbol.name}
                        </h3>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          LAYER_CONFIG[selectedSymbol.layer]?.badge || "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {LAYER_CONFIG[selectedSymbol.layer]?.label}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span>📁 {selectedSymbol.file_path}</span>
                      <span>•</span>
                      <span>Satır: {selectedSymbol.line_start} - {selectedSymbol.line_end}</span>
                    </div>
                  </div>

                  {/* Neden Yazıldı? (Mimari Amaç) */}
                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                      <span>💡</span>
                      <span>Neden Yazıldı? (Mimari Amaç & Varoluş Nedeni)</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed font-sans">
                      {selectedSymbol.purpose_summary}
                    </p>
                  </div>

                  {/* Değişiklik Etki Alanı (Blast Radius Analysis) */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                        <span>💥</span>
                        <span>Değişiklik Etki Alanı (Blast Radius)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Skor: {selectedSymbol.blast_radius_score}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Bu sembolde veya fonksiyonda yapılacak olası bir refactor veya imza değişikliğinde
                      sistemin ne kadarının etkileneceğini gösterir.
                    </p>

                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedSymbol.blast_radius_score > 15
                            ? "bg-rose-500"
                            : selectedSymbol.blast_radius_score > 7
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(100, selectedSymbol.blast_radius_score * 4)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Bağlantılı Noktalar: Kimleri Çağırıyor / Kimler Çağırıyor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bağımlı Olduğu Çağrılar */}
                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                        <span>🔗 Çağırdığı Bileşenler</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {selectedSymbol.calls?.length || 0}
                        </span>
                      </div>
                      {selectedSymbol.calls?.length > 0 ? (
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {selectedSymbol.calls.map((c, i) => (
                            <div
                              key={i}
                              className="text-xs font-mono text-sky-400 bg-sky-950/30 px-2 py-1 rounded border border-sky-500/20 truncate"
                            >
                              ➔ {c}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-2">
                          Doğrudan dış çağrı yapmıyor (Yaprak Düğüm).
                        </div>
                      )}
                    </div>

                    {/* Bunu Çağıranlar (Upstream Invocations) */}
                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                        <span>🎯 Bunu Çağıran Üst Sistemler</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {selectedSymbol.called_by?.length || 0}
                        </span>
                      </div>
                      {selectedSymbol.called_by?.length > 0 ? (
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {selectedSymbol.called_by.map((cb, i) => (
                            <div
                              key={i}
                              className="text-xs font-mono text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-500/20 truncate"
                            >
                              ⬅ {cb}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-2">
                          Giriş noktası veya bağımsız kontrolcü.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-900/30 rounded-2xl border border-slate-800 text-slate-500">
                  İncelemek için sol taraftan bir sembol seçin.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: UÇTAN UCA SİSTEM AKIŞLARI (FULL-STACK FLOWS) ────────── */}
      {activeTab === "FLOWS" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Sistemdeki ana işlevlerin kullanıcı arayüzünden backend servislerine ve veri modellerine kadar
            nasıl bir bütün halinde çalıştığını gösteren uçtan uca mimari akışlar:
          </p>

          <div className="grid grid-cols-1 gap-4">
            {report.full_stack_flows?.map((flow: FullStackFlow) => (
              <div
                key={flow.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition-all space-y-4 shadow-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🌊</span>
                    <h3 className="font-bold text-white text-base">{flow.flow_name}</h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                    {flow.api_route}
                  </span>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">{flow.description}</p>

                {/* Akış Adımları Boru Hattı */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Boru Hattı Yürütme Sırası (Pipeline Sequence):
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-mono bg-sky-950/40 text-sky-300 border border-sky-500/30">
                      🎨 {flow.entry_point}
                    </span>
                    <span className="text-slate-600 font-bold">➔</span>
                    <span className="px-3 py-1.5 rounded-lg text-xs font-mono bg-amber-950/40 text-amber-300 border border-amber-500/30">
                      ⚡ {flow.api_route}
                    </span>
                    <span className="text-slate-600 font-bold">➔</span>
                    {flow.service_pipeline?.map((srv, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                          ⚙️ {srv}
                        </span>
                        {idx < flow.service_pipeline.length - 1 && (
                          <span className="text-slate-600 font-bold">➔</span>
                        )}
                      </div>
                    ))}
                    <span className="text-slate-600 font-bold">➔</span>
                    <span className="px-3 py-1.5 rounded-lg text-xs font-mono bg-purple-950/40 text-purple-300 border border-purple-500/30">
                      📦 {flow.model_schema}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: 5 KATMANLI MİMARİ BORU HATTI (LAYER VIEW) ──────────── */}
      {activeTab === "PIPELINE" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Sistemin 5 katmanlı modüler mimarisi. Her katman bağımsız olarak test edilebilir,
            değiştirilebilir ve genişletilebilir:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {(
              [
                "FRONTEND_UI",
                "API_CONTROLLER",
                "SECURITY_GUARD",
                "SERVICE_LOGIC",
                "DATA_MODEL",
              ] as ArchitectureLayer[]
            ).map((layer) => {
              const cfg = LAYER_CONFIG[layer];
              const layerSymbols = report.symbols.filter((s) => s.layer === layer);

              return (
                <div
                  key={layer}
                  className={`rounded-2xl border p-4 space-y-3 ${cfg.bg} ${cfg.border}`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span>{cfg.icon}</span>
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>
                        {cfg.label}
                      </h4>
                    </div>
                    <span className="text-xs font-mono text-slate-400">({layerSymbols.length})</span>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {layerSymbols.map((sym) => (
                      <div
                        key={sym.id}
                        onClick={() => {
                          setSelectedSymbol(sym);
                          setActiveTab("SYMBOLS");
                        }}
                        className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 hover:border-indigo-500/60 cursor-pointer transition text-left group"
                      >
                        <div className="font-mono text-xs font-bold text-white group-hover:text-indigo-400 truncate">
                          {sym.name}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {sym.purpose_summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

