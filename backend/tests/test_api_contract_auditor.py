import json
import pytest
import httpx
from app.services.api_contract_auditor import APIContractDriftAuditor
from app.models.schema import NetworkRequestTrace, SchemaDriftType, Severity

SAMPLE_OPENAPI_SPEC = {
    "openapi": "3.0.1",
    "info": {
        "title": "FinTech Core Banking API",
        "version": "2.4.0"
    },
    "paths": {
        "/api/accounts": {
            "get": {
                "summary": "Müşteri Hesap Listesi",
                "responses": {
                    "200": {
                        "description": "Başarılı hesap listesi",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["account_id", "balance", "currency"],
                                    "properties": {
                                        "account_id": {"type": "integer"},
                                        "balance": {"type": "number"},
                                        "currency": {"type": "string"},
                                        "is_active": {"type": "boolean"}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/api/v1/legacy-transfer": {
            "post": {
                "summary": "Eski Para Transferi",
                "deprecated": True,
                "responses": {
                    "200": {"description": "Transfer tamamlandı"}
                }
            }
        }
    }
}

@pytest.mark.asyncio
async def test_discover_openapi_spec_and_parse():
    def mock_handler(request: httpx.Request):
        if request.url.path == "/openapi.json":
            return httpx.Response(200, json=SAMPLE_OPENAPI_SPEC, headers={"content-type": "application/json"})
        return httpx.Response(404)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://banking.local") as client:
        auditor = APIContractDriftAuditor()
        report, findings = await auditor.audit_contract_and_drift("http://banking.local", client=client)

    assert report.spec_detected is True
    assert report.spec_title == "FinTech Core Banking API"
    assert report.spec_version == "2.4.0"
    assert report.documented_endpoints_count >= 2

@pytest.mark.asyncio
async def test_schema_drift_type_mismatch():
    # Runtime response returns account_id as string instead of integer
    runtime_trace = NetworkRequestTrace(
        url="http://banking.local/api/accounts",
        method="GET",
        status=200,
        resource_type="fetch",
        duration_ms=42.0,
        content_type="application/json",
        response_body=json.dumps({
            "account_id": "ACC-998822",  # Spec expects integer!
            "balance": 1500.50,
            "currency": "TRY",
            "is_active": True
        })
    )

    auditor = APIContractDriftAuditor()
    report, findings = await auditor.audit_contract_and_drift(
        "http://banking.local",
        network_traces=[runtime_trace],
        spec_content=SAMPLE_OPENAPI_SPEC
    )

    type_drifts = [d for d in report.drifts if d.drift_type == SchemaDriftType.TYPE_MISMATCH]
    assert len(type_drifts) == 1
    assert type_drifts[0].field_path == "account_id"
    assert "integer" in type_drifts[0].expected_contract
    assert report.contract_compatibility_score < 100
    assert any(f.id == "API_SCHEMA_DRIFT_DETECTED" for f in findings)

@pytest.mark.asyncio
async def test_schema_drift_missing_required_field():
    # Runtime response misses required 'currency' field
    runtime_trace = NetworkRequestTrace(
        url="http://banking.local/api/accounts",
        method="GET",
        status=200,
        resource_type="fetch",
        duration_ms=35.0,
        content_type="application/json",
        response_body=json.dumps({
            "account_id": 1001,
            "balance": 5000.0
            # 'currency' is required but omitted
        })
    )

    auditor = APIContractDriftAuditor()
    report, findings = await auditor.audit_contract_and_drift(
        "http://banking.local",
        network_traces=[runtime_trace],
        spec_content=SAMPLE_OPENAPI_SPEC
    )

    missing_drifts = [d for d in report.drifts if d.drift_type == SchemaDriftType.MISSING_REQUIRED_FIELD]
    assert len(missing_drifts) == 1
    assert missing_drifts[0].field_path == "currency"
    assert missing_drifts[0].severity == Severity.HIGH

@pytest.mark.asyncio
async def test_undocumented_shadow_api_detection():
    # Frontend calls an internal endpoint not present in the OpenAPI spec
    runtime_trace = NetworkRequestTrace(
        url="http://banking.local/api/internal/dev-feature-flags",
        method="POST",
        status=200,
        resource_type="xhr",
        duration_ms=25.0,
        content_type="application/json",
        response_body=json.dumps({"flags": ["fast_transfer_beta"]})
    )

    auditor = APIContractDriftAuditor()
    report, findings = await auditor.audit_contract_and_drift(
        "http://banking.local",
        network_traces=[runtime_trace],
        spec_content=SAMPLE_OPENAPI_SPEC
    )

    assert report.shadow_endpoints_count >= 1
    shadow_drifts = [d for d in report.drifts if d.drift_type == SchemaDriftType.UNDOCUMENTED_SHADOW_API]
    assert len(shadow_drifts) >= 1
    assert shadow_drifts[0].endpoint == "/api/internal/dev-feature-flags"
    assert any(f.id == "API_SHADOW_ENDPOINT_UNDOCUMENTED" for f in findings)

@pytest.mark.asyncio
async def test_deprecated_endpoint_traffic_detection():
    # Frontend calls deprecated route
    runtime_trace = NetworkRequestTrace(
        url="http://banking.local/api/v1/legacy-transfer",
        method="POST",
        status=200,
        resource_type="fetch",
        duration_ms=60.0,
        content_type="application/json",
        response_body=json.dumps({"success": True})
    )

    auditor = APIContractDriftAuditor()
    report, findings = await auditor.audit_contract_and_drift(
        "http://banking.local",
        network_traces=[runtime_trace],
        spec_content=SAMPLE_OPENAPI_SPEC
    )

    dep_drifts = [d for d in report.drifts if d.drift_type == SchemaDriftType.DEPRECATED_ENDPOINT_ACTIVE]
    assert len(dep_drifts) == 1
    assert dep_drifts[0].endpoint == "/api/v1/legacy-transfer"
