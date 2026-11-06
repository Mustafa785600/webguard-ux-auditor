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

@pytest.mark.asyncio
async def test_auto_heal_api_endpoint():
    brittle_code = "await page.click('.css-12345');\nawait page.waitForTimeout(3000);"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/auto-heal/analyze", json={"script_code": brittle_code})
        assert response.status_code == 200
        data = response.json()
        assert "healed_code" in data
        assert len(data["repairs"]) >= 2
        assert data["resilience_score_after"] > data["resilience_score_before"]

