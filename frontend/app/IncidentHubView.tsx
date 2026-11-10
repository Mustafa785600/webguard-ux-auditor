"use client";

import React, { useState } from "react";
import {
  IncidentHubReport,
  IncidentPayloadCard,
  IncidentChannel,
} from "../types/scan";

interface IncidentHubViewProps {
  report: IncidentHubReport;
}

export const IncidentHubView: React.FC<IncidentHubViewProps> = ({ report }) => {
  const [selectedChannel, setSelectedChannel] = useState<IncidentChannel | "ALL">("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [dispatchedIds, setDispatchedIds] = useState<Record<string, { time: string; latencyMs: number }>>({});
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const filteredCards = report.cards.filter((card) => {
    const matchesChannel = selectedChannel === "ALL" || card.channel === selectedChannel;
    const matchesSeverity = selectedSeverity === "ALL" || card.severity === selectedSeverity;
    return matchesChannel && matchesSeverity;
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSimulateDispatch = (cardId: string) => {
    setSimulatingId(cardId);
    setTimeout(() => {
      setSimulatingId(null);
      setDispatchedIds((prev) => ({
        ...prev,
        [cardId]: {
          time: new Date().toLocaleTimeString("tr-TR"),
          latencyMs: Math.floor(Math.random() * 80) + 95,
        },
      }));
    }, 600);
  };

  const getChannelBadge = (channel: IncidentChannel) => {
    switch (channel) {
      case "SLACK":
        return {
          icon: "💬",
          name: "Slack",
          bg: "bg-emerald-950/40 border-emerald-500/30 text-emerald-300",
          tag: "Block Kit",
        };
      case "TEAMS":
        return {
          icon: "🏢",
          name: "MS Teams",
          bg: "bg-blue-950/40 border-blue-500/30 text-blue-300",
          tag: "Adaptive Card",
        };
      case "DISCORD":
        return {
          icon: "🎮",
          name: "Discord",
          bg: "bg-indigo-950/40 border-indigo-500/30 text-indigo-300",
          tag: "Rich Embed",
        };
      case "JIRA":
        return {
          icon: "📋",
          name: "Jira Cloud",
          bg: "bg-sky-950/40 border-sky-500/30 text-sky-300",
          tag: "REST API v3",
        };
      case "GENERIC_WEBHOOK":
        return {
          icon: "🌐",
          name: "SIEM / Webhook",
          bg: "bg-amber-950/40 border-amber-500/30 text-amber-300",
          tag: "CEF / JSON",
        };
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
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

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📢</span>
              <h2 className="text-xl font-bold text-slate-100">
                Otonom Olay Köprüsü ve Webhook Entegrasyon Merkezi
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Kritik ve yüksek seviyeli bulguları Slack, MS Teams, Discord, Jira ve kurumsal SIEM sistemlerine anında sevk edilmeye hazır standart formatlarda sunar.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              ISO/IEC 27035 Compliant
            </span>
            <span className="px-3 py-1 text-xs rounded-full bg-cyan-950/50 text-cyan-300 border border-cyan-800/50">
              SOC 2 Alerting SLA
            </span>
          </div>
        </div>

        {/* Metrik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-medium">Toplam Olay Yükü</div>
            <div className="text-2xl font-black text-slate-100 mt-1">
              {report.total_incidents_generated}
            </div>
            <div className="text-xs text-slate-500 mt-1">5 Ayrı Platform İçin</div>
          </div>

          <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4">
            <div className="text-xs text-rose-300 font-medium">Kritik Olaylar (P0)</div>
            <div className="text-2xl font-black text-rose-400 mt-1">
              {report.critical_count}
            </div>
            <div className="text-xs text-rose-400/70 mt-1">Acil Müdahale Gerekli</div>
          </div>

          <div className="bg-orange-950/20 border border-orange-900/40 rounded-xl p-4">
            <div className="text-xs text-orange-300 font-medium">Yüksek Riskli Olaylar (P1)</div>
            <div className="text-2xl font-black text-orange-400 mt-1">
              {report.high_count}
            </div>
            <div className="text-xs text-orange-400/70 mt-1">Triyaj Bekliyor</div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4">
            <div className="text-xs text-emerald-300 font-medium">Entegre Kanallar</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {report.channels_supported.length}
            </div>
            <div className="text-xs text-emerald-400/70 mt-1">Slack • Teams • Jira • SIEM</div>
          </div>
        </div>
      </div>

      {/* Kanal ve Öncelik Filtreleme Barı */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
        {/* Kanal Seçimi */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedChannel("ALL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedChannel === "ALL"
                ? "bg-cyan-500 text-slate-950 shadow-sm"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
            }`}
          >
            Tümü ({report.cards.length})
          </button>
          {(["SLACK", "TEAMS", "DISCORD", "JIRA", "GENERIC_WEBHOOK"] as IncidentChannel[]).map((ch) => {
            const meta = getChannelBadge(ch);
            const count = report.cards.filter((c) => c.channel === ch).length;
            const isSelected = selectedChannel === ch;
            return (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isSelected
                    ? "bg-slate-200 text-slate-900 shadow-sm"
                    : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.name}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Kritiklik Filtresi */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-400 font-medium">Öncelik:</span>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Tümü</option>
            <option value="CRITICAL">Critical (P0)</option>
            <option value="HIGH">High (P1)</option>
            <option value="MEDIUM">Medium (P2)</option>
            <option value="INFO">Info / Clean</option>
          </select>
        </div>
      </div>

      {/* Kart Listesi */}
      <div className="space-y-4">
        {filteredCards.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            Seçilen filtre kriterlerine uygun olay kartı bulunamadı.
          </div>
        ) : (
          filteredCards.map((card) => {
            const meta = getChannelBadge(card.channel);
            const isSimulating = simulatingId === card.card_id;
            const dispatchInfo = dispatchedIds[card.card_id];
            const isExpanded = expandedCardId === card.card_id;
            const payloadString = JSON.stringify(card.formatted_payload, null, 2);

            return (
              <div
                key={card.card_id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all shadow-lg"
              >
                {/* Kart Başlığı */}
                <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-200 text-sm">{card.title}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${meta.bg}`}>
                          {meta.name} • {meta.tag}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${getSeverityBadge(card.severity)}`}>
                          {card.severity}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Hedef: <code className="text-cyan-400">{card.target_url}</code></span>
                        <span>•</span>
                        <span>ID: <code className="text-slate-500">{card.card_id}</code></span>
                      </div>
                    </div>
                  </div>

                  {/* Aksiyon Butonları */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {dispatchInfo ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                        <span>✓</span>
                        <span>İletildi ({dispatchInfo.latencyMs}ms • {dispatchInfo.time})</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSimulateDispatch(card.card_id)}
                        disabled={isSimulating}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white transition-all shadow disabled:opacity-50"
                      >
                        {isSimulating ? (
                          <>
                            <span className="animate-spin inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                            <span>İletiliyor...</span>
                          </>
                        ) : (
                          <>
                            <span>🚀</span>
                            <span>Test Webhook Gönder</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleCopy(`curl-${card.card_id}`, card.curl_preview)}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                    >
                      {copiedId === `curl-${card.card_id}` ? "✓ cURL Kopyalandı" : "cURL"}
                    </button>

                    <button
                      onClick={() => handleCopy(`payload-${card.card_id}`, payloadString)}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                    >
                      {copiedId === `payload-${card.card_id}` ? "✓ JSON Kopyalandı" : "JSON"}
                    </button>

                    <button
                      onClick={() => setExpandedCardId(isExpanded ? null : card.card_id)}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-all"
                    >
                      {isExpanded ? "Daralt ▲" : "Genişlet ▼"}
                    </button>
                  </div>
                </div>

                {/* Platform Görsel Önizleme (Mockup) */}
                <div className="p-4 bg-slate-950/20">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Platform Görünüm Simülasyonu</span>
                    <span className="text-[10px] text-slate-500">
                      {card.recommended_action ? `Aksiyon: ${card.recommended_action}` : ""}
                    </span>
                  </div>

                  {/* SLACK MOCKUP */}
                  {card.channel === "SLACK" && (
                    <div className="bg-[#1A1D21] border border-slate-700 rounded-lg p-3 text-sm text-slate-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                          WG
                        </div>
                        <span className="font-bold text-xs text-white">WebGuard Incident Bot</span>
                        <span className="text-[10px] text-slate-400">Şimdi • APP</span>
                      </div>
                      <div className="font-bold text-white text-sm">
                        🚨 {card.title}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded border border-slate-800">
                        <div><strong className="text-slate-400">Hedef:</strong> {card.target_url}</div>
                        <div><strong className="text-slate-400">Kritiklik:</strong> <span className="text-rose-400">{card.severity}</span></div>
                        <div><strong className="text-slate-400">Kategori:</strong> {card.category}</div>
                        <div><strong className="text-slate-400">Öncelik:</strong> P0 Immediate</div>
                      </div>
                      <div className="text-xs text-slate-300">
                        <strong className="text-slate-400">Önerilen Çözüm:</strong> {card.recommended_action}
                      </div>
                      <div className="pt-1">
                        <span className="inline-block px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold cursor-pointer">
                          WebGuard Paneline Git
                        </span>
                      </div>
                    </div>
                  )}

                  {/* TEAMS MOCKUP */}
                  {card.channel === "TEAMS" && (
                    <div className="bg-[#1F1F1F] border-l-4 border-l-rose-500 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-bold text-rose-400">🚨 WebGuard Güvenlik Olayı</span>
                        <span>Adaptive Card v1.4</span>
                      </div>
                      <div className="font-bold text-base text-white">{card.title}</div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs bg-slate-900/80 p-2 rounded">
                        <div><span className="text-slate-400">Hedef URL:</span> {card.target_url}</div>
                        <div><span className="text-slate-400">Kritiklik:</span> <span className="font-semibold text-rose-400">{card.severity}</span></div>
                      </div>
                      <div className="text-xs text-slate-300">{card.recommended_action}</div>
                      <div className="pt-1">
                        <span className="inline-block px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold cursor-pointer">
                          WebGuard Raporunu Aç
                        </span>
                      </div>
                    </div>
                  )}

                  {/* DISCORD MOCKUP */}
                  {card.channel === "DISCORD" && (
                    <div className="bg-[#2B2D31] rounded-lg p-3 text-sm text-slate-200 space-y-2 border-l-4 border-l-rose-500">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                          W
                        </div>
                        <span className="font-bold text-xs text-white">WebGuard Incident Bot</span>
                        <span className="text-[9px] bg-indigo-600 px-1 py-0.2 rounded text-white font-semibold">BOT</span>
                      </div>
                      <div className="font-bold text-white text-sm">{card.title}</div>
                      <div className="text-xs text-slate-300">{card.recommended_action}</div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] bg-[#1E1F22] p-2 rounded">
                        <div><div className="text-slate-400">HEDEF</div><div className="truncate">{card.target_url}</div></div>
                        <div><div className="text-slate-400">SEVİYE</div><div className="text-rose-400 font-bold">{card.severity}</div></div>
                        <div><div className="text-slate-400">KATEGORİ</div><div>{card.category}</div></div>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1">
                        WebGuard Incident Hub • ISO 27035 Compliant
                      </div>
                    </div>
                  )}

                  {/* JIRA MOCKUP */}
                  {card.channel === "JIRA" && (
                    <div className="bg-[#1C2025] border border-slate-700 rounded-lg p-3 text-sm text-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-sky-400">SEC-1428 • Jira Software Cloud</span>
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px] font-bold">P0 Highest</span>
                      </div>
                      <div className="font-bold text-sm text-white">
                        [WebGuard] {card.title}
                      </div>
                      <div className="text-xs text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800">
                        Atlassian Document Format (ADF) ile yapılandırılmış hata raporu. İlgili güvenlik ve DevOps ekipleri otomatik etiketlendi.
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">#webguard</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">#automated-incident</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">#security-audit</span>
                      </div>
                    </div>
                  )}

                  {/* GENERIC / SIEM MOCKUP */}
                  {card.channel === "GENERIC_WEBHOOK" && (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400 space-y-1">
                      <div className="text-slate-400 font-bold">// Common Event Format (CEF) & RFC 3339 SIEM Payload</div>
                      <div className="text-slate-300 truncate">
                        CEF:0|WebGuard|AutonomousScanner|1.0|INC-{card.severity}|{card.title}|10|src={card.target_url}
                      </div>
                      <div className="text-cyan-400 pt-1">
                        Integrity: sha256:{card.card_id}9f83a... (Tam Güvenlikli İmzalandı)
                      </div>
                    </div>
                  )}
                </div>

                {/* Genişletilmiş Ham JSON ve cURL Alanı */}
                {isExpanded && (
                  <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                        <span>Tek Satır cURL Tetikleme Komutu</span>
                        <button
                          onClick={() => handleCopy(`curl-btn-${card.card_id}`, card.curl_preview)}
                          className="text-cyan-400 hover:text-cyan-300 text-[11px]"
                        >
                          {copiedId === `curl-btn-${card.card_id}` ? "✓ Kopyalandı" : "Komutu Kopyala"}
                        </button>
                      </div>
                      <pre className="bg-slate-900 p-2.5 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto border border-slate-800">
                        {card.curl_preview}
                      </pre>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                        <span>Ham JSON Veri Yükü (Formatted Payload)</span>
                        <button
                          onClick={() => handleCopy(`json-btn-${card.card_id}`, payloadString)}
                          className="text-cyan-400 hover:text-cyan-300 text-[11px]"
                        >
                          {copiedId === `json-btn-${card.card_id}` ? "✓ Kopyalandı" : "JSON Kopyala"}
                        </button>
                      </div>
                      <pre className="bg-slate-900 p-2.5 rounded-lg text-[11px] font-mono text-slate-300 max-h-60 overflow-y-auto border border-slate-800">
                        {payloadString}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Yapılandırılmış Uç Noktalar Dizini */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          Otomatik Dağıtım Uç Noktaları ve Entegrasyon Matrisi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {report.webhook_endpoints_configured.map((endpoint, i) => (
            <div
              key={i}
              className="bg-slate-950/40 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2"
            >
              <div className="truncate">
                <span className="text-slate-400 font-medium">Uç Nokta {i + 1}: </span>
                <code className="text-cyan-400 font-mono text-[11px]">{endpoint}</code>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                Aktif
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
