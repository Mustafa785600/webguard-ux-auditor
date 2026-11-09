"use client";

import { useState, useMemo } from "react";
import type {
  DASTVerificationReport,
  DASTVerificationItem,
  DASTVerificationStatus,
  DASTTestCategory,
} from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface DASTVerificationViewProps {
  report?: DASTVerificationReport | null;
  lang?: Language;
}

const STATUS_CONFIG: Record<
  DASTVerificationStatus,
  { labelTr: string; labelEn: string; icon: string; badge: string; border: string }
> = {
  CONFIRMED: {
    labelTr: "Kesin Teyit Edildi (Gerçek Zafiyet)",
    labelEn: "Confirmed Vulnerability",
    icon: "🚨",
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/40 animate-pulse",
    border: "border-rose-500/30",
  },
  POTENTIAL_RISK: {
    labelTr: "Potansiyel Risk / Şüpheli",
    labelEn: "Potential Risk",
    icon: "⚠️",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    border: "border-amber-500/30",
  },
  SAFE_OR_FALSE_POSITIVE: {
    labelTr: "Yanlış Pozitif Elendi (Güvenli)",
    labelEn: "False Positive Filtered (Safe)",
    icon: "🛡️",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    border: "border-emerald-500/20",
  },
};

const CATEGORY_CONFIG: Record<
  DASTTestCategory,
  { labelTr: string; labelEn: string; icon: string; cwe: string }
> = {
  REFLECTED_INPUT_SANITIZATION: {
    labelTr: "Girdi Yansıması & XSS Teyidi",
    labelEn: "Reflected Input & XSS",
    icon: "💉",
    cwe: "CWE-79",
  },
  SENSITIVE_EXPOSURE: {
    labelTr: "Hassas Dosya & Yapılandırma İfşası",
    labelEn: "Sensitive File Exposure",
    icon: "📂",
    cwe: "CWE-200",
  },
  CORS_MISCONFIGURATION: {
    labelTr: "Güvensiz CORS & Origin Yansıması",
    labelEn: "CORS Misconfiguration",
    icon: "🌐",
    cwe: "CWE-942",
  },
  OPEN_REDIRECT: {
    labelTr: "Açık Yönlendirme (Open Redirect)",
    labelEn: "Open Redirect",
    icon: "↗️",
    cwe: "CWE-601",
  },
  SSRF_FILTER_RESILIENCE: {
    labelTr: "SSRF İç Ağ Filtreleme Direnci",
    labelEn: "SSRF Filter Resilience",
    icon: "🔌",
    cwe: "CWE-918",
  },
};

export default function DASTVerificationView({
  report,
  lang = "tr",
}: DASTVerificationViewProps) {
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | DASTVerificationStatus>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | DASTTestCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">🎯</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr" ? "DAST Doğrulama Verisi Bulunamadı" : "No DAST Verification Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için sentetik kanarya ve DAST istismar teyit motoru henüz koşturulmadı veya hedef sunucuya erişilemedi."
            : "DAST exploit verification engine has not been run for this scan yet or target was unreachable."}
        </p>
      </div>
    );
  }

  const r = report;

  const filteredItems = useMemo(() => {
    return r.verifications.filter((item) => {
      const matchesStatus = selectedStatus === "ALL" || item.verification_status === selectedStatus;
      const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.test_name.toLowerCase().includes(q) ||
        item.target_endpoint.toLowerCase().includes(q) ||
        item.canary_payload.toLowerCase().includes(q) ||
        (item.evidence_response_snippet || "").toLowerCase().includes(q);
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [r.verifications, selectedStatus, selectedCategory, searchQuery]);

  const scoreColor =
    r.dast_confidence_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.dast_confidence_score >= 60
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık ve Kurumsal DAST Skor Özeti ───────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-rose-950/20 to-slate-900 border border-rose-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "Güvenlik Açığı Otomatik Doğrulaması (DAST Exploit Verification)"
                  : "DAST Exploit Verification & False-Positive Elimination"}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold border bg-rose-500/10 text-rose-400 border-rose-500/30">
                OWASP Top 10 & CWE Verified
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "Bulunan potansiyel zafiyetler (XSS, Hassas Dosya İfşası, CORS, Open Redirect, SSRF) sisteme zarar vermeyen sentetik kanaryalar (benign probes) ile otomatik test edilir. Yanlış pozitifler (False Positives) elenerek yalnızca %100 kanıtlanmış açıklar doğrulanır."
                : "Automates non-destructive canary verification against identified attack vectors to eliminate false positives and provide 100% verified proof-of-risk."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">Doğrulama Standartları:</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                CWE-79
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                CWE-200
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                CWE-942
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                CWE-601
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                CWE-918
              </span>
            </div>
          </div>

          {/* DAST Skor Kartı & Metrikler */}
          <div className="flex items-center gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="text-center px-4 border-r border-slate-800">
              <div className={`text-3xl font-black ${scoreColor.split(" ")[0]}`}>
                {r.dast_confidence_score}/100
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                {lang === "tr" ? "Güvenlik Skoru" : "DAST Score"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  r.confirmed_vulnerabilities_count > 0
                    ? "bg-rose-950/30 border-rose-500/30 text-rose-400"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                🚨 {r.confirmed_vulnerabilities_count} Doğrulandı
              </div>

              <div
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  r.potential_risks_count > 0
                    ? "bg-amber-950/30 border-amber-500/30 text-amber-400"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                ⚠️ {r.potential_risks_count} Şüpheli
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg text-emerald-400 font-semibold">
                🛡️ {r.false_positives_filtered_count} Elendi (Temiz)
              </div>

              <div className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300">
                🔍 {r.total_tests_executed} Kanarya Testi
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Filtreler ve Arama Çubuğu ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {/* Durum Filtreleri */}
          <button
            type="button"
            onClick={() => setSelectedStatus("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedStatus === "ALL"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            Tüm Testler ({r.total_tests_executed})
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("CONFIRMED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedStatus === "CONFIRMED"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            🚨 Doğrulananlar ({r.confirmed_vulnerabilities_count})
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("POTENTIAL_RISK")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedStatus === "POTENTIAL_RISK"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-950/50"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            ⚠️ Şüpheliler ({r.potential_risks_count})
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("SAFE_OR_FALSE_POSITIVE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedStatus === "SAFE_OR_FALSE_POSITIVE"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/50"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            🛡️ Elenenler ({r.false_positives_filtered_count})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Test veya URL ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* ── 3. Kanarya Doğrulama Kartları Listesi (Verification Items) ────── */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
            <span className="text-3xl">🔍</span>
            <h4 className="text-sm font-bold text-slate-300">
              Seçilen kriterlere uygun DAST doğrulama sonucu bulunamadı.
            </h4>
            <p className="text-xs text-slate-500">
              Filtrelerinizi sıfırlayarak tüm test sonuçlarını görüntüleyebilirsiniz.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const statusCfg = STATUS_CONFIG[item.verification_status] || STATUS_CONFIG.SAFE_OR_FALSE_POSITIVE;
            const catCfg = CATEGORY_CONFIG[item.category] || {
              labelTr: "Genel Güvenlik Testi",
              labelEn: "Security Test",
              icon: "🛡️",
              cwe: "CWE",
            };

            return (
              <div
                key={item.test_id}
                className={`bg-slate-900/60 border ${statusCfg.border} rounded-2xl p-4.5 space-y-3 hover:border-slate-700 transition`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{catCfg.icon}</span>
                    <span className="font-bold text-white text-sm">{item.test_name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-rose-300">
                      {catCfg.cwe}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${statusCfg.badge}`}>
                      <span>{statusCfg.icon}</span>
                      <span>{lang === "tr" ? statusCfg.labelTr : statusCfg.labelEn}</span>
                    </span>

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-slate-300">
                      %{item.confidence_percentage} Güven
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Hedef:</span>
                    <span className="text-slate-200">{item.target_endpoint}</span>
                  </div>
                  {item.parameter_tested && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Parametre:</span>
                      <span className="text-cyan-300 font-bold">{item.parameter_tested}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {item.description}
                </p>

                {/* Kanarya Probu ve Kanıt Snippet'ı */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] uppercase font-sans font-bold text-slate-400">
                      🧪 Kullanılan Zararsız Kanarya (Payload):
                    </div>
                    <div className="text-rose-300 mt-1 font-semibold truncate">
                      {item.canary_payload}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] uppercase font-sans font-bold text-slate-400">
                      🔍 Teyit Kanıtı (Evidence Snippet):
                    </div>
                    <div
                      className={`mt-1 font-semibold truncate ${
                        item.verification_status === "CONFIRMED"
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {item.evidence_response_snippet || "Yanıt başarıyla doğrulandı"}
                    </div>
                  </div>
                </div>

                {/* Çözüm ve İyileştirme */}
                <div className="p-2.5 bg-rose-950/20 border border-rose-500/20 rounded-lg text-xs text-rose-200 leading-relaxed">
                  <strong className="text-rose-300">💡 Kurumsal Çözüm:</strong> {item.remediation}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 4. Kurumsal DAST Savunma Standartları ve İpuçları ─────────────── */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span>🛡️</span> DAST Otomatik Doğrulama Prensipleri (TestSprite & Virgosol Standartları)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <strong className="text-white block">1. Sıfır Sistem Hasarı (Non-Destructive)</strong>
            Kanaryalar yalnızca varlık ve yansıma tespiti yapar. Veritabanı silme veya zararlı JS çalıştırma riski taşımaz.
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <strong className="text-white block">2. Yanlış Pozitif Ayıklama (False Positive Filtering)</strong>
            Statik tarayıcıların bildirdiği aldatıcı açıklar, dinamik kanarya yanıtı ile taranarak geliştiricilerin boşa vakit kaybetmesi önlenir.
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <strong className="text-white block">3. Canlı Kanıt Kaydı (Evidence Snippet)</strong>
            Her doğrulanan açık için HTTP durum kodu ve yansıtılan ham kanıt metni raporlanarak doğrudan aksiyon alınması sağlanır.
          </div>
        </div>
      </div>
    </div>
  );
}

