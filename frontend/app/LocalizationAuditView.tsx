"use client";

import { useState } from "react";
import type {
  LocalizationAuditReport,
  LocalizationDefectItem,
  HreflangEntry,
} from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface LocalizationAuditViewProps {
  report?: LocalizationAuditReport | null;
  lang?: Language;
}

export default function LocalizationAuditView({
  report,
  lang = "tr",
}: LocalizationAuditViewProps) {
  const [activeTab, setActiveTab] = useState<"DEFECTS" | "HREFLANG" | "LOCALES" | "I18N_GUIDE">("DEFECTS");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">🌐</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr"
            ? "Lokalizasyon ve Çok Dilli Denetim Verisi Bulunamadı"
            : "No Localization & i18n Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için çok dilli altyapı, çevrilmemiş anahtarlar ve dil etiketleri henüz analiz edilmedi."
            : "Multi-language infrastructure, untranslated keys, and language tags have not been audited for this scan yet."}
        </p>
      </div>
    );
  }

  const r = report;

  const scoreColor =
    r.l10n_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.l10n_score >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık & Lokalizasyon Kalite Skoru ──────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-teal-950/20 to-slate-900 border border-teal-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "Çok Dilli (i18n) ve Lokalizasyon Kusurları Denetimi"
                  : "Localization & i18n Quality Auditor"}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold border bg-teal-500/10 text-teal-400 border-teal-500/30">
                W3C i18n & WCAG 3.1.1 Standardı
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "Kullanıcıya yansıyan çevrilmemiş i18n anahtar sızıntılarını (key leaks), HTML 'lang' ve BCP-47 standartlarını, sağdan sola (RTL) çift yönlü metin uyumunu ve çoklu bölge 'hreflang' etiketlerini otonom denetler."
                : "Audits untranslated i18n keys leaking to users, HTML 'lang' / BCP-47 tags, RTL layout readiness, and hreflang configuration."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "Beyan Edilen Dil:" : "Declared Language:"}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-teal-300 font-mono">
                {r.declared_lang ? `<html lang="${r.declared_lang}">` : "Eksik (Tanımsız)"}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "Metin Yönü:" : "Direction:"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]">
                {r.has_rtl_support ? "RTL (Sağdan Sola)" : "LTR (Soldan Sağa)"}
              </span>
            </div>
          </div>

          {/* L10n Skoru */}
          <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">
                {lang === "tr" ? "Lokalizasyon Kalite Skoru" : "Localization Score"}
              </div>
              <div className="text-2xl font-black text-white">{r.l10n_score} / 100</div>
            </div>
            <div
              className={`w-14 h-14 rounded-xl border flex items-center justify-center font-black text-xl shadow-lg ${scoreColor}`}
            >
              %{r.l10n_score}
            </div>
          </div>
        </div>

        {/* Özet Kartları */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">
              {lang === "tr" ? "Çevrilmemiş Anahtarlar" : "Untranslated Keys"}
            </div>
            <div className={`text-xl font-bold mt-1 ${r.untranslated_keys_count > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {r.untranslated_keys_count} {lang === "tr" ? "Sızıntı" : "Leaks"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">
              {lang === "tr" ? "HTML Lang Durumu" : "HTML Lang Status"}
            </div>
            <div className={`text-xl font-bold mt-1 ${r.declared_lang ? "text-emerald-400" : "text-rose-400"}`}>
              {r.declared_lang ? "Tanımlı" : "Eksik (Kusur)"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">
              {lang === "tr" ? "Hreflang Etiketleri" : "Hreflang Tags"}
            </div>
            <div className="text-xl font-bold mt-1 text-teal-400">
              {r.hreflang_tags.length} {lang === "tr" ? "Bölge" : "Regions"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">
              {lang === "tr" ? "Format / Biçim Kusurları" : "Format Defects"}
            </div>
            <div className={`text-xl font-bold mt-1 ${r.formatting_defects_count > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {r.formatting_defects_count} {lang === "tr" ? "Kusur" : "Defects"}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Sekme Butonları ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-800 space-x-2 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("DEFECTS")}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === "DEFECTS"
              ? "border-teal-500 text-teal-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          ⚠️ {lang === "tr" ? "Lokalizasyon Kusurları" : "L10n Defects"} ({r.defects.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("HREFLANG")}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === "HREFLANG"
              ? "border-teal-500 text-teal-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🔗 {lang === "tr" ? "Hreflang & Bölgeler" : "Hreflang Tags"} ({r.hreflang_tags.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("LOCALES")}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === "LOCALES"
              ? "border-teal-500 text-teal-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🌍 {lang === "tr" ? "Desteklenen Diller & RTL" : "Locales & RTL"} ({r.detected_languages.length || 1})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("I18N_GUIDE")}
          className={`pb-3 px-4 transition border-b-2 flex items-center gap-2 ${
            activeTab === "I18N_GUIDE"
              ? "border-teal-500 text-teal-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          💡 {lang === "tr" ? "i18n Çözüm & Kod Rehberi" : "i18n Code Guide"}
        </button>
      </div>

      {/* ── 3. Sekme İçerikleri ───────────────────────────────────────────── */}

      {/* SEKME 1: KUSURLAR VE SIZINTILAR */}
      {activeTab === "DEFECTS" && (
        <div className="space-y-4">
          {r.defects.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800 text-emerald-400">
              <span className="text-3xl">✅</span>
              <h4 className="text-base font-bold mt-2 text-white">
                {lang === "tr" ? "Kusursuz Lokalizasyon Altyapısı" : "Zero Localization Defects"}
              </h4>
              <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">
                {lang === "tr"
                  ? "Sayfada hiçbir çevrilmemiş anahtar sızıntısı bulunamadı, HTML lang özniteliği geçerli ve metin yönü standartlara uygun."
                  : "No untranslated keys, valid HTML lang attribute, and proper text direction."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {r.defects.map((defect, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          defect.severity === "HIGH"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : defect.severity === "MEDIUM"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {defect.severity}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-teal-300 border border-teal-500/30">
                        {defect.defect_type}
                      </span>
                    </div>

                    <span className="text-xs font-mono text-slate-400">
                      Konum: <strong className="text-slate-300">{defect.element_or_selector || "Sayfa Gövdesi"}</strong>
                    </span>
                  </div>

                  <p className="text-sm text-slate-300">{defect.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="relative p-3 rounded-xl bg-slate-950 border border-slate-800 text-rose-300">
                      <div className="text-[10px] text-slate-500 font-sans uppercase mb-1">
                        {lang === "tr" ? "Arayüzde Yakalanan Hatalı İfade:" : "Detected Defect:"}
                      </div>
                      <code>{defect.detected_snippet}</code>
                      <button
                        type="button"
                        onClick={() => handleCopy(defect.detected_snippet, `def-${idx}`)}
                        className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition"
                      >
                        {copiedIndex === `def-${idx}` ? "Kopyalandı!" : "Kopyala"}
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                      <div className="text-[10px] text-slate-500 font-sans uppercase mb-1">
                        {lang === "tr" ? "Beklenen Kurumsal Standart:" : "Expected Standard:"}
                      </div>
                      <span className="text-emerald-400">{defect.expected_standard}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-900/30 text-xs text-teal-200">
                    <strong>💡 {lang === "tr" ? "Düzeltme Adımı:" : "Remediation:"}</strong> {defect.remediation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEKME 2: HREFLANG VE ÇOKLU BÖLGE */}
      {activeTab === "HREFLANG" && (
        <div className="space-y-4">
          {r.hreflang_tags.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800 text-slate-400">
              <span className="text-3xl">🔗</span>
              <h4 className="text-base font-bold mt-2 text-white">
                {lang === "tr" ? "Hreflang Alternatif Etiketi Tanımlanmamış" : "No Hreflang Tags Found"}
              </h4>
              <p className="text-sm mt-1 max-w-lg mx-auto">
                {lang === "tr"
                  ? "Siteniz tek dilli bir yapıya sahip olabilir veya küresel arama motorları için <link rel='alternate' hreflang='xx'> etiketleri henüz eklenmemiş."
                  : "Single language site or missing alternate hreflang tags for regional SEO."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {r.hreflang_tags.map((tag, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/30 font-mono text-xs font-bold">
                      hreflang="{tag.locale}"
                    </span>
                    <span className="text-xs font-mono text-slate-300 truncate max-w-lg">
                      {tag.url}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      tag.is_valid
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {tag.is_valid ? "BCP-47 Geçerli" : "Format Hatası"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEKME 3: DESTEKLENEN DİLLER & RTL */}
      {activeTab === "LOCALES" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🌍</span> {lang === "tr" ? "Algılanan Diller & Çoklu Dil Mimarisi" : "Detected Locales & Multi-Language"}
            </h4>

            <div className="flex flex-wrap gap-2">
              {r.detected_languages.length > 0 ? (
                r.detected_languages.map((l) => (
                  <span
                    key={l}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-teal-300 font-mono text-xs font-semibold flex items-center gap-1.5"
                  >
                    <span>🌐</span> {l.toUpperCase()}
                  </span>
                ))
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-mono text-xs">
                  {r.declared_lang ? r.declared_lang.toUpperCase() : "TR"} (Varsayılan Dil)
                </span>
              )}
            </div>

            <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="font-semibold text-slate-300">
                {lang === "tr" ? "Çift Yönlü Metin (BiDi) ve RTL Desteği Durumu:" : "BiDi & RTL Layout Status:"}
              </div>
              <p className="text-slate-400 leading-relaxed">
                {r.has_rtl_support
                  ? "Sitede Arapça, İbranice veya Farsça gibi sağdan sola (RTL) okunan bir dil algılandı. Menüler, butonlar ve ikonlar ters simetride (mirroring) sunulmalıdır."
                  : "Sayfada şu an yalnızca soldan sağa (LTR) metin yönü tespit edildi. RTL diller eklendiğinde CSS 'dir=rtl' adaptasyonu yapılmalıdır."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SEKME 4: i18n KOD REHBERİ */}
      {activeTab === "I18N_GUIDE" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📚</span> {lang === "tr" ? "Modern i18n / L10n Uygulama Standartları" : "Modern i18n Standards"}
            </h4>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-3">
              <div className="text-[11px] text-slate-400 font-sans font-bold">
                {lang === "tr" ? "Next.js App Router: Dinamik HTML Lang & BiDi Yapılandırması" : "Next.js Dynamic Root Layout"}
              </div>
              <pre className="text-teal-300 overflow-x-auto p-2 bg-slate-900/90 rounded-lg">
{`// app/[lang]/layout.tsx
export default async function RootLayout({
  children,
  params: { lang },
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  const isRtl = ['ar', 'he', 'fa', 'ur'].includes(lang);
  return (
    <html lang={lang} dir={isRtl ? 'rtl' : 'ltr'}>
      <body>{children}</body>
    </html>
  );
}`}
              </pre>

              <div className="text-[11px] text-slate-400 font-sans font-bold pt-2">
                {lang === "tr" ? "Yerel Sayı ve Para Birimi Formatı (Intl API)" : "JavaScript Intl API"}
              </div>
              <pre className="text-emerald-400 overflow-x-auto p-2 bg-slate-900/90 rounded-lg">
{`// Asla "$100 TL" şeklinde hardcoded dize yazmayın.
const formatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
});
console.log(formatter.format(1250.5)); // "₺1.250,50"`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

