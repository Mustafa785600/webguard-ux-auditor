"use client";

import React, { useState, useEffect, useRef } from "react";

interface ActionItem {
  id: string;
  type: string;
  time: string;
  label: string;
  action_type: string;
  target?: string;
  details?: string;
}

interface LiveScreencastPanelProps {
  targetUrl: string;
  isActive: boolean;
  lang?: "tr" | "en";
  onClose?: () => void;
}

export default function LiveScreencastPanel({
  targetUrl,
  isActive,
  lang = "tr",
  onClose,
}: LiveScreencastPanelProps) {
  const [frame, setFrame] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [activeAction, setActiveAction] = useState<ActionItem | null>(null);
  const actionsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll action log
  useEffect(() => {
    actionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [actions]);

  // Connect via WebSocket with HTTP polling fallback
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    function startHttpPolling() {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch("http://localhost:8000/api/v1/screencast/state");
          if (!res.ok) return;
          const data = await res.json();
          if (data.latest_frame) {
            setFrame(data.latest_frame);
          }
          if (data.recent_actions && data.recent_actions.length > 0) {
            setActions(data.recent_actions);
            setActiveAction(data.recent_actions[data.recent_actions.length - 1]);
          }
          setFrameCount(data.total_frames || 0);
          setConnected(true);
        } catch {
          // ignore polling errors
        }
      }, 350);
    }

    try {
      const wsUrl = "ws://localhost:8000/api/v1/ws/screencast";
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
          } else if (payload.type === "ACTION") {
            setActions((prev) => [...prev.slice(-40), payload]);
            setActiveAction(payload);
          } else if (payload.type === "INIT_STATE") {
            if (payload.latest_frame) setFrame(payload.latest_frame);
            if (payload.recent_actions) setActions(payload.recent_actions);
            if (payload.recent_actions?.length > 0) {
              setActiveAction(payload.recent_actions[payload.recent_actions.length - 1]);
            }
          }
        } catch {
          // non-json frame
        }
      };

      ws.onerror = () => {
        startHttpPolling();
      };

      ws.onclose = () => {
        startHttpPolling();
      };
    } catch {
      startHttpPolling();
    }

    return () => {
      isSubscribed = false;
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

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
      default:
        return "⚡";
    }
  }

  return (
    <div className={`live-screencast-container ${isExpanded ? "expanded" : ""}`}>
      <div className="live-screencast-card">
        {/* Top Window Bar */}
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
          </div>

          <div className="screencast-meta-actions">
            <div className="live-badge-indicator">
              <span className="live-pulse-dot" />
              <span className="live-badge-text">
                {isActive
                  ? lang === "tr"
                    ? "CANLI YAYIN (LIVE HUD)"
                    : "LIVE STREAM (HUD)"
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
          {/* Viewport Screen */}
          <div className="screencast-viewport-pane">
            {frame ? (
              <div className="viewport-image-wrapper">
                <img
                  src={frame}
                  alt="Live Browser Viewport"
                  className="viewport-live-img"
                />
                {/* Simulated Neon AI Cursor Indicator */}
                {activeAction && (
                  <div className="ai-cursor-pulse">
                    <span className="ai-cursor-icon">👆</span>
                    <span className="ai-cursor-tag">
                      {activeAction.action_type}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="viewport-placeholder-radar">
                <div className="radar-scanner" />
                <div className="radar-content">
                  <div className="radar-icon">🤖</div>
                  <div className="radar-title">
                    {lang === "tr"
                      ? "Otonom Tarayıcı Motoru Bağlanıyor..."
                      : "Connecting Autonomous Browser Engine..."}
                  </div>
                  <div className="radar-subtitle">
                    {lang === "tr"
                      ? "CDP Screencast hattı kuruluyor ve DOM hidratasyonu dinleniyor."
                      : "Establishing CDP screencast pipeline and DOM hydration."}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom HUD Overlay Bar */}
            <div className="viewport-hud-ticker">
              <div className="hud-metric-pill">
                <span className="hud-label">FPS:</span>
                <span className="hud-val">{connected ? "12 FPS" : "Offline"}</span>
              </div>
              <div className="hud-metric-pill">
                <span className="hud-label">Frames:</span>
                <span className="hud-val">#{frameCount}</span>
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
