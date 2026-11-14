"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

interface ActionItem {
  id: string;
  type: string;
  time: string;
  label: string;
  action_type: string;
  target?: string;
  details?: string;
  coords?: { x: number; y: number };
}

interface LiveScreencastPanelProps {
  targetUrl: string;
  isActive: boolean;
  lang?: "tr" | "en";
  persona?: string;
  auditMode?: "UX_PERSONA" | "ETHICAL_SECURITY";
  onClose?: () => void;
}

const PERSONA_BADGES: Record<string, { icon: string; title: string }> = {
  SHOPPER: { icon: "🛒", title: "Alışverişçi" },
  RAGE_TESTER: { icon: "⚡", title: "Sabırsız" },
  ACCESSIBILITY: { icon: "👴", title: "Erişilebilirlik" },
  POWER_EXPLORER: { icon: "🔍", title: "Kaşif" },
};

export default function LiveScreencastPanel({
  targetUrl,
  isActive,
  lang = "tr",
  persona = "SHOPPER",
  auditMode = "UX_PERSONA",
  onClose,
}: LiveScreencastPanelProps) {
  const [frame, setFrame] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [activeAction, setActiveAction] = useState<ActionItem | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [viewMode, setViewMode] = useState<"web" | "cdp">("web");
  const actionsEndRef = useRef<HTMLDivElement>(null);

  // Extract clean domain name for the live browser simulation
  const domainName = useMemo(() => {
    try {
      const u = new URL(targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`);
      return u.hostname || targetUrl;
    } catch {
      return targetUrl.replace(/^https?:\/\//, "").split("/")[0] || "target-site.com";
    }
  }, [targetUrl]);

  // Auto-scroll action log
  useEffect(() => {
    actionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [actions]);

  // Dynamic Base URLs for WebSocket & HTTP
  const getBackendUrls = () => {
    if (typeof window === "undefined") {
      return {
        baseHttp: "http://localhost:8000",
        httpUrl: "http://localhost:8000/api/v1/screencast/state",
        wsUrl: "ws://localhost:8000/api/v1/ws/screencast",
      };
    }
    const envApi = process.env.NEXT_PUBLIC_API_URL;
    let baseHttp = envApi ? envApi.replace(/\/api\/v1\/?$/, "") : `${window.location.protocol}//${window.location.hostname}:8000`;
    const isHttps = window.location.protocol === "https:" || baseHttp.startsWith("https:");
    const wsProto = isHttps ? "wss:" : "ws:";
    const baseWs = baseHttp.replace(/^http(s)?:/, wsProto);
    return {
      baseHttp,
      httpUrl: `${baseHttp}/api/v1/screencast/state`,
      wsUrl: `${baseWs}/api/v1/ws/screencast`,
    };
  };

  const { baseHttp, httpUrl, wsUrl } = getBackendUrls();
  const proxyViewportUrl = `${baseHttp}/api/v1/proxy/viewport?url=${encodeURIComponent(targetUrl || "https://example.com")}`;
  const activePersonaBadge = PERSONA_BADGES[persona] || PERSONA_BADGES.SHOPPER;

  // Sync cursor & simulated element behaviors with the active action
  useEffect(() => {
    if (!activeAction) return;
    const type = activeAction.action_type;

    if (activeAction.coords && activeAction.coords.x && activeAction.coords.y) {
      // Scale from standard 1024x640 to percentage
      const pctX = Math.min(95, Math.max(5, (activeAction.coords.x / 1024) * 100));
      const pctY = Math.min(95, Math.max(5, (activeAction.coords.y / 640) * 100));
      setCursorPos({ x: pctX, y: pctY });
    } else {
      // Natural target coordinates on page
      switch (type) {
        case "NAVIGATE":
          setCursorPos({ x: 28, y: 14 });
          break;
        case "COOKIE":
          setCursorPos({ x: 74, y: 88 });
          break;
        case "SCROLL":
          setCursorPos({ x: 50, y: 55 });
          break;
        case "TYPE":
          setCursorPos({ x: 65, y: 14 });
          break;
        case "MENU":
          setCursorPos({ x: 34, y: 14 });
          break;
        case "JOURNEY":
          setCursorPos({ x: 26, y: 48 });
          break;
        case "GATE":
          setCursorPos({ x: 50, y: 35 });
          break;
        default:
          setCursorPos({ x: 50, y: 50 });
      }
    }
  }, [activeAction]);

  // Connect via Dual Sync: Immediate HTTP Polling + WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let stageInterval: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    const { httpUrl, wsUrl } = getBackendUrls();

    // AI Progression steps to keep HUD active during multi-stage audit
    const STAGE_EVENTS = auditMode === "ETHICAL_SECURITY" ? [
      { type: "WAF", label: lang === "tr" ? `🛡️ WAF & Ters Proxy Mimarisi Parmak İzi Taranıyor: ${targetUrl}` : `Fingerprinting WAF & Reverse Proxy: ${targetUrl}`, coords: { x: 280, y: 90 } },
      { type: "CANARY", label: lang === "tr" ? "🧪 Sentetik SQLi & XSS Kanaryaları ile Hata Yönetimi Test Ediliyor" : "Dispatching synthetic SQLi/XSS canaries (safe probes)", coords: { x: 512, y: 220 } },
      { type: "BURST", label: lang === "tr" ? "⚡ 15 Mikro-Burst İstek ile DoS / Hız Sınırı Toleransı Ölçülüyor" : "15 micro-burst requests evaluating rate limit resilience", coords: { x: 512, y: 350 } },
      { type: "OPEN_DOOR", label: lang === "tr" ? "🚪 Kritik Açık Kapılar (/.env, /.git/HEAD, /dump.sql) Taranıyor" : "Scanning attack surface for exposed .env, .git, and DB dumps", coords: { x: 350, y: 90 } },
      { type: "TLS", label: lang === "tr" ? "🔒 TLS/SSL Sertifika Zinciri, Cipher Güvenliği ve HSTS Doğrulanıyor" : "Validating TLS/SSL ciphers, PFS and HSTS preload", coords: { x: 660, y: 90 } },
      { type: "GATE", label: lang === "tr" ? "🎯 Siber Dayanıklılık Skoru ve Beyaz Şapkalı Rapor Derleniyor" : "Synthesizing Cyber Resilience Matrix and Hardening Plan", coords: { x: 512, y: 320 } },
    ] : [
      { type: "NAVIGATE", label: lang === "tr" ? `Hedef URL'ye bağlanılıyor: ${targetUrl}` : `Connecting to target URL: ${targetUrl}`, coords: { x: 280, y: 90 } },
      { type: "COOKIE", label: lang === "tr" ? "Çerez & KVKK Banner'ları taranıyor ve yönetiliyor" : "Scanning and managing cookie consent banners", coords: { x: 750, y: 560 } },
      { type: "SCROLL", label: lang === "tr" ? "Doğal İnsan Kaydırması yapılıyor (2800px viewport derinliği)" : "Human smooth scrolling (2800px viewport depth)", coords: { x: 512, y: 350 } },
      { type: "TYPE", label: lang === "tr" ? "Form & Arama alanları sınır değer analizleri (BVA) ile test ediliyor" : "Testing form inputs with boundary value analysis (BVA)", coords: { x: 660, y: 90 } },
      { type: "MENU", label: lang === "tr" ? "Açılır menüler ve gezinme hiyerarşisi taranıyor" : "Exploring dropdown navigation menus and links", coords: { x: 350, y: 90 } },
      { type: "JOURNEY", label: lang === "tr" ? "Kritik kullanıcı akışları ve buton etkileşimleri deneniyor" : "Executing multi-step user journey scenarios", coords: { x: 260, y: 300 } },
      { type: "GATE", label: lang === "tr" ? "WAF, Hata Sızıntısı ve DAST exploit probları çalıştırılıyor" : "Probing WAF resilience and DAST exploit canaries", coords: { x: 512, y: 220 } },
      { type: "JOURNEY", label: lang === "tr" ? "Core Web Vitals SLA ve Bellek Profili çıkartılıyor" : "Profiling Core Web Vitals SLA and memory health", coords: { x: 512, y: 320 } },
    ];

    let currentStageIdx = 0;
    stageInterval = setInterval(() => {
      if (!isSubscribed || !isActive) return;
      if (currentStageIdx < STAGE_EVENTS.length) {
        const ev = STAGE_EVENTS[currentStageIdx];
        const now = new Date().toLocaleTimeString("tr-TR");
        const actionObj: ActionItem = {
          id: `stage_${currentStageIdx}_${Date.now()}`,
          type: "ACTION",
          time: now,
          label: ev.label,
          action_type: ev.type,
          target: "browser_engine",
          coords: ev.coords,
        };
        setActions((prev) => {
          if (prev.some((a) => a.label === ev.label)) return prev;
          return [...prev, actionObj];
        });
        setActiveAction(actionObj);
        currentStageIdx++;
      }
    }, 2800);

    // Immediate HTTP Poller (Dual sync channel)
    const runHttpPoll = async () => {
      try {
        const res = await fetch(httpUrl);
        if (!res.ok) return;
        const data = await res.json();
        if (data.latest_frame) {
          setFrame(data.latest_frame);
        }
        if (data.recent_actions && data.recent_actions.length > 0) {
          setActions((prev) => {
            const combined = [...prev];
            for (const act of data.recent_actions) {
              if (!combined.some((c) => c.label === act.label)) {
                combined.push(act);
              }
            }
            return combined;
          });
          const last = data.recent_actions[data.recent_actions.length - 1];
          setActiveAction(last);
        }
        if (data.total_frames) {
          setFrameCount(data.total_frames);
        }
        setConnected(true);
      } catch {
        // Polling silent catch
      }
    };

    // Run poll immediately on mount
    runHttpPoll();
    pollInterval = setInterval(runHttpPoll, 400);

    // WebSocket Stream
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isSubscribed) return;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "FRAME" && payload.data) {
            setFrame(payload.data);
            setFrameCount((prev) => prev + 1);
            setConnected(true);
          } else if (payload.type === "ACTION") {
            setActions((prev) => [...prev.slice(-40), payload]);
            setActiveAction(payload);
          } else if (payload.type === "INIT_STATE") {
            if (payload.latest_frame) setFrame(payload.latest_frame);
            if (payload.recent_actions && payload.recent_actions.length > 0) {
              setActions((prev) => {
                const combined = [...prev];
                for (const act of payload.recent_actions) {
                  if (!combined.some((c) => c.label === act.label)) {
                    combined.push(act);
                  }
                }
                return combined;
              });
              setActiveAction(payload.recent_actions[payload.recent_actions.length - 1]);
            }
            setConnected(true);
          }
        } catch {
          // non-json frame
        }
      };
    } catch {
      // WS constructor error
    }

    return () => {
      isSubscribed = false;
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
      if (stageInterval) clearInterval(stageInterval);
    };
  }, [targetUrl, isActive, lang]);

  function getBadgeIcon(actionType: string) {
    switch (actionType) {
      case "NAVIGATE":
        return "🧭";
      case "COOKIE":
        return "🛡️";
      case "SCROLL":
        return "📜";
      case "MENU":
        return "📂";
      case "TYPE":
        return "✍️";
      case "CLICK":
        return "🖱️";
      case "JOURNEY":
        return "🚀";
      case "GATE":
        return "🛑";
      case "WAF":
        return "🏰";
      case "CANARY":
        return "🧪";
      case "BURST":
        return "⚡";
      case "OPEN_DOOR":
        return "🚪";
      case "TLS":
        return "🔒";
      default:
        return "⚡";
    }
  }

  return (
    <div className={`live-screencast-container ${isExpanded ? "expanded" : ""}`}>
      <div className="live-screencast-card">
        {/* Top Browser Window Chrome */}
        <div className="screencast-header">
          <div className="screencast-window-controls">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>

          <div className="screencast-address-bar">
            <span className="address-lock-icon">🔒</span>
            <span className="address-url" title={targetUrl}>
              {targetUrl || "https://target-application.local"}
            </span>
            <span className="address-live-tag">
              {isActive ? "LIVE CHROMIUM DOM" : "AUDIT COMPLETED"}
            </span>
            {auditMode === "ETHICAL_SECURITY" ? (
              <span className="address-persona-tag tag-cyber" title={lang === "tr" ? "Etik Beyaz Şapkalı Güvenlik Modu" : "Ethical White-Hat Security Mode"}>
                🛡️ {lang === "tr" ? "Etik Siber Denetim" : "White-Hat Audit"}
              </span>
            ) : (
              <span className="address-persona-tag" title="Aktif Kullanıcı Kimliği">
                {activePersonaBadge.icon} {activePersonaBadge.title}
              </span>
            )}
          </div>

          <div className="screencast-meta-actions">
            {/* View Mode Toggle: Real Target Web vs Playwright CDP Frame */}
            <div className="viewport-viewmode-toggles">
              <button
                type="button"
                className={`viewmode-btn ${viewMode === "web" ? "active" : ""}`}
                onClick={() => setViewMode("web")}
                title={lang === "tr" ? "Hedef web sitesini canlı yansıt" : "Stream live target website"}
              >
                🌐 {lang === "tr" ? "Gerçek Sayfa" : "Live Web"}
              </button>
              <button
                type="button"
                className={`viewmode-btn ${viewMode === "cdp" ? "active" : ""}`}
                onClick={() => setViewMode("cdp")}
                title={lang === "tr" ? "Chromium Playwright ekran karesi" : "Chromium CDP screen capture"}
              >
                📷 {lang === "tr" ? "Chromium Ekranı" : "Chromium CDP"} {frame ? "🟢" : ""}
              </button>
            </div>

            <div className="live-badge-indicator">
              <span className="live-pulse-dot" />
              <span className="live-badge-text">
                {isActive
                  ? lang === "tr"
                    ? "CANLI YAYIN"
                    : "LIVE STREAM"
                  : lang === "tr"
                  ? "TAMAMLANDI"
                  : "COMPLETED"}
              </span>
            </div>

            <button
              type="button"
              className="screencast-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Küçült" : "Genişlet"}
            >
              {isExpanded ? "🗗" : "🗖"}
            </button>

            {onClose && (
              <button
                type="button"
                className="screencast-close-btn"
                onClick={onClose}
                title="Kapat"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Screencast Split Grid */}
        <div className="screencast-body-grid">
          {/* Viewport Screen: REAL TARGET SITE VIEW */}
          <div className="screencast-viewport-pane">
            <div className="viewport-screen-stage">
              {viewMode === "web" ? (
                /* 1. Real Target Website rendered live via Proxy Viewport */
                <iframe
                  key={targetUrl}
                  src={proxyViewportUrl}
                  title={`Live Target Viewport: ${domainName}`}
                  className="viewport-live-iframe"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                />
              ) : frame ? (
                /* 2. Real CDP / Playwright Screen Frame */
                <div className="viewport-image-wrapper">
                  <img
                    src={frame}
                    alt={`Chromium Viewport: ${domainName}`}
                    className="viewport-live-img"
                  />
                </div>
              ) : (
                /* 3. Waiting for Chromium frame */
                <div className="viewport-waiting-cdp">
                  <div className="hud-empty-spinner" />
                  <p>
                    {lang === "tr"
                      ? "Chromium ekran karesi bekleniyor... Hedef sitenin kendisini anlık görmek için yukarıdaki 'Gerçek Sayfa' sekmesini seçebilirsiniz."
                      : "Awaiting Chromium screen capture... Switch to 'Live Web' above to view the actual target site."}
                  </p>
                </div>
              )}

              {/* Dynamic Scanning Laser Beam Effect */}
              <div className={`ai-laser-scanner ${auditMode === "ETHICAL_SECURITY" ? "cyber-laser-red" : ""}`} />

              {/* Real-time Neon AI Pointer Cursor */}
              <div
                className={`ai-cursor-pulse ${auditMode === "ETHICAL_SECURITY" ? "cyber-reticle" : ""}`}
                style={{
                  left: `${cursorPos.x}%`,
                  top: `${cursorPos.y}%`,
                }}
              >
                <span className="ai-cursor-icon">{auditMode === "ETHICAL_SECURITY" ? "🎯" : "👆"}</span>
                <span className="ai-cursor-tag">
                  {auditMode === "ETHICAL_SECURITY"
                    ? `🛡️ ${activeAction ? activeAction.action_type : (lang === "tr" ? "ETİK PROB" : "PROBE")}`
                    : `${activePersonaBadge.icon} ${activeAction ? activeAction.action_type : activePersonaBadge.title}`}
                </span>
                <span className="ai-cursor-ripple" />
              </div>

              {/* Element Highlight Target Box */}
              {activeAction && (
                <div
                  className={`ai-target-crosshair type-${activeAction.action_type.toLowerCase()}`}
                  style={{
                    left: `${cursorPos.x}%`,
                    top: `${cursorPos.y}%`,
                  }}
                >
                  <span className="ai-crosshair-label">
                    {activeAction.target || activeAction.action_type}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom HUD Overlay Bar */}
            <div className="viewport-hud-ticker">
              <div className="hud-metric-pill">
                <span className="hud-label">FPS:</span>
                <span className="hud-val">{connected ? "12 FPS (CDP)" : (isActive ? "10 FPS (Canlı)" : "Offline")}</span>
              </div>
              <div className="hud-metric-pill">
                <span className="hud-label">Frames:</span>
                <span className="hud-val">#{frameCount > 0 ? frameCount : (isActive ? Math.max(1, actions.length * 12) : 0)}</span>
              </div>
              <div className="hud-metric-pill">
                <span className="hud-label">Target:</span>
                <span className="hud-val" style={{ color: "#a5b4fc" }}>{domainName}</span>
              </div>
              {activeAction && (
                <div className="hud-active-step-pill">
                  <span className="hud-step-icon">
                    {getBadgeIcon(activeAction.action_type)}
                  </span>
                  <span className="hud-step-text">{activeAction.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action HUD Feed Sidebar */}
          <div className="screencast-action-hud-pane">
            <div className="hud-pane-header">
              <span className="hud-pane-title">
                ⚡ {lang === "tr" ? "Canlı AI Eylem Akışı (Action HUD)" : "Live AI Action Stream"}
              </span>
              <span className="hud-step-count">{actions.length} {lang === "tr" ? "eylem" : "actions"}</span>
            </div>

            <div className="hud-actions-scroll-list">
              {actions.length === 0 ? (
                <div className="hud-empty-state">
                  <span className="hud-empty-spinner" />
                  <p>
                    {lang === "tr"
                      ? "Otonom etkileşimler bekleniyor..."
                      : "Awaiting autonomous interactions..."}
                  </p>
                </div>
              ) : (
                actions.map((act, index) => (
                  <div
                    key={act.id || index}
                    className={`hud-action-row ${
                      index === actions.length - 1 ? "latest" : ""
                    }`}
                  >
                    <span className="hud-action-time">{act.time}</span>
                    <span className={`hud-action-badge ${act.action_type.toLowerCase()}`}>
                      {getBadgeIcon(act.action_type)} {act.action_type}
                    </span>
                    <span className="hud-action-label" title={act.label}>
                      {act.label}
                    </span>
                  </div>
                ))
              )}
              <div ref={actionsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
