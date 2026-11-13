"""
Live Browser Screencast & Action HUD Engine (TestSprite style).

Streams real-time Chromium viewport frames and AI interaction telemetry
to the Web Dashboard over WebSocket with HTTP polling fallback.
"""

import asyncio
from collections import deque
from datetime import datetime
import time
from typing import Dict, Any, List, Optional, Set
from fastapi import WebSocket


class LiveStreamHub:
    """
    Central real-time broadcaster for active scan sessions:
    - Distributes live viewport JPEG frames to connected clients
    - Dispatches instant Action HUD ticker events (Clicks, Scrolls, Form inputs, Cookie dismissals)
    """

    def __init__(self):
        self.is_active: bool = False
        self.target_url: str = ""
        self.latest_frame_b64: Optional[str] = None
        self.recent_actions: deque = deque(maxlen=50)
        self.active_clients: Set[WebSocket] = set()
        self.total_frames_emitted: int = 0
        self.started_at: Optional[float] = None

    @staticmethod
    def _create_initial_placeholder_svg(url: str) -> str:
        import base64
        clean = url.replace("https://", "").replace("http://", "").split("/")[0]
        domain_name = clean if clean else "target-site.com"
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="640" viewBox="0 0 1024 640">
  <rect width="1024" height="640" fill="#0b0f19"/>
  <rect width="1024" height="44" fill="#111827"/>
  <circle cx="22" cy="22" r="5" fill="#ef4444"/>
  <circle cx="38" cy="22" r="5" fill="#f59e0b"/>
  <circle cx="54" cy="22" r="5" fill="#10b981"/>
  <rect x="80" y="10" width="720" height="24" rx="4" fill="#1f2937" stroke="#374151" stroke-width="1"/>
  <text x="95" y="26" fill="#10b981" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11">🔒 https://{domain_name}/</text>
  <rect y="44" width="1024" height="56" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <rect x="36" y="58" width="130" height="26" rx="4" fill="#2563eb" opacity="0.9"/>
  <text x="46" y="75" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="bold" font-size="13">{domain_name.upper()}</text>
  <rect x="250" y="64" width="60" height="14" rx="3" fill="#334155"/>
  <rect x="330" y="64" width="60" height="14" rx="3" fill="#334155"/>
  <rect x="410" y="64" width="60" height="14" rx="3" fill="#334155"/>
  <rect x="880" y="58" width="100" height="26" rx="5" fill="#6366f1"/>
  <text x="905" y="75" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11">Giriş Yap</text>
  <rect x="36" y="130" width="540" height="28" rx="4" fill="#1e293b"/>
  <text x="46" y="150" fill="#f8fafc" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="bold" font-size="16">{domain_name} - Otonom UX &amp; Güvenlik Denetimi</text>
  <rect x="36" y="172" width="420" height="14" rx="3" fill="#334155"/>
  <rect x="36" y="196" width="340" height="14" rx="3" fill="#334155"/>
  <rect x="36" y="230" width="120" height="32" rx="5" fill="#2563eb"/>
  <text x="60" y="251" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="bold" font-size="12">Keşfet</text>
  <rect x="168" y="230" width="120" height="32" rx="5" fill="#1e293b" stroke="#2563eb" stroke-width="1"/>
  <text x="195" y="251" fill="#93c5fd" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="12">İncele</text>
  <rect x="36" y="295" width="295" height="170" rx="8" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <rect x="56" y="315" width="46" height="46" rx="6" fill="#1e293b"/>
  <rect x="56" y="380" width="160" height="16" rx="3" fill="#334155"/>
  <rect x="56" y="408" width="220" height="11" rx="3" fill="#1e293b"/>
  <rect x="56" y="426" width="180" height="11" rx="3" fill="#1e293b"/>
  <rect x="360" y="295" width="295" height="170" rx="8" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <rect x="380" y="315" width="46" height="46" rx="6" fill="#1e293b"/>
  <rect x="380" y="380" width="160" height="16" rx="3" fill="#334155"/>
  <rect x="380" y="408" width="220" height="11" rx="3" fill="#1e293b"/>
  <rect x="380" y="426" width="180" height="11" rx="3" fill="#1e293b"/>
  <rect x="684" y="295" width="295" height="170" rx="8" fill="#111827" stroke="#1f2937" stroke-width="1"/>
  <rect x="704" y="315" width="46" height="46" rx="6" fill="#1e293b"/>
  <rect x="704" y="380" width="160" height="16" rx="3" fill="#334155"/>
  <rect x="704" y="408" width="220" height="11" rx="3" fill="#1e293b"/>
  <rect x="704" y="426" width="180" height="11" rx="3" fill="#1e293b"/>
  <rect x="180" y="520" width="664" height="64" rx="8" fill="#0f172a" stroke="#2563eb" stroke-width="1"/>
  <text x="205" y="555" fill="#e2e8f0" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11.5">🍪 Bu sitede kullanıcı deneyimini geliştirmek için KVKK ve Çerez Politikası uygulanmaktadır.</text>
  <rect x="635" y="538" width="95" height="26" rx="4" fill="#ef4444" opacity="0.85"/>
  <text x="645" y="555" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="bold" font-size="10.5">Tümünü Reddet</text>
  <rect x="738" y="538" width="85" height="26" rx="4" fill="#10b981" opacity="0.85"/>
  <text x="752" y="555" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="bold" font-size="10.5">Kabul Et</text>
  <line x1="0" y1="270" x2="1024" y2="270" stroke="#06b6d4" stroke-width="2" opacity="0.75"/>
</svg>'''
        encoded = base64.b64encode(svg.encode("utf-8")).decode("utf-8")
        return f"data:image/svg+xml;base64,{encoded}"

    def start_session(self, target_url: str):
        self.is_active = True
        self.target_url = target_url
        self.latest_frame_b64 = self._create_initial_placeholder_svg(target_url)
        self.recent_actions.clear()
        self.total_frames_emitted = 1
        self.started_at = time.time()
        self.record_action(
            label=f"Canlı tarayıcı oturumu başlatıldı: {target_url}",
            action_type="NAVIGATE",
            target="browser_window",
            coords={"x": 512, "y": 22}
        )

    def end_session(self, summary: str = "Oturum tamamlandı."):
        self.is_active = False
        self.record_action(label=summary, action_type="COMPLETE", target="system")

    def record_action(
        self,
        label: str,
        action_type: str = "ACTION",
        target: str = "",
        details: str = "",
        coords: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """
        Records an interaction event and broadcasts it immediately to active live stream clients.
        """
        now = datetime.now()
        timestamp = now.strftime("%H:%M:%S")

        action_data = {
            "type": "ACTION",
            "time": timestamp,
            "label": label,
            "action_type": action_type,
            "target": target,
            "details": details,
            "coords": coords,
            "id": f"act_{len(self.recent_actions)+1}_{int(time.time()*1000)}"
        }

        self.recent_actions.append(action_data)

        # Broadcast asynchronously to connected WebSocket clients
        if self.active_clients:
            asyncio.create_task(self._broadcast_json(action_data))

        return action_data

    async def broadcast_frame(self, frame_b64: str):
        """
        Updates the latest frame and broadcasts to WebSocket clients with throttling.
        """
        if not frame_b64.startswith("data:image"):
            clean_b64 = f"data:image/jpeg;base64,{frame_b64}"
        else:
            clean_b64 = frame_b64

        self.latest_frame_b64 = clean_b64
        self.total_frames_emitted += 1

        # Throttle WebSocket emissions to prevent TCP queue buffer drops (max ~12 FPS)
        now = time.time()
        last_t = getattr(self, "_last_ws_send_time", 0.0)
        if (now - last_t) < 0.08:
            return
        self._last_ws_send_time = now

        if self.active_clients:
            message = {
                "type": "FRAME",
                "data": clean_b64,
                "fps_est": 12,
                "frame_num": self.total_frames_emitted
            }
            await self._broadcast_json(message)

    async def _broadcast_json(self, payload: Dict[str, Any]):
        disconnected: Set[WebSocket] = set()
        for ws in list(self.active_clients):
            try:
                await ws.send_json(payload)
            except Exception:
                disconnected.add(ws)

        for dead in disconnected:
            self.active_clients.discard(dead)

    async def register_client(self, ws: WebSocket):
        await ws.accept()
        self.active_clients.add(ws)

        # Send initial hydration state
        initial_payload = {
            "type": "INIT_STATE",
            "is_active": self.is_active,
            "target_url": self.target_url,
            "latest_frame": self.latest_frame_b64,
            "recent_actions": list(self.recent_actions)
        }
        try:
            await ws.send_json(initial_payload)
        except Exception:
            pass

    def unregister_client(self, ws: WebSocket):
        self.active_clients.discard(ws)

    def get_state(self) -> Dict[str, Any]:
        """
        HTTP polling snapshot endpoint data.
        """
        return {
            "is_active": self.is_active,
            "target_url": self.target_url,
            "total_frames": self.total_frames_emitted,
            "latest_frame": self.latest_frame_b64,
            "recent_actions": list(self.recent_actions),
            "client_count": len(self.active_clients)
        }


# Global singleton hub
live_hub = LiveStreamHub()


class CDPScreencastManager:
    """
    Connects to Playwright's Page via Chrome DevTools Protocol (CDP)
    to stream live viewport frames during an active audit.
    """

    @classmethod
    async def attach_screencast(cls, context, page) -> Optional[Any]:
        """
        Initiates CDP Page.startScreencast and hooks frame acknowledgment.
        """
        try:
            cdp = await context.new_cdp_session(page)
            await cdp.send("Page.enable")

            async def on_frame_event(event):
                try:
                    data = event.get("data")
                    session_id = event.get("sessionId")
                    if session_id is not None:
                        await cdp.send("Page.screencastFrameAck", {"sessionId": session_id})
                    if data:
                        await live_hub.broadcast_frame(data)
                except Exception:
                    pass

            cdp.on("Page.screencastFrame", on_frame_event)

            await cdp.send("Page.startScreencast", {
                "format": "jpeg",
                "quality": 50,
                "maxWidth": 1024,
                "maxHeight": 640,
                "everyNthFrame": 1
            })

            return cdp
        except Exception as exc:
            # Fallback will use periodic screenshot broadcasting
            return None

    @classmethod
    async def stop_screencast(cls, cdp) -> None:
        if not cdp:
            return
        try:
            await cdp.send("Page.stopScreencast")
            await cdp.detach()
        except Exception:
            pass

