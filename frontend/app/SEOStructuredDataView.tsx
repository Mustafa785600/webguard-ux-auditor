"use client";

import React, { useState } from "react";
import {
  SEOStructuredDataReport,
  StructuredDataType,
  SocialCardPreview,
} from "../types/scan";

interface SEOStructuredDataViewProps {
  report?: SEOStructuredDataReport;
  lang?: string;
}

export default function SEOStructuredDataView({
  report,
  lang = "tr",
}: SEOStructuredDataViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "PREVIEWS" | "TAGS" | "SCHEMA" | "DEFECTS" | "CODE"
  >("PREVIEWS");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("Google SERP");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [defectFilter, setDefectFilter] = useState<string>("ALL");

  if (!report) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        Bu tarama için SEO ve yapısal veri raporu henüz oluşturulmadı.
      </div>
    );
  }

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400 border-emerald-500/30 bg-emerald-950/20";
    if (score >= 70) return "text-amber-400 border-amber-500/30 bg-amber-950/20";
    return "text-rose-400 border-rose-500/30 bg-rose-950/20";
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "HIGH":
        return "bg-orange-500/20 text-orange-300 border-orange-500/40";
      case "MEDIUM":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      default:
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    }
  };

  const filteredDefects = report.defects.filter((d) => {
    if (defectFilter === "ALL") return true;
    return d.severity === defectFilter;
  });

  const currentPreview = report.social_previews.find((p) => p.platform === selectedPlatform) || report.social_previews[0];

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏷️</span>
              <h2 className="text-xl font-bold text-slate-100">
                SEO & Sosyal Paylaşım Yapısal Veri Denetleyicisi
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Google Rich Results, Schema.org (JSON-LD), OpenGraph ve Twitter Card etiketlerinin sözdizimsel doğruluğunu ve sosyal önizlemelerini inceler.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {report.google_rich_result_eligible ? (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-semibold">
                <span>✓</span> Google Zengin Sonuçlara Uygun
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/40 font-semibold">
                <span>⚠️</span> Zengin Sonuç Eksiklikleri Var
              </span>
            )}
            <span className="px-3 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Open Graph Protocol (ogp.me)
            </span>
          </div>
        </div>

        {/* Metrik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className={`border rounded-xl p-4 ${getScoreColor(report.seo_health_score)}`}>
            <div className="text-xs font-medium opacity-80">SEO & Veri Sağlık Skoru</div>
            <div className="text-3xl font-black mt-1">
              {report.seo_health_score}<span className="text-base font-normal">/100</span>
            </div>
            <div className="text-xs opacity-75 mt-1">
              {report.seo_health_score >= 90 ? "Mükemmel Yapılandırma" : report.seo_health_score >= 70 ? "Kabul Edilebilir" : "İyileştirme Gerekli"}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-medium">Schema.org Varlıkları</div>
            <div className="text-3xl font-black text-slate-100 mt-1">
              {report.schema_entities.length}
            </div>
            <div className="text-xs text-cyan-400 mt-1">
              {report.schema_entities.map((e) => e.schema_type).join(", ") || "Tanımlanmadı"}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-medium">Toplam Kusur Sayısı</div>
            <div className="text-3xl font-black text-rose-400 mt-1">
              {report.total_defects_count}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {report.defects.filter((d) => d.severity === "HIGH" || d.severity === "CRITICAL").length} Kritik / Yüksek
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-medium">Sosyal Etiketler</div>
            <div className="text-3xl font-black text-indigo-400 mt-1">
              {Object.keys(report.open_graph_tags).length + Object.keys(report.twitter_tags).length}
            </div>
            <div className="text-xs text-indigo-400/70 mt-1">
              {Object.keys(report.open_graph_tags).length} OG • {Object.keys(report.twitter_tags).length} Twitter
            </div>
          </div>
        </div>
      </div>

      {/* Alt Sekme Barı */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-xl p-2">
        <button
          onClick={() => setActiveSubTab("PREVIEWS")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === "PREVIEWS"
              ? "bg-cyan-500 text-slate-950 shadow-sm"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>📱</span>
          <span>Sosyal Önizleme & SERP ({report.social_previews.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("TAGS")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === "TAGS"
              ? "bg-cyan-500 text-slate-950 shadow-sm"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>📊</span>
          <span>Meta & Etiket Denetçisi</span>
        </button>

        <button
          onClick={() => setActiveSubTab("SCHEMA")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === "SCHEMA"
              ? "bg-cyan-500 text-slate-950 shadow-sm"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>🧩</span>
          <span>Schema.org JSON-LD ({report.schema_entities.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("DEFECTS")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === "DEFECTS"
              ? "bg-cyan-500 text-slate-950 shadow-sm"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>⚠️</span>
          <span>Kusurlar & Fırsatlar ({report.defects.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("CODE")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === "CODE"
              ? "bg-cyan-500 text-slate-950 shadow-sm"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <span>💻</span>
          <span>Hazır Kod Şablonları</span>
        </button>
      </div>

      {/* 1. SEKME: SOSYAL ÖNİZLEME & SERP SİMÜLATÖRÜ */}
      {activeSubTab === "PREVIEWS" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-200">
                Sosyal Paylaşım & Arama Motoru Önizleme Simülatörü
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Kullanıcılar sitenizin bağlantısını paylaştığında veya Google'da aradığında beliren kart önizlemesi.
              </p>
            </div>

            {/* Platform Seçici */}
            <div className="flex items-center gap-1.5">
              {report.social_previews.map((preview) => (
                <button
                  key={preview.platform}
                  onClick={() => setSelectedPlatform(preview.platform)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedPlatform === preview.platform
                      ? "bg-slate-100 text-slate-900 shadow"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {preview.platform}
                </button>
              ))}
            </div>
          </div>

          {/* Canlı Mockup Alanı */}
          <div className="max-w-2xl mx-auto">
            {/* GOOGLE SERP MOCKUP */}
            {selectedPlatform === "Google SERP" && (
              <div className="bg-[#202124] border border-slate-700 rounded-xl p-5 shadow-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px]">🌐</span>
                  <span className="truncate">{currentPreview.display_url}</span>
                  <span className="text-[10px] text-slate-500">› index</span>
                </div>
                <div className="text-lg font-medium text-[#8ab4f8] hover:underline cursor-pointer leading-snug">
                  {currentPreview.title}
                </div>
                <div className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-2">
                  {currentPreview.description}
                </div>
              </div>
            )}

            {/* FACEBOOK / LINKEDIN MOCKUP */}
            {selectedPlatform === "Facebook / LinkedIn" && (
              <div className="bg-[#242526] border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                {currentPreview.image_url ? (
                  <div className="w-full h-56 bg-slate-800 relative flex items-center justify-center overflow-hidden border-b border-slate-700">
                    <img
                      src={currentPreview.image_url}
                      alt={currentPreview.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs bg-slate-800/80">
                      Görsel: {currentPreview.image_url}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-40 bg-slate-800 flex items-center justify-center text-slate-500 text-xs">
                    ⚠️ og:image bulunamadı (Görselsiz Kart)
                  </div>
                )}
                <div className="p-3.5 space-y-1 bg-[#242526]">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold truncate">
                    {currentPreview.display_url}
                  </div>
                  <div className="text-sm font-bold text-slate-100 line-clamp-1">
                    {currentPreview.title}
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-2">
                    {currentPreview.description}
                  </div>
                </div>
              </div>
            )}

            {/* TWITTER / X MOCKUP */}
            {selectedPlatform === "Twitter / X" && (
              <div className="bg-black border border-slate-800 rounded-2xl overflow-hidden shadow-2xl max-w-lg mx-auto">
                {currentPreview.image_url ? (
                  <div className="w-full h-48 bg-slate-900 relative flex items-center justify-center overflow-hidden border-b border-slate-800">
                    <img
                      src={currentPreview.image_url}
                      alt={currentPreview.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs bg-slate-900/80">
                      {currentPreview.image_url}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-36 bg-slate-900 flex items-center justify-center text-slate-500 text-xs">
                    ⚠️ twitter:image eksik
                  </div>
                )}
                <div className="p-3 bg-black space-y-0.5">
                  <div className="text-[11px] text-slate-500 truncate">{currentPreview.display_url}</div>
                  <div className="text-xs font-bold text-slate-200 line-clamp-1">{currentPreview.title}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-2">{currentPreview.description}</div>
                </div>
              </div>
            )}

            {/* SLACK / DISCORD MOCKUP */}
            {selectedPlatform === "Slack / Discord" && (
              <div className="bg-[#2B2D31] border-l-4 border-l-cyan-500 rounded-lg p-3 text-xs shadow-2xl space-y-2">
                <div className="text-[11px] font-semibold text-slate-400">{currentPreview.display_url}</div>
                <div className="font-bold text-cyan-400 text-sm hover:underline cursor-pointer">
                  {currentPreview.title}
                </div>
                <div className="text-slate-300 leading-relaxed">
                  {currentPreview.description}
                </div>
                {currentPreview.image_url && (
                  <div className="w-32 h-20 rounded bg-slate-800 overflow-hidden mt-1 border border-slate-700">
                    <img
                      src={currentPreview.image_url}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SEKME: META & ETİKET DENETÇİSİ */}
      {activeSubTab === "TAGS" && (
        <div className="space-y-6">
          {/* Temel SEO Parametreleri */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200">
              Temel Arama Motoru İndeksleme Parametreleri
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Canonical URL */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Canonical URL (&lt;link rel="canonical"&gt;)</span>
                  <span className={report.canonical_url ? "text-emerald-400" : "text-rose-400"}>
                    {report.canonical_url ? "✓ Tanımlı" : "✗ Eksik"}
                  </span>
                </div>
                <code className="block text-cyan-300 font-mono text-[11px] truncate mt-1">
                  {report.canonical_url || "Tanımlanmamış"}
                </code>
              </div>

              {/* Meta Robots */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Meta Robots (&lt;meta name="robots"&gt;)</span>
                  <span className={report.meta_robots && report.meta_robots.includes("noindex") ? "text-rose-400 font-bold" : "text-emerald-400"}>
                    {report.meta_robots || "index, follow (Varsayılan)"}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  {report.meta_robots && report.meta_robots.includes("noindex")
                    ? "⚠️ noindex direktifi arama motorlarını engelliyor!"
                    : "Sayfa arama motorları tarafından dizine eklenebilir."}
                </div>
              </div>

              {/* Sayfa Başlığı (<title>) */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Sayfa Başlığı (&lt;title&gt;)</span>
                  <span className="text-slate-300">
                    {report.title_tag ? `${report.title_tag.length} karakter` : "Eksik"}
                  </span>
                </div>
                <div className="text-slate-200 font-medium truncate mt-1">
                  {report.title_tag || "Başlık etiketi bulunamadı"}
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full ${
                      (report.title_tag?.length || 0) >= 30 && (report.title_tag?.length || 0) <= 60
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, ((report.title_tag?.length || 0) / 70) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500">İdeal SERP aralığı: 30 - 60 karakter</div>
              </div>

              {/* Meta Description */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Meta Açıklaması (&lt;meta name="description"&gt;)</span>
                  <span className="text-slate-300">
                    {report.meta_description ? `${report.meta_description.length} karakter` : "Eksik"}
                  </span>
                </div>
                <div className="text-slate-200 text-[11px] line-clamp-2 mt-1">
                  {report.meta_description || "Meta açıklama bulunamadı"}
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full ${
                      (report.meta_description?.length || 0) >= 120 && (report.meta_description?.length || 0) <= 160
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, ((report.meta_description?.length || 0) / 165) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500">İdeal SERP aralığı: 120 - 160 karakter</div>
              </div>
            </div>
          </div>

          {/* OpenGraph ve Twitter Etiket Tablosu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>OpenGraph (og:*) Etiketleri</span>
                <span className="text-[10px] text-cyan-400">{Object.keys(report.open_graph_tags).length} Etiket</span>
              </h4>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {Object.keys(report.open_graph_tags).length === 0 ? (
                  <div className="text-xs text-slate-500 p-2">Hiçbir og:* etiketi bulunamadı.</div>
                ) : (
                  Object.entries(report.open_graph_tags).map(([key, val]) => (
                    <div key={key} className="bg-slate-950/60 p-2 rounded text-xs flex flex-col gap-0.5 border border-slate-800/80">
                      <span className="text-indigo-300 font-semibold font-mono text-[11px]">og:{key}</span>
                      <span className="text-slate-300 truncate">{val}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Twitter Card (twitter:*) Etiketleri</span>
                <span className="text-[10px] text-cyan-400">{Object.keys(report.twitter_tags).length} Etiket</span>
              </h4>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {Object.keys(report.twitter_tags).length === 0 ? (
                  <div className="text-xs text-slate-500 p-2">Hiçbir twitter:* etiketi bulunamadı.</div>
                ) : (
                  Object.entries(report.twitter_tags).map(([key, val]) => (
                    <div key={key} className="bg-slate-950/60 p-2 rounded text-xs flex flex-col gap-0.5 border border-slate-800/80">
                      <span className="text-sky-300 font-semibold font-mono text-[11px]">twitter:{key}</span>
                      <span className="text-slate-300 truncate">{val}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SEKME: SCHEMA.ORG JSON-LD VARLIKLARI */}
      {activeSubTab === "SCHEMA" && (
        <div className="space-y-4">
          {report.schema_entities.length === 0 ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
              Bu sayfada hiçbir Schema.org JSON-LD (&lt;script type="application/ld+json"&gt;) bloğu bulunamadı.
            </div>
          ) : (
            report.schema_entities.map((entity) => (
              <div
                key={entity.entity_id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧩</span>
                    <span className="font-bold text-slate-200 text-sm">
                      Schema.org / {entity.schema_type}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${
                        entity.is_valid
                          ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                          : "bg-rose-950 text-rose-300 border-rose-500/40"
                      }`}
                    >
                      {entity.is_valid ? "✓ Doğrulandı (Valid)" : "✗ Hatalı / Eksik"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{entity.entity_id}</span>
                </div>

                {entity.validation_errors.length > 0 && (
                  <div className="bg-rose-950/30 border border-rose-900/50 rounded-lg p-3 text-xs text-rose-300 space-y-1">
                    <div className="font-semibold">Doğrulama Hataları:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {entity.validation_errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <div className="text-xs text-slate-400 font-semibold mb-1">JSON-LD Özellikleri:</div>
                  <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto border border-slate-800">
                    {JSON.stringify(entity.raw_properties, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. SEKME: KUSURLAR & FIRSATLAR LİSTESİ */}
      {activeSubTab === "DEFECTS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-xs text-slate-400 font-semibold">Kritiklik Filtresi:</span>
            <div className="flex items-center gap-1.5">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setDefectFilter(sev)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    defectFilter === sev
                      ? "bg-slate-200 text-slate-900"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {filteredDefects.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-emerald-400 font-semibold">
              ✓ Harika! Seçilen filtrede hiçbir SEO veya yapısal veri kusuru bulunamadı.
            </div>
          ) : (
            filteredDefects.map((defect) => (
              <div
                key={defect.defect_id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-full ${getSeverityBadge(defect.severity)}`}>
                      {defect.severity}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                      {defect.data_type}
                    </span>
                    <span className="font-bold text-slate-200 text-sm">{defect.title}</span>
                  </div>
                  <code className="text-[11px] text-slate-500">{defect.defect_id}</code>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {defect.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400 font-medium">Hedef Etiket:</span>{" "}
                    <code className="text-slate-200 font-mono">{defect.element_tag}</code>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Mevcut Değer:</span>{" "}
                    <span className="text-rose-400">{defect.actual_value || "Tanımsız"}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-400 font-medium">Beklenen Standart:</span>{" "}
                    <span className="text-emerald-400">{defect.expected_format}</span>
                  </div>
                </div>

                <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-lg p-3 text-xs text-cyan-300">
                  <strong className="text-cyan-200">Çözüm / Remediation:</strong> {defect.remediation}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 5. SEKME: HAZIR KOD ŞABLONLARI */}
      {activeSubTab === "CODE" && (
        <div className="space-y-6">
          {/* Next.js 14/15/16 Metadata API */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200">
                  Next.js App Router (14 / 15 / 16) Metadata API
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  <code>app/layout.tsx</code> veya <code>app/page.tsx</code> dosyasına drop-in olarak ekleyin.
                </p>
              </div>
              <button
                onClick={() => handleCopy("next-meta", report.recommended_nextjs_metadata_code)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow"
              >
                {copiedKey === "next-meta" ? "✓ Kopyalandı!" : "Kodu Kopyala"}
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto border border-slate-800 max-h-72">
              {report.recommended_nextjs_metadata_code}
            </pre>
          </div>

          {/* JSON-LD Script Şablonu */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200">
                  Schema.org JSON-LD Bileşen Şablonu
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Google Knowledge Graph ve Rich Results için sayfanıza güvenli şekilde yerleştirin.
                </p>
              </div>
              <button
                onClick={() => handleCopy("jsonld-meta", report.recommended_json_ld_code)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow"
              >
                {copiedKey === "jsonld-meta" ? "✓ Kopyalandı!" : "Kodu Kopyala"}
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto border border-slate-800 max-h-60">
              {report.recommended_json_ld_code}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
