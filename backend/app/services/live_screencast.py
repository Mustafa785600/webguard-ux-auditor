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

    def start_session(self, target_url: str):
        self.is_active = True
        self.target_url = target_url
        self.latest_frame_b64 = None
        self.recent_actions.clear()
        self.total_frames_emitted = 0
        self.started_at = time.time()
        self.record_action(
            label=f"Canlı tarayıcı oturumu başlatıldı: {target_url}",
            action_type="NAVIGATE",
            target="browser_window"
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
        Updates the latest frame and broadcasts to WebSocket clients.
        """
        if not frame_b64.startswith("data:image"):
            clean_b64 = f"data:image/jpeg;base64,{frame_b64}"
        else:
            clean_b64 = frame_b64

        self.latest_frame_b64 = clean_b64
        self.total_frames_emitted += 1

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

