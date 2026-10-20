import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_health_check_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_ssrf_blocked_at_api_layer():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/scan", json={"url": "http://127.0.0.1:8000"})
        assert response.status_code == 400
        assert "SSRF Protection" in response.json().get("detail", "")

@pytest.mark.asyncio
async def test_invalid_body_validation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/scan", json={})
        assert response.status_code == 422
