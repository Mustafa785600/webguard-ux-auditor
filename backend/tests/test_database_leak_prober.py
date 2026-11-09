import pytest
import httpx
from app.services.database_leak_prober import DatabaseLeakSlowQueryProber
from app.models.schema import (
    NetworkRequestTrace,
    DatabaseLeakType,
    SlowQuerySeverity,
    Severity,
    Category,
)

@pytest.mark.asyncio
async def test_detect_sql_syntax_error_leak():
    """PostgreSQL ve MySQL hata mesajı sızıntısının tespitini test eder."""
    prober = DatabaseLeakSlowQueryProber()

    traces = [
        NetworkRequestTrace(
            url="https://test.local/api/users?id=1'",
            method="GET",
            status=500,
            duration_ms=45.0,
            resource_type="fetch",
            response_body="Fatal error: PG::SyntaxError: ERROR: syntax error at or near \"'\" at character 42",
        ),
        NetworkRequestTrace(
            url="https://test.local/api/search?q=test",
            method="GET",
            status=200,
            duration_ms=50.0,
            resource_type="fetch",
            response_body='{"items": ["item1", "item2"]}',
        ),
    ]

    # Mock client ile zaman probu
    def handler(request: httpx.Request):
        return httpx.Response(200, json={"status": "ok"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        report, findings = await prober.audit("https://test.local", network_traces=traces, client=client)

    assert report.total_leaks_count >= 1
    assert any(l.leak_type == DatabaseLeakType.SQL_SYNTAX_ERROR for l in report.leaks)
    assert "PostgreSQL" in report.detected_engines
    assert any("CWE-209" in (f.compliance_standard or "") for f in findings)
    assert report.db_health_score < 100


@pytest.mark.asyncio
async def test_detect_connection_string_leak():
    """Açık veritabanı bağlantı URI'si sızıntısının ve şifre maskelemesinin testidir."""
    prober = DatabaseLeakSlowQueryProber()

    traces = [
        NetworkRequestTrace(
            url="https://test.local/api/debug/config",
            method="GET",
            status=200,
            duration_ms=25.0,
            resource_type="fetch",
            response_body='{"database_url": "postgres://admin:superSecretP@ssword123@db.internal.aws:5432/production_app"}',
        )
    ]

    def handler(request: httpx.Request):
        return httpx.Response(200, json={"status": "ok"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        report, findings = await prober.audit("https://test.local", network_traces=traces, client=client)

    conn_leaks = [l for l in report.leaks if l.leak_type == DatabaseLeakType.CONNECTION_STRING]
    assert len(conn_leaks) == 1
    leak = conn_leaks[0]
    assert leak.severity == Severity.CRITICAL
    # Şifre maskelenmiş olmalı
    assert "superSecretP@ssword123" not in leak.leak_sample
    assert "*****" in leak.leak_sample
    assert any("CWE-200" in (f.compliance_standard or "") for f in findings)


@pytest.mark.asyncio
async def test_detect_slow_queries_and_n_plus_one():
    """Yavaş sorgu SLA ihlali ve N+1 sorgu paterninin tespitini test eder."""
    prober = DatabaseLeakSlowQueryProber()

    # 1 adet çok yavaş sorgu + 5 adet N+1 ardışık alt istek
    traces = [
        NetworkRequestTrace(
            url="https://test.local/api/reports/heavy-summary",
            method="GET",
            status=200,
            duration_ms=2800.0,  # 2.8 saniye (CRITICAL)
            resource_type="fetch",
            response_body='{"data": "heavy"}',
        ),
        NetworkRequestTrace(
            url="https://test.local/api/items/1",
            method="GET",
            status=200,
            duration_ms=60.0,
            resource_type="fetch",
            response_body='{"id": 1}',
        ),
        NetworkRequestTrace(
            url="https://test.local/api/items/2",
            method="GET",
            status=200,
            duration_ms=62.0,
            resource_type="fetch",
            response_body='{"id": 2}',
        ),
        NetworkRequestTrace(
            url="https://test.local/api/items/3",
            method="GET",
            status=200,
            duration_ms=58.0,
            resource_type="fetch",
            response_body='{"id": 3}',
        ),
        NetworkRequestTrace(
            url="https://test.local/api/items/4",
            method="GET",
            status=200,
            duration_ms=65.0,
            resource_type="fetch",
            response_body='{"id": 4}',
        ),
        NetworkRequestTrace(
            url="https://test.local/api/items/5",
            method="GET",
            status=200,
            duration_ms=64.0,
            resource_type="fetch",
            response_body='{"id": 5}',
        ),
    ]

    def handler(request: httpx.Request):
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        report, findings = await prober.audit("https://test.local", network_traces=traces, client=client)

    assert report.slow_queries_count >= 1
    # Ağır sorgu kontrolü
    critical_slow = [q for q in report.slow_queries if q.severity == SlowQuerySeverity.CRITICAL]
    assert len(critical_slow) == 1
    assert critical_slow[0].observed_latency_ms == 2800.0

    # N+1 kontrolü
    assert report.n_plus_one_suspects_count >= 1
    assert any("N+1" in q.suspected_cause for q in report.slow_queries)
    assert any("N+1" in f.title for f in findings)


@pytest.mark.asyncio
async def test_clean_session_database_health():
    """Hata ve gecikme içermeyen temiz oturumun 100 tam puan almasını test eder."""
    prober = DatabaseLeakSlowQueryProber()

    traces = [
        NetworkRequestTrace(
            url="https://test.local/api/ping",
            method="GET",
            status=200,
            duration_ms=35.0,
            resource_type="fetch",
            response_body='{"pong": true}',
        )
    ]

    def handler(request: httpx.Request):
        return httpx.Response(200, json={"status": "healthy"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        report, findings = await prober.audit("https://test.local", network_traces=traces, client=client)

    assert report.total_leaks_count == 0
    assert report.slow_queries_count == 0
    assert report.n_plus_one_suspects_count == 0
    assert report.db_health_score == 100
    assert len(findings) == 0
