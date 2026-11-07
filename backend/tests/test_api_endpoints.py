import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_ssrf_blocked_at_api_layer():
    response = client.post("/api/v1/scan", json={"url": "http://127.0.0.1:8000"})
    assert response.status_code == 400
    assert "SSRF Protection" in response.json().get("detail", "")

def test_invalid_body_validation():
    response = client.post("/api/v1/scan", json={})
    assert response.status_code == 422

def test_auto_heal_api_endpoint():
    brittle_code = "await page.click('.css-12345');\nawait page.waitForTimeout(3000);"
    response = client.post("/api/v1/auto-heal/analyze", json={"script_code": brittle_code})
    assert response.status_code == 200
    data = response.json()
    assert "healed_code" in data
    assert len(data["repairs"]) >= 2
    assert data["resilience_score_after"] > data["resilience_score_before"]

def test_codebase_intelligence_endpoint():
    response = client.get("/api/v1/codebase/intelligence")
    assert response.status_code == 200
    data = response.json()
    assert data["total_symbols"] > 0
    assert data["total_files"] > 0
    assert len(data["full_stack_flows"]) >= 4
    assert "symbols" in data
