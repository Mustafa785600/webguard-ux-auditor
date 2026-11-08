"use client";

import { useState } from "react";
import type { RateLimitResilienceReport, RateLimitStatus } from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface RateLimitResilienceViewProps {
  report?: RateLimitResilienceReport | null;
  lang?: Language;
}

const STATUS_CONFIG: Record<
  RateLimitStatus,
  { labelTr: string; labelEn: string; icon: string; badge: string; descTr: string }
> = {
  ENFORCED_HTTP_429: {
    labelTr: "Hız Sınırı Aktif (HTTP 429)",
    labelEn: "Rate-Limiting Enforced (HTTP 429)",
    icon: "🛡️",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    descTr: "Sunucu istek patlamasını başarıyla algılayarak standart HTTP 429 Too Many Requests engeli uyguladı.",
  },
  ENFORCED_ACCOUNT_LOCK: {
    labelTr: "Hesap / IP Kısıtlaması Aktif",
    labelEn: "Account / IP Throttling Active",
    icon: "🔒",
    badge: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    descTr: "Sunucu ardışık başarısız denemeleri tespit ederek erişimi engelledi (HTTP 403 / IP Throttling).",
  },
  PARTIAL_DELAY: {
    labelTr: "Kademeli Gecikme (Tarpit)",
    labelEn: "Progressive Latency (Tarpitting)",
    icon: "⏳",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    descTr: "Sunucu HTTP 429 dönmedi ancak yanıt süresini kademeli olarak uzatarak kaba kuvveti yavaşlattı.",
  },
  NOT_ENFORCED: {
    labelTr: "Hız Sınırı Yok (Kritik Savunmasız)",
    labelEn: "No Rate Limiting (Vulnerable)",
    icon: "🚨",
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/40 animate-pulse",
    descTr: "Sunucu art arda gelen tüm istekleri sınırlamasız kabul etti. Kaba kuvvet ve DoS saldırılarına tamamen açıktır.",
  },
};

const CODE_TEMPLATES = {
  slowapi: {
    title: "FastAPI / SlowAPI (Python)",
    lang: "python",
    code: `# 1. slowapi kütüphanesini ekleyin: pip install slowapi
from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/auth/login")
@limiter.limit("5/minute")  # IP başına dakikada maksimum 5 deneme
async def login(request: Request):
    return {"status": "authenticated"}`,
  },
  nginx: {
    title: "Nginx Reverse Proxy (limit_req)",
    lang: "nginx",
    code: `# nginx.conf http bloğu içine ekleyin:
http {
    # IP başına saniyede 2 istek limiti tanımla (10m zone belleği)
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=2r/s;
    limit_req_status 429;

    server {
        location /api/auth/login {
            # 5 isteğe kadar burst izni, sonrasında anında 429
            limit_req zone=login_limit burst=5 nodelay;
            proxy_pass http://backend_upstream;
        }
    }
}`,
  },
  express: {
    title: "Express.js (Node.js)",
    lang: "javascript",
    code: `// npm install express-rate-limit
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // IP başına maksimum 5 başarısız deneme
  statusCode: 429,
  message: {
    error: 'Too many login attempts',
    retryAfterSeconds: 900
  },
  standardHeaders: true, // RateLimit-* başlıklarını ekler
  legacyHeaders: false,  // X-RateLimit-* başlıklarını devre dışı bırakır
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  // Giriş işlemleri...
});`,
  },
};

export default function RateLimitResilienceView({
  report,
  lang = "tr",
}: RateLimitResilienceViewProps) {
  const [activeCodeTab, setActiveCodeTab] = useState<"slowapi" | "nginx" | "express">("slowapi");

  if (!report) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
        <span className="text-3xl">⏱️</span>
        <h3 className="text-base font-bold text-white">
          {lang === "tr" ? "Hız Sınırı Direnç Verisi Bulunamadı" : "No Rate-Limiting Data Available"}
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {lang === "tr"
            ? "Bu tarama için hız sınırı ve kaba kuvvet denetimi henüz yürütülmedi veya hedef uç noktaya ulaşılamadı."
            : "Rate-limiting and brute-force audit was not executed for this scan or target was unreachable."}
        </p>
      </div>
    );
  }

  const r = report;
  const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.NOT_ENFORCED;

  const scoreColor =
    r.resilience_score >= 85
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : r.resilience_score >= 60
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  return (
    <div className="space-y-6">
      {/* ── 1. Başlık ve Kurumsal Skor Özeti ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900 border border-purple-500/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏱️</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {lang === "tr"
                  ? "Hız Sınırı ve Kaba Kuvvet Direnci"
                  : "Rate-Limiting & Brute-Force Resilience"}
              </h2>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusCfg.badge}`}
              >
                <span>{statusCfg.icon}</span>
                <span>{lang === "tr" ? statusCfg.labelTr : statusCfg.labelEn}</span>
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
              {statusCfg.descTr}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
                <span className="text-slate-400 font-medium">Test Edilen Uç Nokta:</span>
                <span className="font-mono text-purple-300 font-bold">{r.tested_endpoint}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
                <span className="text-slate-400 font-medium">İstek Patlaması:</span>
                <span className="font-semibold text-white">{r.total_burst_requests} İstek (Sentetik)</span>
              </div>
            </div>
          </div>

          {/* Skor Kartı & Temel KPI */}
          <div className="flex items-center gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="text-center px-4 border-r border-slate-800">
              <div className={`text-3xl font-black ${scoreColor.split(" ")[0]}`}>
                {r.resilience_score}/100
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                {lang === "tr" ? "Direnç Skoru" : "Resilience Score"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  r.http_429_received
                    ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400"
                    : "bg-rose-950/30 border-rose-500/20 text-rose-400"
                }`}
              >
                {r.http_429_received ? "✓ HTTP 429 Alındı" : "✗ HTTP 429 Yok"}
              </div>

              <div
                className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                  r.retry_after_header_present
                    ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400"
                    : "bg-amber-950/30 border-amber-500/20 text-amber-400"
                }`}
              >
                {r.retry_after_header_present ? "✓ Retry-After Var" : "⚠️ Retry-After Yok"}
              </div>

              <div className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300">
                Devreye Girme:{" "}
                <span className="font-bold text-white">
                  {r.throttled_at_attempt ? `${r.throttled_at_attempt}. İstek` : "Engellenmedi"}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300">
                Başlık Sayısı:{" "}
                <span className="font-bold text-purple-400">
                  {Object.keys(r.rate_limit_headers).length} Başlık
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Mevzuat & Kurumsal Uyum Standartları ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <span className="text-xl">🏛️</span>
          <div>
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              BDDK Madde 34
            </div>
            <div className="text-xs font-semibold text-white mt-0.5">
              Elektronik Bankacılık Kaba Kuvvet Koruması
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {r.rate_limiting_detected
                ? "Art arda hatalı giriş denemeleri sınırlandırılarak BDDK gereksinimi karşılanmaktadır."
                : "Hız sınırı bulunmaması BDDK denetimlerinde doğrudan Majör Bulgu teşkil eder."}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <span className="text-xl">🛡️</span>
          <div>
            <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">
              OWASP API4:2023
            </div>
            <div className="text-xs font-semibold text-white mt-0.5">
              Unrestricted Resource Consumption
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Uç noktanın sınırsız istek tüketimine izin verip vermediği ve DoS direnci teyit edilir.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <span className="text-xl">💳</span>
          <div>
            <div className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              PCI-DSS 8.3.4
            </div>
            <div className="text-xs font-semibold text-white mt-0.5">
              Parola ve Kimlik Deneme Sınırlaması
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Maksimum 6-10 başarısız denemeden sonra hesabın veya IP adresinin kısıtlanmasını şart koşar.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. Burst İstekleri Akış Çizelgesi (Attempt Sequence Table) ───── */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h3 className="text-sm font-bold text-white">
              {lang === "tr"
                ? "Sentetik İstek Patlaması Akış Tablosu (Burst Probing Timeline)"
                : "Synthetic Burst Probing Timeline"}
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {r.attempts.length} Gönderilen Proba Ait Yanıt Analizi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-4"># İstek</th>
                <th className="py-2.5 px-4">HTTP Kodu</th>
                <th className="py-2.5 px-4">Gecikme (ms)</th>
                <th className="py-2.5 px-4">Kalan Kota (Remaining)</th>
                <th className="py-2.5 px-4">Retry-After</th>
                <th className="py-2.5 px-4">Sonuç / Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {r.attempts.map((att) => {
                const isThrottled = att.throttled;
                const statusColor =
                  att.status_code === 429
                    ? "text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30"
                    : att.status_code >= 400
                    ? "text-amber-400 font-semibold"
                    : "text-emerald-400 font-semibold";

                return (
                  <tr
                    key={att.attempt_number}
                    className={`hover:bg-slate-800/30 transition ${
                      isThrottled ? "bg-purple-950/20" : ""
                    }`}
                  >
                    <td className="py-2 px-4 font-mono text-slate-300">
                      #{att.attempt_number}
                    </td>
                    <td className="py-2 px-4">
                      <span className={statusColor}>
                        {att.status_code === 0 ? "TIMEOUT" : att.status_code}
                      </span>
                    </td>
                    <td className="py-2 px-4 font-mono text-slate-300">
                      {att.latency_ms} ms
                    </td>
                    <td className="py-2 px-4 font-mono text-slate-300">
                      {att.rate_limit_remaining !== undefined && att.rate_limit_remaining !== null
                        ? att.rate_limit_remaining
                        : "—"}
                    </td>
                    <td className="py-2 px-4 font-mono text-slate-300">
                      {att.retry_after_seconds ? `${att.retry_after_seconds}s` : "—"}
                    </td>
                    <td className="py-2 px-4">
                      {isThrottled ? (
                        <span className="inline-flex items-center gap-1 text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30 text-[11px]">
                          🛡️ Hız Sınırı Devreye Girdi (Engellendi)
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Doğrudan İletildi</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. Sunucu Başlıkları ve İyileştirme Kodları ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sunucu Başlıkları İnceleyicisi */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📋</span> Tespit Edilen Rate-Limit Başlıkları
            </h3>
            <span className="text-xs text-slate-400">RFC 6585 & IETF Draft</span>
          </div>

          {Object.keys(r.rate_limit_headers).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(r.rate_limit_headers).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 font-mono text-xs"
                >
                  <span className="text-purple-300 font-semibold">{k}:</span>
                  <span className="text-slate-200">{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
              Sunucu yanıtlarında hiçbir standart rate-limit başlığı (
              <code className="text-purple-300">RateLimit-*</code>,{" "}
              <code className="text-purple-300">X-RateLimit-*</code>,{" "}
              <code className="text-purple-300">Retry-After</code>) bulunamadı.
            </div>
          )}

          <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs text-purple-200 leading-relaxed">
            <strong className="text-purple-300">💡 Kurumsal Tavsiye:</strong> Frontend uygulamalarının
            kullanıcıya doğru geri sayım (timer) gösterebilmesi için HTTP 429 yanıtlarında{" "}
            <code>Retry-After: 60</code> başlığı mutlaka döndürülmelidir.
          </div>
        </div>

        {/* Hızlı Entegrasyon ve Düzeltme Kod Şablonları */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🛠️</span> Kurumsal Çözüm & Kod Şablonu
            </h3>
            <div className="flex gap-1">
              {(["slowapi", "nginx", "express"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveCodeTab(tab)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                    activeCodeTab === tab
                      ? "bg-purple-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {tab === "slowapi" ? "FastAPI" : tab === "nginx" ? "Nginx" : "Express"}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
              <code>{CODE_TEMPLATES[activeCodeTab].code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

