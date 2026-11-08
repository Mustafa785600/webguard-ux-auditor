"use client";

import { useState } from "react";
import type {
  MultiViewportReport,
  ViewportAuditResult,
  ResponsiveDefectItem,
  DeviceProfile,
} from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface MultiViewportViewProps {
  report?: MultiViewportReport | null;
  lang?: Language;
}

const DEVICE_ICONS: Record<DeviceProfile, string> = {
  MOBILE: "📱",
  TABLET: "📟",
  DESKTOP: "💻",
};

export default function MultiViewportView({
  report,
  lang = "tr",
}: MultiViewportViewProps) {
  const [selectedDevice, setSelectedDevice] = useState<DeviceProfile>("MOBILE");
  const [showFullScreenshot, setShowFullScreenshot] = useState<boolean>(false);

  if (!report || !report.tested_viewports || report.tested_viewports.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">📱</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr" ? "Çoklu Cihaz Denetim Verisi Bulunamadı" : "No Multi-Viewport Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için duyarlı tasarım (responsive layout) ve cihaz testleri henüz yürütülmedi veya hedef siteye erişilemedi."
            : "Multi-viewport responsive audit has not been executed for this scan yet or target was unreachable."}
        </p>
      </div>
    );
  }

  const r = report;
  const currentViewport: ViewportAuditResult =
    r.tested_viewports.find((v) => v.device === selectedDevice) || r.tested_viewports[0];

  const overallScoreColor =
    r.overall_responsive_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.overall_responsive_score >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  const currentScoreColor =
    currentViewport.score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : currentViewport.score >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık ve Genel Responsive Skor Özeti ─────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-sky-950/20 to-slate-900 border border-sky-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "Çoklu Cihaz ve Duyarlı Tasarım (Multi-Viewport)"
                  : "Multi-Viewport & Responsive Layout Auditor"}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold border bg-sky-500/10 text-sky-400 border-sky-500/30">
                WCAG 2.1 Reflow & Mobile-Friendly
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "Sitenin Mobil (390px), Tablet (768px) ve Masaüstü (1920px) ekranlarında yatay taşma (horizontal scroll overflow), dokunma alanı yetersizliği (< 44x44px) ve okunaksız küçük fontlar denetlenmiştir."
                : "Audits page layout across Mobile (390px), Tablet (768px), and Desktop (1920px) for horizontal scrollbar overflow, touch target sizing, and typography reflow compliance."}
            </p>

            {/* Temel Uyumluluk Rozetleri */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                  r.meta_viewport_tag_found
                    ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-950/30 border-rose-500/30 text-rose-300"
                }`}
              >
                <span>{r.meta_viewport_tag_found ? "✓" : "✗"}</span>
                <span>
                  {r.meta_viewport_tag_found
                    ? "Viewport Meta Etiketi Aktif"
                    : "Viewport Meta Etiketi Eksik"}
                </span>
              </div>

              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                  r.pinch_to_zoom_allowed
                    ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                    : "bg-amber-950/30 border-amber-500/30 text-amber-300"
                }`}
              >
                <span>{r.pinch_to_zoom_allowed ? "✓" : "⚠️"}</span>
                <span>
                  {r.pinch_to_zoom_allowed
                    ? "Pinch-to-Zoom (Yakınlaştırma) Serbest"
                    : "Yakınlaştırma Engellenmiş (user-scalable=no)"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 px-2.5 py-1 rounded-md text-slate-300">
                <span>🔍 Toplam Kusur:</span>
                <span className="font-bold text-white">{r.total_defects} Adet</span>
              </div>
            </div>
          </div>

          {/* Genel Skor Kartı */}
          <div className="flex items-center gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="text-center px-4 border-r border-slate-800">
              <div className={`text-3xl font-black ${overallScoreColor.split(" ")[0]}`}>
                {r.overall_responsive_score}/100
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                {lang === "tr" ? "Duyarlılık Skoru" : "Responsive Score"}
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              {r.tested_viewports.map((v) => (
                <div key={v.device} className="flex items-center justify-between gap-4 font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <span>{DEVICE_ICONS[v.device]}</span>
                    <span>{v.device}</span>
                  </span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      v.score >= 85
                        ? "text-emerald-400 bg-emerald-500/10"
                        : v.score >= 65
                        ? "text-amber-400 bg-amber-500/10"
                        : "text-rose-400 bg-rose-500/10"
                    }`}
                  >
                    {v.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Cihaz Seçim Sekmeleri (Device Switcher Tabs) ──────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {r.tested_viewports.map((v) => {
          const isActive = v.device === selectedDevice;
          return (
            <button
              key={v.device}
              type="button"
              onClick={() => setSelectedDevice(v.device)}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition border ${
                isActive
                  ? "bg-sky-600 text-white border-sky-500 shadow-lg shadow-sky-950/50"
                  : "bg-slate-900/80 text-slate-300 hover:text-white border-slate-800 hover:bg-slate-800/60"
              }`}
            >
              <span className="text-base">{DEVICE_ICONS[v.device]}</span>
              <span>{v.device_label}</span>
              <span className="text-[11px] font-mono opacity-80">({v.width}x{v.height})</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : v.score >= 85
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-amber-500/10 text-amber-400"
                }`}
              >
                {v.score}%
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 3. Aktif Cihaz Detay Kartı ve KPI Göstergeleri ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Yatay Taşma (Overflow)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-xl font-black ${
                currentViewport.horizontal_overflow_px > 0
                  ? "text-rose-400"
                  : "text-emerald-400"
              }`}
            >
              {currentViewport.horizontal_overflow_px === 0
                ? "0 px (Sıfır Taşma)"
                : `+${currentViewport.horizontal_overflow_px} px Taşma`}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {currentViewport.horizontal_overflow_px === 0
              ? "Sayfa genişliği viewport içine tam oturuyor."
              : "İstenmeyen yatay kaydırma çubuğu oluşuyor!"}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Dokunma Hedefleri (&gt;= 44px)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-xl font-black ${
                currentViewport.small_touch_targets_count > 0
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {currentViewport.small_touch_targets_count === 0
                ? "Tümü Uygun"
                : `${currentViewport.small_touch_targets_count} Küçük Öğe`}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Toplam {currentViewport.total_touch_targets_checked} etkileşimli buton/link denetlendi.
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Tipografi & Okunabilirlik
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-xl font-black ${
                currentViewport.small_fonts_count > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {currentViewport.small_fonts_count === 0
                ? "Okunaklı (&gt;= 12px)"
                : `${currentViewport.small_fonts_count} Küçük Yazı`}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            WCAG 1.4.4 metin ölçeklendirme standardı.
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Cihaz Uyumluluk Skoru
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-xl font-black ${currentScoreColor.split(" ")[0]}`}>
              {currentViewport.score}/100
            </span>
            <span className="text-xs text-slate-400">
              ({currentViewport.defects.length} Kusur)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {currentViewport.device_label}
          </div>
        </div>
      </div>

      {/* ── 4. Görsel Önizleme ve Kusur Listesi Grid ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sol Kolon: Cihaz Çerçevesi & Ekran Görüntüsü Snapshot (5 Kolon) */}
        <div className="lg:col-span-5 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">{DEVICE_ICONS[currentViewport.device]}</span>
              <span className="text-xs font-bold text-white">
                {currentViewport.device_label} Canlı Snapshot
              </span>
            </div>
            {currentViewport.screenshot_b64 && (
              <button
                type="button"
                onClick={() => setShowFullScreenshot(!showFullScreenshot)}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition"
              >
                {showFullScreenshot ? "🔍 Çerçeveye Sığdır" : "🔍 Tam Boyut"}
              </button>
            )}
          </div>

          {currentViewport.screenshot_b64 ? (
            <div
              className={`relative border-4 border-slate-800 rounded-3xl overflow-hidden shadow-2xl bg-slate-950 transition-all ${
                selectedDevice === "MOBILE"
                  ? "w-[280px] max-h-[560px]"
                  : selectedDevice === "TABLET"
                  ? "w-[360px] max-h-[500px]"
                  : "w-full max-h-[460px]"
              } ${showFullScreenshot ? "max-h-none overflow-y-auto" : "overflow-y-auto"}`}
            >
              {/* Cihaz Üst Çentiği (Mobile Notch) */}
              {selectedDevice === "MOBILE" && (
                <div className="sticky top-0 z-10 w-full h-4 bg-slate-900 flex justify-center items-center">
                  <div className="w-20 h-2 bg-slate-800 rounded-full" />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentViewport.screenshot_b64}
                alt={`${currentViewport.device_label} Render Snapshot`}
                className="w-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full h-72 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center text-slate-400 bg-slate-950/40">
              <span className="text-3xl mb-2">{DEVICE_ICONS[currentViewport.device]}</span>
              <p className="text-xs font-semibold text-slate-300">
                {currentViewport.device_label} Önizleme Çizimi
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                {currentViewport.width}px x {currentViewport.height}px çözünürlük simülasyonu başarıyla tamamlandı.
              </p>
            </div>
          )}
        </div>

        {/* Sağ Kolon: Tespit Edilen Kusurlar ve Çözüm Kodları (7 Kolon) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>⚠️</span>
                <span>
                  {currentViewport.device_label} İçin Tespit Edilen Kusurlar (
                  {currentViewport.defects.length})
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {currentViewport.width}px Viewport
              </span>
            </div>

            {currentViewport.defects.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <span className="text-2xl">🎉</span>
                <p className="text-xs font-semibold text-emerald-400">
                  {lang === "tr"
                    ? "Kusur Tespit Edilmedi! Tasarım bu cihaz için tam uyumludur."
                    : "No defects detected! Layout is fully responsive on this viewport."}
                </p>
                <p className="text-[11px] text-slate-400">
                  Yatay taşma yok, tüm dokunma hedefleri &gt;= 44px ve fontlar okunaklıdır.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {currentViewport.defects.map((defect, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="text-amber-400">●</span>
                        <span>{defect.defect_type}</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          defect.severity === "HIGH"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {defect.severity}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {defect.description}
                    </p>

                    {defect.selector && (
                      <div className="text-[11px] font-mono text-sky-300 bg-slate-900/80 px-2 py-1 rounded border border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
                        <span className="text-slate-400 font-sans">Hedef Element:</span>
                        <code>{defect.selector}</code>
                      </div>
                    )}

                    <div className="p-2.5 bg-sky-950/20 border border-sky-500/20 rounded-lg text-[11px] text-sky-200 leading-relaxed">
                      <strong className="text-sky-300">💡 Çözüm:</strong> {defect.recommended_fix}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duyarlı Tasarım CSS En İyi Uygulamaları (Best Practices) */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>🛠️</span> Kurumsal Duyarlı CSS Standartları
            </h4>
            <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              <code>{`/* 1. Sıfır Yatay Taşma Kuralı */
*, *::before, *::after {
  box-sizing: border-box;
}
img, video, canvas, svg {
  max-width: 100%;
  height: auto;
}

/* 2. WCAG 2.5.5 Dokunmatik Buton Standartları */
@media (pointer: coarse) {
  button, a, input, select {
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }
}`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
