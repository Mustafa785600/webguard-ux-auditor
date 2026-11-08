"use client";

import { useState, useMemo } from "react";
import type {
  APIContractDriftReport,
  SchemaDriftItem,
  APIEndpointContract,
  SchemaDriftType,
} from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface APIContractDriftViewProps {
  report?: APIContractDriftReport | null;
  lang?: Language;
}

const DRIFT_BADGES: Record<
  SchemaDriftType,
  { labelTr: string; labelEn: string; icon: string; badge: string }
> = {
  TYPE_MISMATCH: {
    labelTr: "Tip Uyuşmazlığı",
    labelEn: "Type Mismatch",
    icon: "🔀",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
  MISSING_REQUIRED_FIELD: {
    labelTr: "Zorunlu Alan Eksik",
    labelEn: "Missing Required Field",
    icon: "⚠️",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  UNDOCUMENTED_SHADOW_API: {
    labelTr: "Belgelenmemiş Gölge API",
    labelEn: "Shadow API",
    icon: "👻",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/40 animate-pulse",
  },
  STATUS_CODE_UNSPECIFIED: {
    labelTr: "Tanımsız Durum Kodu",
    labelEn: "Unspecified Status Code",
    icon: "❓",
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  },
  DEPRECATED_ENDPOINT_ACTIVE: {
    labelTr: "Kullanım Dışı API Aktif",
    labelEn: "Deprecated Endpoint Active",
    icon: "⏳",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  },
  UNEXPECTED_FIELD: {
    labelTr: "Beklenmeyen Alan",
    labelEn: "Unexpected Field",
    icon: "📦",
    badge: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  },
};

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  POST: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  PUT: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  DELETE: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  PATCH: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

export default function APIContractDriftView({
  report,
  lang = "tr",
}: APIContractDriftViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"DRIFTS" | "SHADOW" | "CATALOG" | "FIXES">("DRIFTS");
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">📋</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr" ? "API Sözleşme Verisi Bulunamadı" : "No API Contract Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için API şartname ve şema sapması denetimi henüz yürütülmedi veya API trafiği yakalanamadı."
            : "API contract and schema drift audit has not been executed for this scan yet or no API traffic was captured."}
        </p>
      </div>
    );
  }

  const r = report;

  const filteredDrifts = useMemo(() => {
    return r.drifts.filter((d) => {
      const q = searchQuery.toLowerCase();
      return (
        d.endpoint.toLowerCase().includes(q) ||
        (d.field_path || "").toLowerCase().includes(q) ||
        d.drift_type.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      );
    });
  }, [r.drifts, searchQuery]);

  const shadowEndpoints = useMemo(() => {
    return r.endpoints.filter((e) => !e.documented_in_spec);
  }, [r.endpoints]);

  const scoreColor =
    r.contract_compatibility_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.contract_compatibility_score >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık ve Kurumsal Skor Kartı ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950/20 to-slate-900 border border-cyan-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "API Sözleşme ve Şema Sapması Denetimi"
                  : "API Contract & Schema Drift Auditor"}
              </h2>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold border ${
                  r.spec_detected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
              >
                {r.spec_detected
                  ? `OpenAPI: ${r.spec_title || "Aktif"} (v${r.spec_version || "1.0"})`
                  : "Açık OpenAPI Şartnamesi Bulunamadı"}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "Resmi OpenAPI / Swagger şartnamesi ile istemcinin çalışma zamanında (runtime network traces) aldığı API yanıtları karşılaştırılır. Tip uyuşmazlığı, zorunlu alan eksikliği ve belgelenmemiş gölge API'ler (OWASP API8/API9) tespit edilir."
                : "Compares OpenAPI/Swagger specs against live runtime network traces to catch schema drift, data type mutations, missing required fields, and shadow APIs."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {r.spec_url && (
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
                  <span className="text-slate-400 font-medium">Şartname URL:</span>
                  <span className="font-mono text-cyan-300 font-bold">{r.spec_url}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
                <span className="text-slate-400 font-medium">Değerlendirilen Uç Noktalar:</span>
                <span className="font-semibold text-white">{r.total_endpoints_evaluated} Rota</span>
              </div>
            </div>
          </div>

          {/* Skor Kartı & Temel KPI */}
          <div className="flex items-center gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="text-center px-4 border-r border-slate-800">
              <div className={`text-3xl font-black ${scoreColor.split(" ")[0]}`}>
                {r.contract_compatibility_score}/100
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                {lang === "tr" ? "Sözleşme Uyumu" : "Contract Score"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg text-emerald-400 font-semibold">
                ✓ {r.documented_endpoints_count} Kayıtlı Rota
              </div>
              <div
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  r.shadow_endpoints_count > 0
                    ? "bg-purple-950/30 border-purple-500/30 text-purple-300"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                👻 {r.shadow_endpoints_count} Gölge API
              </div>
              <div
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  r.total_drifts_detected > 0
                    ? "bg-rose-950/30 border-rose-500/20 text-rose-400"
                    : "bg-emerald-950/30 border-emerald-500/20 text-emerald-400"
                }`}
              >
                ⚡ {r.total_drifts_detected} Sapma (Drift)
              </div>
              <div className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300">
                OWASP API8/9
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Sekmeler ve Arama Çubuğu ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveSubTab("DRIFTS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeSubTab === "DRIFTS"
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-950/50"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            ⚡ Şema Sapmaları ({r.drifts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("SHADOW")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeSubTab === "SHADOW"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-950/50"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            👻 Gölge API Radarı ({shadowEndpoints.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("CATALOG")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeSubTab === "CATALOG"
                ? "bg-sky-600 text-white shadow-lg shadow-sky-950/50"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            📑 Uç Nokta Kataloğu ({r.endpoints.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("FIXES")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeSubTab === "FIXES"
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            🛠️ Düzeltme Kodları
          </button>
        </div>

        {activeSubTab === "DRIFTS" && (
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Rota veya alan ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}
      </div>

      {/* ── 3. TAB 1: Şema Sapmaları Listesi (Schema Drifts) ──────────────── */}
      {activeSubTab === "DRIFTS" && (
        <div className="space-y-3">
          {filteredDrifts.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-3xl">🎉</span>
              <h4 className="text-sm font-bold text-emerald-400">
                {lang === "tr"
                  ? "Hiçbir Şema Sapması Bulunmadı!"
                  : "Zero Schema Drifts Detected!"}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Tüm çalışma zamanı API yanıtları OpenAPI şartnamesinde tanımlanan veri tipleri ve zorunlu alanlarla %100 uyumludur.
              </p>
            </div>
          ) : (
            filteredDrifts.map((drift, idx) => {
              const badgeCfg = DRIFT_BADGES[drift.drift_type] || DRIFT_BADGES.TYPE_MISMATCH;
              const methodClass = METHOD_COLORS[drift.method] || "bg-slate-800 text-slate-300";

              return (
                <div
                  key={idx}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${methodClass}`}>
                        {drift.method}
                      </span>
                      <span className="font-mono text-sm font-bold text-white">
                        {drift.endpoint}
                      </span>
                      {drift.field_path && (
                        <span className="text-xs font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
                          alan: <strong>{drift.field_path}</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${badgeCfg.badge}`}>
                        <span>{badgeCfg.icon}</span>
                        <span>{lang === "tr" ? badgeCfg.labelTr : badgeCfg.labelEn}</span>
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          drift.severity === "HIGH"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {drift.severity}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {drift.description}
                  </p>

                  {/* Beklenen vs Gerçek Zamanlı Fark Karşılaştırması */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] uppercase font-sans font-bold text-slate-400">
                        📄 Beklenen Şartname Sözleşmesi:
                      </div>
                      <div className="text-emerald-400 mt-1 font-semibold">
                        {drift.expected_contract}
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] uppercase font-sans font-bold text-slate-400">
                        ⚡ Çalışma Zamanı Gerçekleşen Yanıt:
                      </div>
                      <div className="text-rose-400 mt-1 font-semibold">
                        {drift.actual_runtime}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-cyan-950/20 border border-cyan-500/20 rounded-lg text-xs text-cyan-200 leading-relaxed">
                    <strong className="text-cyan-300">💡 Çözüm:</strong> {drift.recommended_fix}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── 4. TAB 2: Gölge API Radarı (Shadow APIs) ─────────────────────── */}
      {activeSubTab === "SHADOW" && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl flex items-start gap-3 text-xs text-purple-200">
            <span className="text-2xl">👻</span>
            <div>
              <strong className="text-purple-300 text-sm block">
                OWASP API9:2023 - Improper Inventory Management (Gölge API Koruması)
              </strong>
              Gölge API'ler (Shadow APIs), istemci kodunun aktif olarak çağırdığı ancak resmi OpenAPI / Swagger
              dokümantasyonunda yer almayan uç noktalardır. Kurumsal envanter takibinden kaçtıkları için güvenlik yamaları
              ve yetkilendirme kontrolleri gözden kaçabilir.
            </div>
          </div>

          {shadowEndpoints.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800">
              <span className="text-3xl">🛡️</span>
              <h4 className="text-sm font-bold text-emerald-400 mt-2">
                Gölge API Tespit Edilmedi
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                İstemcinin yaptığı tüm API çağrıları şartnamede eksiksiz belgelenmiştir.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {shadowEndpoints.map((ep, idx) => {
                const methodClass = METHOD_COLORS[ep.method] || "bg-slate-800 text-slate-300";
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/60 border border-purple-500/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${methodClass}`}>
                          {ep.method}
                        </span>
                        <span className="font-mono text-sm font-bold text-white">
                          {ep.path}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                        Şartnamede Yok
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Ön yüz bu rotayı çağırmaktadır ancak OpenAPI spesifikasyonunda tanımlanmamıştır.
                    </p>

                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
                      <span>HTTP Durumu: {ep.runtime_status_code || "Bilinmiyor"}</span>
                      <span className="text-amber-400 font-sans font-medium">Envantere Ekleyin</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 5. TAB 3: API Sözleşme Kataloğu (Catalog) ────────────────────── */}
      {activeSubTab === "CATALOG" && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📑</span> Kayıtlı API Uç Noktaları ({r.endpoints.length})
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              OpenAPI 3.0 / 3.1 Şartname Analizi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Metot & Rota</th>
                  <th className="py-2.5 px-4">Açıklama / Özet</th>
                  <th className="py-2.5 px-4">Şartname Durumu</th>
                  <th className="py-2.5 px-4">Çalışma Zamanı Durum</th>
                  <th className="py-2.5 px-4">Sapma Sayısı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {r.endpoints.map((ep, idx) => {
                  const methodClass = METHOD_COLORS[ep.method] || "bg-slate-800 text-slate-300";
                  return (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-4 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${methodClass}`}>
                          {ep.method}
                        </span>
                        <span className="text-white font-semibold">{ep.path}</span>
                      </td>
                      <td className="py-2.5 px-4 font-sans text-slate-300">
                        {ep.summary || "—"}
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        {ep.documented_in_spec ? (
                          <span className="text-emerald-400 font-medium">✓ Belgelenmiş</span>
                        ) : (
                          <span className="text-purple-400 font-medium">👻 Gölge API</span>
                        )}
                        {ep.is_deprecated && (
                          <span className="ml-1 text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                            Deprecated
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {ep.runtime_status_code ? (
                          <span className="text-cyan-400 font-bold">
                            HTTP {ep.runtime_status_code}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {ep.drift_count > 0 ? (
                          <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                            {ep.drift_count} Sapma
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">0 Sapma</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 6. TAB 4: Kurumsal Düzeltme ve Kod Şablonları (Fixes) ─────────── */}
      {activeSubTab === "FIXES" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🐍</span> FastAPI & Pydantic V2 Kesin Tip Güvencesi
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Çalışma zamanında beklenmeyen tiplerin veya eksik alanların döndürülmesini engellemek için
              FastAPI <code>response_model</code> ve <code>extra=&apos;forbid&apos;</code> tanımlayın.
            </p>
            <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              <code>{`from pydantic import BaseModel, ConfigDict
from fastapi import FastAPI

app = FastAPI(title="FinTech API", version="2.4.0")

class AccountResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")  # Ekstra tanımsız alanları engeller

    account_id: int          # Tip uyuşmazlığına izin vermez
    balance: float           # Zorunlu alan
    currency: str            # Zorunlu alan
    is_active: bool = True

@app.get("/api/accounts", response_model=AccountResponse)
async def get_account():
    # Pydantic otomatik olarak şemayı ve yanıtı doğrular
    return {"account_id": 1001, "balance": 1500.50, "currency": "TRY"}`}</code>
            </pre>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🛡️</span> CI/CD Şema Doğrulama Hattı (Schemathesis)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Git hook veya GitHub Actions içerisinde her pull request&apos;te OpenAPI sözleşmesini test etmek için
              Schemathesis veya Dredd kullanın.
            </p>
            <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              <code>{`# GitHub Actions CI Adımı
- name: Run Schemathesis API Contract Test
  run: |
    pip install schemathesis
    # Canlı backend'i OpenAPI şemasına göre binlerce sentetik istekle doğrula
    st run http://localhost:8000/openapi.json \\
      --checks all \\
      --validate-schema=true \\
      --hypothesis-max-examples=50`}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
