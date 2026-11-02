import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.prd_agent import analyze_prd_and_generate_tests, _heuristic_prd_analysis
from app.models.schema import PRDAnalysisResponse


@pytest.mark.asyncio
async def test_heuristic_prd_analysis_auth_flow():
    prd_text = """
    # Authentication System Specification
    As a registered user, I want to sign in with my email and password so that I can access my dashboard.
    Acceptance criteria:
    - User enters valid credentials and clicks sign in.
    - System verifies session and redirects to /dashboard.
    """
    res = await analyze_prd_and_generate_tests(prd_text, "https://example.com")
    assert isinstance(res, PRDAnalysisResponse)
    assert len(res.scenarios) > 0
    assert any("Auth" in s.title or "Session" in s.title for s in res.scenarios)
    assert "import { test, expect } from '@playwright/test';" in res.generated_spec_code
    assert "https://example.com" in res.generated_spec_code


@pytest.mark.asyncio
async def test_heuristic_prd_analysis_ecommerce_flow():
    prd_text = """
    ## Checkout & Cart Feature
    As a customer, I want to add products to my cart and proceed to checkout.
    - Must validate payment details
    - Must show order confirmation receipt
    """
    res = _heuristic_prd_analysis(prd_text, "https://shop.example.com")
    assert len(res.scenarios) > 0
    checkout_sc = next((s for s in res.scenarios if "Checkout" in s.title or "Order" in s.title), None)
    assert checkout_sc is not None
    assert len(checkout_sc.steps) >= 3
    assert len(checkout_sc.edge_cases) >= 1


@pytest.mark.asyncio
async def test_prd_analyze_api_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/prd/analyze",
            json={
                "target_url": "https://example.com",
                "prd_text": "Users should be able to search for items dynamically."
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "scenarios" in data
        assert "generated_spec_code" in data
        assert len(data["scenarios"]) > 0


@pytest.mark.asyncio
async def test_prd_analyze_ssrf_blocked():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/prd/analyze",
            json={
                "target_url": "http://127.0.0.1:8000/admin",
                "prd_text": "Internal admin requirements"
            }
        )
        assert response.status_code == 400
        assert "SSRF Protection" in response.json().get("detail", "")
