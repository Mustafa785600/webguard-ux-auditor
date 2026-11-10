"use client";

import { useState } from "react";
import type {
  TLSCryptoReport,
  CertChainNode,
  CipherSuiteItem,
} from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface TLSCryptoViewProps {
  report?: TLSCryptoReport | null;
  lang?: Language;
}

export default function TLSCryptoView({
  report,
  lang = "tr",
}: TLSCryptoViewProps) {
  const [activeTab, setActiveTab] = useState<"CERT_CHAIN" | "CIPHERS" | "HSTS" | "CONFIG">("CERT_CHAIN");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">🔐</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr"
            ? "SSL/TLS ve Kriptografi Denetim Verisi Bulunamadı"
            : "No SSL/TLS & Cryptography Audit Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için sertifika zinciri, şifreleme süitleri ve HSTS başlıkları henüz analiz edilmedi."
            : "Certificate chain, cipher suites, and HSTS headers have not been audited yet."}
        </p>
      </div>
    );
  }

  const r = report;

  const scoreColor =
    r.crypto_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.crypto_score >= 65
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  const gradeColor =
    r.ssl_labs_grade === "A+" || r.ssl_labs_grade === "A"
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/15"
      : r.ssl_labs_grade === "B"
      ? "text-amber-400 border-amber-500/40 bg-amber-500/15"
      : "text-rose-400 border-rose-500/40 bg-rose-500/15";

  const expiryColor =
    r.days_until_cert_expiry > 30
      ? "text-emerald-400"
      : r.days_until_cert_expiry > 7
      ? "text-amber-400"
      : "text-rose-400";

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık & Kriptografi Skoru HUD ──────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 border border-emerald-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔐</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "SSL/TLS Sertifika Zinciri ve Modern Kriptografi Sağlığı"
                  : "SSL/TLS Handshake & Cryptography Auditor"}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                PCI-DSS 4.0 & NIST SP 800-52r2 Standardı
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {lang === "tr"
                ? "SSL/TLS el sıkışma (handshake) protokollerini, aktarım katmanı şifreleme süitlerini (Cipher Suites), Perfect Forward Secrecy (PFS) desteğini, sertifika geçerlilik süresini ve HSTS preload uyumluluğunu otonom denetler."
                : "Audits TLS protocols, cipher suite strength, Perfect Forward Secrecy (PFS), certificate chain expiration, and Strict-Transport-Security (HSTS) compliance."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "SSL Labs Notu:" : "SSL Labs Grade:"}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md border font-black ${gradeColor}`}>
                {r.ssl_labs_grade}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "Protokol:" : "Protocol:"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-[11px]">
                {r.negotiated_protocol}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 font-semibold">
                {lang === "tr" ? "Şifre:" : "Cipher:"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-sky-300 font-mono text-[11px]">
                {r.negotiated_cipher}
              </span>
            </div>
          </div>

          {/* Kripto Skoru */}
          <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">
                {lang === "tr" ? "Kriptografi Sağlık Skoru" : "Crypto Health Score"}
              </div>
              <div className="text-[11px] text-slate-500">
                {r.has_pfs ? "PFS (Forward Secrecy) Aktif" : "PFS Desteklenmiyor"}
              </div>
            </div>
            <div className={`px-4 py-2.5 rounded-xl border text-2xl font-black ${scoreColor}`}>
              {r.crypto_score}
              <span className="text-xs font-normal text-slate-400 ml-0.5">/100</span>
            </div>
          </div>
        </div>

        {/* ── 2. Metrik İstatistik Çubukları ───────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "Sertifika Bitişine" : "Cert Expiration"}</span>
              <span className={`font-bold ${expiryColor}`}>{r.days_until_cert_expiry} {lang === "tr" ? "Gün" : "Days"}</span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.days_until_cert_expiry > 30 ? (
                <span className="text-emerald-400">{lang === "tr" ? "Güvenli (Geçerli)" : "Valid"}</span>
              ) : r.days_until_cert_expiry > 7 ? (
                <span className="text-amber-400">{lang === "tr" ? "Yenileme Yaklaşıyor" : "Expiring Soon"}</span>
              ) : (
                <span className="text-rose-400">{lang === "tr" ? "ACİL YENİLEME" : "CRITICAL"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {r.cert_chain[0]?.issuer_name || "CA Verified"}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "HSTS Koruması" : "HSTS Protection"}</span>
              <span className={r.hsts_status.is_enabled ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {r.hsts_status.is_enabled ? "AKTİF" : "EKSİK"}
              </span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.hsts_status.preload_ready ? (
                <span className="text-emerald-400">{lang === "tr" ? "Preload Hazır" : "Preload Ready"}</span>
              ) : r.hsts_status.is_enabled ? (
                <span className="text-amber-400">{lang === "tr" ? "Kısmi HSTS" : "Partial HSTS"}</span>
              ) : (
                <span className="text-rose-400">{lang === "tr" ? "HSTS Yok" : "No HSTS"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {r.hsts_status.max_age_seconds ? `max-age=${r.hsts_status.max_age_seconds}s` : "SSL Stripping Riski"}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "Modern TLS Desteği" : "TLS 1.3 Readiness"}</span>
              <span className={r.supports_tls13 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {r.supports_tls13 ? "TLS 1.3" : "TLS 1.2"}
              </span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.supports_legacy_tls ? (
                <span className="text-rose-400">{lang === "tr" ? "Eski TLS 1.0/1.1 Var" : "Legacy TLS Active"}</span>
              ) : (
                <span className="text-emerald-400">{lang === "tr" ? "Eski Protokol Yok" : "Legacy Disabled"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {lang === "tr" ? "PCI-DSS v4.0 Uyumlu" : "PCI-DSS Compliant"}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>{lang === "tr" ? "Forward Secrecy (PFS)" : "Forward Secrecy"}</span>
              <span className={r.has_pfs ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {r.has_pfs ? "ECDHE / DHE" : "YOK"}
              </span>
            </div>
            <div className="mt-2 text-base font-bold text-white">
              {r.has_pfs ? (
                <span className="text-emerald-400">{lang === "tr" ? "Geçmiş Oturumlar Güvende" : "Sessions Protected"}</span>
              ) : (
                <span className="text-rose-400">{lang === "tr" ? "PFS Eksik" : "No PFS"}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {lang === "tr" ? "Özel anahtar sızsa da trafik çözülemez" : "Resistant to key compromises"}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Alt Sekmeler (Navigation Tabs) ─────────────────────────────── */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("CERT_CHAIN")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "CERT_CHAIN"
              ? "border-emerald-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>📜 {lang === "tr" ? "Sertifika Zinciri" : "Certificate Chain"}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {r.cert_chain.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CIPHERS")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "CIPHERS"
              ? "border-emerald-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>🔑 {lang === "tr" ? "Şifreleme Süitleri (Ciphers)" : "Cipher Suites"}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {r.ciphers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HSTS")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "HSTS"
              ? "border-emerald-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>🛡️ {lang === "tr" ? "HSTS & Aktarım Güvenliği" : "HSTS & Transport Security"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CONFIG")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "CONFIG"
              ? "border-emerald-400 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          <span>⚙️ {lang === "tr" ? "Modern Mozilla SSL Rehberi" : "Hardened SSL Config"}</span>
        </button>
      </div>

      {/* ── TAB 1: SERTİFİKA ZİNCİRİ (CERT_CHAIN) ─────────────────────────── */}
      {activeTab === "CERT_CHAIN" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {r.cert_chain.map((cert, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📜</span>
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono">{cert.common_name}</h4>
                      <p className="text-xs text-slate-400">{cert.organization || "Alan Adı Doğrulaması (DV)"}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold border ${
                      cert.days_remaining > 30
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {cert.days_remaining} {lang === "tr" ? "Gün Geçerli" : "Days Left"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[11px]">Sertifika Otoritesi (CA):</span>
                    <span className="text-slate-200 font-semibold">{cert.issuer_name}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[11px]">Anahtar Tipi & Boyutu:</span>
                    <span className="text-emerald-300 font-mono font-semibold">
                      {cert.key_type} {cert.key_size_bits}-bit
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[11px]">İmza Algoritması:</span>
                    <span className="text-sky-300 font-mono">{cert.signature_algorithm}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[11px]">Bitiş Tarihi:</span>
                    <span className="text-slate-300 font-mono">{cert.valid_to}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: ŞİFRELEME SÜİTLERİ (CIPHERS) ────────────────────────────── */}
      {activeTab === "CIPHERS" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            {lang === "tr"
              ? "Şifreleme Süitleri (Cipher Suites), istemci ile sunucu arasında aktarılan verinin nasıl şifreleneceğini ve bütünlüğünün nasıl doğrulanacağını belirler. PCI-DSS 4.0 ve NIST standartları gereğince AEAD ve Perfect Forward Secrecy (PFS) zorunludur."
              : "Cipher suites dictate the encryption, key exchange, and MAC algorithms for TLS sessions. PCI-DSS 4.0 mandates AEAD ciphers and Perfect Forward Secrecy."}
          </div>

          <div className="space-y-3">
            {r.ciphers.map((cipher, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        cipher.security_level === "AEAD_MODERN"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : cipher.security_level === "SECURE"
                          ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                          : cipher.security_level === "WEAK_CBC"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {cipher.security_level}
                    </span>
                    <h4 className="text-sm font-bold text-white font-mono">{cipher.cipher_name}</h4>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    {cipher.protocol}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Anahtar Değişimi:</span>
                    <span className="text-slate-200 font-mono font-semibold">{cipher.key_exchange}</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Simetrik Şifreleme:</span>
                    <span className="text-sky-300 font-mono font-semibold">{cipher.encryption}</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Bütünlük Doğrulama (MAC):</span>
                    <span className="text-indigo-300 font-mono font-semibold">{cipher.mac}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: HSTS & AKTARIM GÜVENLİĞİ (HSTS) ─────────────────────────── */}
      {activeTab === "HSTS" && (
        <div className="space-y-4">
          <div
            className={`p-5 rounded-xl border space-y-3 ${
              r.hsts_status.is_enabled
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-rose-500/5 border-rose-500/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {r.hsts_status.is_enabled ? "🛡️" : "🚨"}
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {r.hsts_status.is_enabled
                    ? (lang === "tr" ? "HSTS (HTTP Strict Transport Security) Aktif" : "HSTS Active")
                    : (lang === "tr" ? "Kritik Risk: HSTS Başlığı Bulunamadı" : "Missing HSTS Header")}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {r.hsts_status.is_enabled
                    ? `max-age=${r.hsts_status.max_age_seconds} saniye | includeSubdomains: ${r.hsts_status.include_subdomains ? "Evet" : "Hayır"} | preload: ${r.hsts_status.preload_ready ? "Hazır" : "Eksik"}`
                    : (lang === "tr" ? "Kullanıcılar ilk bağlantıda veya güvensiz ağlarda SSL Stripping saldırılarına maruz kalabilir." : "Users can be downgraded to plaintext HTTP via SSL Stripping.")}
                </p>
              </div>
            </div>
          </div>

          {r.hsts_status.warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
              <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                {lang === "tr" ? "HSTS İyileştirme Uyarıları" : "HSTS Hardening Warnings"}
              </h5>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {r.hsts_status.warnings.map((warn, wIdx) => (
                  <li key={wIdx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">!</span>
                    <span>{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {lang === "tr" ? "Mevcut Ham Başlık" : "Raw HTTP Header"}
            </h4>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-sky-300 break-all">
              {r.hsts_status.raw_header || "Strict-Transport-Security başlığı döndürülmedi."}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: MODERN MOZILLA SSL REHBERİ (CONFIG) ────────────────────── */}
      {activeTab === "CONFIG" && (
        <div className="space-y-5">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🌐</span>
                  <span>{lang === "tr" ? "Nginx Sıkılaştırılmış Modern SSL/TLS Yapılandırması" : "Nginx Hardened TLS Configuration"}</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === "tr"
                    ? "TLS 1.2 ve 1.3 zorunlu, zayıf CBC şifreleri devre dışı, 2 yıl süreli HSTS Preload konfigürasyonu."
                    : "Mozilla Modern TLS guidelines: TLS 1.2/1.3 enforced, weak CBC ciphers disabled, HSTS preload enabled."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(r.recommended_nginx_conf, "nginx-tls")}
                className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                {copiedId === "nginx-tls" ? (lang === "tr" ? "Kopyalandı!" : "Copied!") : (lang === "tr" ? "Nginx Kodunu Kopyala" : "Copy Nginx")}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
              {r.recommended_nginx_conf}
            </pre>
          </div>

          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>⚡</span>
                <span>{lang === "tr" ? "Apache Web Sunucusu SSL Kuralı" : "Apache SSL Configuration"}</span>
              </h4>
              <button
                type="button"
                onClick={() => handleCopy(r.recommended_apache_conf, "apache-tls")}
                className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                {copiedId === "apache-tls" ? (lang === "tr" ? "Kopyalandı!" : "Copied!") : (lang === "tr" ? "Apache Kodunu Kopyala" : "Copy Apache")}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
              {r.recommended_apache_conf}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
