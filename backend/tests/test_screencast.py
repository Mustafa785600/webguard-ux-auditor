import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.live_screencast import LiveStreamHub, live_hub


def test_live_stream_hub_session_lifecycle():
    hub = LiveStreamHub()
    assert hub.is_active is False

    hub.start_session("https://example.com/portal")
    assert hub.is_active is True
    assert hub.target_url == "https://example.com/portal"

    act = hub.record_action(
        label="Çerez 'Tümünü Reddet' tıklandı",
        action_type="COOKIE",
        target="button#reject"
    )
    assert act["action_type"] == "COOKIE"
    assert len(hub.recent_actions) >= 2  # start action + cookie action

    state = hub.get_state()
    assert state["is_active"] is True
    assert state["target_url"] == "https://example.com/portal"

    hub.end_session()
    assert hub.is_active is False


@pytest.mark.asyncio
async def test_live_stream_hub_broadcast_frame():
    hub = LiveStreamHub()
    raw_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

    await hub.broadcast_frame(raw_b64)
    assert hub.total_frames_emitted == 1
    assert hub.latest_frame_b64.startswith("data:image/jpeg;base64,")


@pytest.mark.asyncio
async def test_screencast_http_state_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/screencast/state")
        assert response.status_code == 200
        data = response.json()
        assert "is_active" in data
        assert "recent_actions" in data
        assert "total_frames" in data


@pytest.mark.asyncio
async def test_proxy_viewport_ssrf_blocked():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/proxy/viewport?url=http://127.0.0.1:8000")
        assert response.status_code == 200
        assert "SSRF Koruması Devrede" in response.text


