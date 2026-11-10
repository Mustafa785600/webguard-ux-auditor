"use client";

import { useState } from "react";
import type {
  ThirdPartySecurityReport,
  ThirdPartyScriptItem,
  CSPDirectiveAudit,
} from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface ThirdPartySecurityViewProps {
  report?: ThirdPartySecurityReport | null;
  lang?: Language;
}

export default function ThirdPartySecurityView({
  report,
  lang = "tr",
}: ThirdPartySecurityViewProps) {
  const [activeTab, setActiveTab] = useState<"TRACKERS" | "CSP" | "CONSENT" | "RECOMMENDED_CSP">("TRACKERS");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">🛡️</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr"
            ? "Üçüncü Taraf Script ve CSP Denetim Verisi Bulunamadı"
            : "No Third-Party & CSP Security Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için harici script envanteri, SRI hash bütünlüğü ve CSP sandbox başlıkları henüz analiz edilmedi."
            : "Third-party script inventory, SRI hash integrity, and CSP sandbox headers have not been audited yet."}
        </p>
      </div>
    );
  }

  const r = report;

  const scoreColor =
    r.security_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.security_score >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  const cspGradeColor =
    r.csp_grade === "A+" || r.csp_grade === "A"
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/15"
      : r.csp_grade === "B"
      ? "text-amber-400 border-amber-500/40 bg-amber-500/15"
      : "text-rose-400 border-rose-500/40 bg-rose-500/15";

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık & Güvenlik Skoru HUD ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-sky-950/20 to-slate-900 border border-sky-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "Üçüncü Taraf Script, İzleyici ve CSP Sandbox Denetimi"
                  : "Third-Party Script, Tracker & CSP Sandbox Auditor"}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold border bg-sky-500/10 text-sky-400 border-sky-500/30">
                W3C CSP Level 3 & SRI Standardı
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "Dış CDN kütüphanelerindeki Subresource Integrity (SRI) bütünlük doğrulamalarını, Meta/TikTok/Hotjar gibi izleyicilerin KVKK/GDPR rıza öncesi yüklenmesini ve sunucunun Content-Security-Policy (CSP) sandbox direncini denetler."
                : "Audits third-party tracking scripts, Subresource Integrity (SRI) supply-chain protection, GDPR/KVKK consent compliance, and Content-Security-Policy sandbox defenses."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "CSP Derecesi:" : "CSP Grade:"}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md border font-black ${cspGradeColor}`}>
                {r.csp_grade}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "Çerez Rıza (CMP):" : "Cookie Consent:"}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                  r.consent_status.gdpr_kvkk_compliant
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                    : "text-rose-400 bg-rose-500/10 border-rose-500/30"
                }`}
              >
                {r.consent_status.has_consent_banner
                  ? `${r.consent_status.detected_cmp_vendor} Aktif`
                  : lang === "tr"
                  ? "Banner Yok (İhlal Riski)"
                  : "Missing CMP Banner"}
              </span>
            </div>
          </div>

          {/* Güvenlik Skoru */}
          <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">
                {lang === "tr" ? "3. Taraf Güvenlik Skoru" : "Security & Privacy Score"}
              </div>
              <div className="text-[11px] text-slate-500">
                {r.csp_configured ? "CSP Yapılandırılmış" : "CSP Başlığı Eksik"}
              </div>
            </div>
            <div className={`px-4 py-2.5 rounded-xl border text-2xl font-black ${scoreColor}`}>
              {r.security_score}
              <span className="text-xs font-normal text-slate-400 ml-0.5">/100</span>
            </div>
          </div>
        </div>

        {/* ── 2. Metrik İstatistik Çubukları ───────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "Harici Scriptler" : "Third-Party Scripts"}</span>
              <span className="text-sky-400 font-bold">{r.third_party_scripts_count}</span>
            </div>
            <div className="mt-2 text-base font-bold text-white flex items-baseline gap-1">
              <span>{r.third_party_scripts_count}</span>
              <span className="text-[11px] text-slate-400 font-normal">/ {r.total_scripts_count} toplam</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {lang === "tr" ? "Dış alan adlarından yüklenenler" : "Loaded from external domains"}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "İzleyici / Reklam Pikselleri" : "Trackers / Ad Pixels"}</span>
              <span className="text-amber-400 font-bold">{r.trackers_count}</span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.trackers_count > 0 ? (
                <span className="text-amber-300">
                  {r.trackers_count} {lang === "tr" ? "İzleyici Aktif" : "Active Trackers"}
                </span>
              ) : (
                <span className="text-emerald-400">{lang === "tr" ? "0 İzleyici (Temiz)" : "0 Trackers"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {r.session_recording_count > 0 ? (
                <span className="text-rose-400 font-semibold">
                  ⚠️ {r.session_recording_count} {lang === "tr" ? "Oturum Kaydedici" : "Session Recorder"}
                </span>
              ) : (
                lang === "tr" ? "Kayıt aracı tespit edilmedi" : "No session recorders"
              )}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "Eksik SRI Doğrulaması" : "Missing SRI Hashes"}</span>
              <span className="text-rose-400 font-bold">{r.missing_sri_count}</span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.missing_sri_count > 0 ? (
                <span className="text-rose-300">
                  {r.missing_sri_count} {lang === "tr" ? "CDN Korumasız" : "Unprotected CDNs"}
                </span>
              ) : (
                <span className="text-emerald-400">{lang === "tr" ? "Tümü Güvenli" : "All Secured"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {lang === "tr" ? "Tedarik zinciri saldırı riski" : "Supply chain tampering risk"}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "CSP Direktif Durumu" : "CSP Status"}</span>
              <span className="text-indigo-400 font-bold">{r.csp_configured ? r.csp_grade : "F"}</span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.csp_configured ? (
                <span className="text-emerald-400">{lang === "tr" ? "Başlık Tanımlı" : "Configured"}</span>
              ) : (
                <span className="text-rose-400">{lang === "tr" ? "CSP Eksik" : "Missing CSP"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {r.csp_directives.length} {lang === "tr" ? "direktif incelendi" : "directives evaluated"}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Alt Sekmeler (Navigation Tabs) ─────────────────────────────── */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("TRACKERS")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "TRACKERS"
              ? "border-sky-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>📦 {lang === "tr" ? "Script & İzleyici Envanteri" : "Scripts & Trackers"}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {r.scripts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CSP")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "CSP"
              ? "border-sky-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>🔒 {lang === "tr" ? "CSP Direktif Analizi" : "CSP Directives"}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${cspGradeColor}`}>
            {r.csp_grade}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CONSENT")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "CONSENT"
              ? "border-sky-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>🍪 {lang === "tr" ? "KVKK & GDPR Çerez Uyumu" : "Consent & GDPR"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RECOMMENDED_CSP")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "RECOMMENDED_CSP"
              ? "border-sky-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>⚙️ {lang === "tr" ? "Önerilen Güvenli CSP Kodu" : "Hardened CSP Template"}</span>
        </button>
      </div>

      {/* ── TAB 1: SCRIPT & İZLEYİCİ ENVANTERİ ──────────────────────────────── */}
      {activeTab === "TRACKERS" && (
        <div className="space-y-4">
          {r.scripts.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
              <span className="text-3xl">✨</span>
              <h4 className="text-sm font-bold text-white">
                {lang === "tr" ? "Hiçbir Harici Script Tespit Edilmedi" : "No External Scripts Detected"}
              </h4>
              <p className="text-xs text-slate-400">
                {lang === "tr"
                  ? "Sitede tüm kütüphaneler yerel olarak sunuluyor ve hiçbir izleyici bulunmuyor."
                  : "All scripts are self-hosted with zero external tracking overhead."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {r.scripts.map((script, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          script.category === "SESSION_RECORDING"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : script.category === "ADVERTISING_TRACKER"
                            ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                            : script.category === "CDN_LIBRARY"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {script.category}
                      </span>
                      <h4 className="text-sm font-bold text-white">{script.tracker_name}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {script.pii_leak_risk && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                          ⚠️ PII / Keylogger Riski
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          script.has_sri
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {script.has_sri ? "✓ SRI Doğrulandı" : "SRI Eksik"}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 leading-relaxed">
                    {script.description}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400 break-all">
                    <span className="text-slate-500 mr-2">URL:</span>
                    <span className="text-sky-300">{script.script_url}</span>
                  </div>

                  {script.remediation && (
                    <div className="text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-lg">
                      <span className="font-semibold">{lang === "tr" ? "Öneri:" : "Remediation:"} </span>
                      {script.remediation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: CSP DİREKTİF ANALİZİ ───────────────────────────────────── */}
      {activeTab === "CSP" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-center justify-between">
            <div>
              <span className="font-bold text-white">Content-Security-Policy (CSP Level 3)</span>
              <p className="mt-1 text-slate-400">
                {lang === "tr"
                  ? "CSP, tarayıcının yalnızca onaylanan kaynaklardan kod çalıştırmasını sağlayarak Siteler Arası Betik Çalıştırma (XSS) saldırılarını engeller."
                  : "Content Security Policy restricts unauthorized scripts and data exfiltration, mitigating Cross-Site Scripting (XSS) attacks."}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-xl border text-xl font-black ${cspGradeColor}`}>
              {r.csp_grade}
            </div>
          </div>

          {r.csp_directives.length === 0 ? (
            <div className="p-6 text-center bg-rose-500/5 rounded-xl border border-rose-500/20 space-y-2">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-sm font-bold text-rose-300">
                {lang === "tr" ? "Hiçbir CSP Başlığı Bulunamadı" : "No CSP Header Configured"}
              </h4>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                {lang === "tr"
                  ? "Sitenizde XSS ve yetkisiz veri aktarımı savunması bulunmuyor. 'Önerilen Güvenli CSP Kodu' sekmesindeki başlığı uygulayın."
                  : "Your site lacks defense against XSS and injection. Apply the recommended header from the template tab."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {r.csp_directives.map((dir, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-sky-400">
                      {dir.directive}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        dir.is_secure
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {dir.is_secure ? "✓ Güvenli" : "Zayıf / Riskli"}
                    </span>
                  </div>

                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 break-all">
                    {dir.raw_value}
                  </div>

                  {dir.warnings.map((warn, wIdx) => (
                    <div key={wIdx} className="text-xs text-rose-400 bg-rose-500/5 p-2 rounded border border-rose-500/20">
                      ⚠️ {warn}
                    </div>
                  ))}

                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">{lang === "tr" ? "Tavsiye:" : "Fix:"} </span>
                    <code className="text-emerald-300 font-mono">{dir.recommendation}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: KVKK & GDPR ÇEREZ RIZA UYUMU ─────────────────────────────── */}
      {activeTab === "CONSENT" && (
        <div className="space-y-4">
          <div
            className={`p-5 rounded-xl border space-y-3 ${
              r.consent_status.gdpr_kvkk_compliant
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-rose-500/5 border-rose-500/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {r.consent_status.gdpr_kvkk_compliant ? "✅" : "🚨"}
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {r.consent_status.gdpr_kvkk_compliant
                    ? (lang === "tr" ? "KVKK ve GDPR Çerez Rıza Uyumlu" : "GDPR & KVKK Consent Compliant")
                    : (lang === "tr" ? "Mevzuat İhlali Riski: Rıza Öncesi İzleyici Tetikleniyor" : "Non-Compliant: Pre-Consent Tracking")}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {r.consent_status.detail}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {lang === "tr" ? "Mevzuat Kılavuzu & Denetim Kontrol Listesi" : "Compliance Audit Checklist"}
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <span className={r.consent_status.has_consent_banner ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {r.consent_status.has_consent_banner ? "✓" : "✗"}
                </span>
                <span>
                  <strong>Açık Rıza Banner'ı (CMP):</strong> Sitede ziyaretçiye tercih sunan bir rıza yönetim sistemi bulunmalıdır (OneTrust, Cookiebot vb.).
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className={r.session_recording_count === 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {r.session_recording_count === 0 ? "✓" : "!"}
                </span>
                <span>
                  <strong>Oturum Kaydedici İfşası (Hotjar/Clarity):</strong> Tuş vuruşları ve form doldurmalarını kaydeden araçlar için özel bilgilendirme ve veri maskeleme zorunludur.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className={r.missing_sri_count === 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {r.missing_sri_count === 0 ? "✓" : "✗"}
                </span>
                <span>
                  <strong>PCI-DSS 4.0 Madde 6.4.3:</strong> Ödeme sayfalarında yüklenen tüm harici script'lerin hash bütünlüğü (SRI) doğrulanmalıdır.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: ÖNERİLEN GÜVENLİ CSP KODU ───────────────────────────────── */}
      {activeTab === "RECOMMENDED_CSP" && (
        <div className="space-y-5">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🔒</span>
                  <span>{lang === "tr" ? "Next.js / Node.js Middleware CSP Şablonu" : "Next.js Middleware CSP Template"}</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === "tr"
                    ? "Dinamik Nonce desteğiyle 'unsafe-inline' gereksinimini ortadan kaldıran güvenli Next.js middleware konfigürasyonu."
                    : "Strict Next.js middleware with dynamic nonce generation, eliminating 'unsafe-inline'."}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `// middleware.ts (Next.js 14/15/16)\nimport { NextResponse } from 'next/server';\nimport type { NextRequest } from 'next/server';\n\nexport function middleware(request: NextRequest) {\n  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');\n  const cspHeader = \`\n    default-src 'self';\n    script-src 'self' 'nonce-\${nonce}' 'strict-dynamic' https:;\n    style-src 'self' 'unsafe-inline';\n    img-src 'self' blob: data: https:;\n    font-src 'self' data:;\n    object-src 'none';\n    base-uri 'self';\n    form-action 'self';\n    frame-ancestors 'none';\n  \`.replace(/\\s{2,}/g, ' ').trim();\n\n  const requestHeaders = new Headers(request.headers);\n  requestHeaders.set('x-nonce', nonce);\n  requestHeaders.set('Content-Security-Policy', cspHeader);\n\n  const response = NextResponse.next({\n    request: { headers: requestHeaders },\n  });\n  response.headers.set('Content-Security-Policy', cspHeader);\n  return response;\n}`,
                    "nextjs-csp"
                  )
                }
                className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                {copiedId === "nextjs-csp" ? (lang === "tr" ? "Kopyalandı!" : "Copied!") : (lang === "tr" ? "Kodu Kopyala" : "Copy Code")}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
{`// middleware.ts (Next.js App Router)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = \`
    default-src 'self';
    script-src 'self' 'nonce-\${nonce}' 'strict-dynamic' https:;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  \`.replace(/\\s{2,}/g, ' ').trim();

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}`}
            </pre>
          </div>

          {/* Nginx Konfigürasyonu */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🌐</span>
                <span>{lang === "tr" ? "Nginx Web Sunucu Başlığı" : "Nginx Web Server Configuration"}</span>
              </h4>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `add_header Content-Security-Policy "${r.recommended_csp_header}" always;\nadd_header X-Content-Type-Options "nosniff" always;\nadd_header X-Frame-Options "DENY" always;`,
                    "nginx-csp"
                  )
                }
                className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                {copiedId === "nginx-csp" ? (lang === "tr" ? "Kopyalandı!" : "Copied!") : (lang === "tr" ? "Nginx Kodunu Kopyala" : "Copy Nginx")}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
{`add_header Content-Security-Policy "${r.recommended_csp_header}" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

