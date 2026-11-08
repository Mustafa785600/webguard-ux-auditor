import pytest
from app.models.schema import PerformanceMetrics

def test_performance_metrics_model_with_vitals():
    m = PerformanceMetrics(
        total_requests=10,
        concurrency=5,
        success_rate=100.0,
        avg_latency_ms=120.5,
        min_latency_ms=45.0,
        p50_latency_ms=110.0,
        p90_latency_ms=180.0,
        p95_latency_ms=210.0,
        p99_latency_ms=250.0,
        max_latency_ms=260.0,
        throughput_req_per_sec=42.5,
        sla_status="EXCELLENT",
        status_codes={200: 10},
        samples=[100.0, 110.0, 120.0],
        ttfb_ms=65.0,
        fcp_ms=750.0,
        lcp_ms=1200.0,
        dom_load_ms=900.0,
        window_load_ms=1850.0,
        total_dom_nodes=620,
        total_page_size_kb=840.0,
        heavy_resources=[{"name": "banner.jpg", "size_kb": 1250, "initiator": "img"}],
    )

    assert m.fcp_ms == 750.0
    assert m.lcp_ms == 1200.0
    assert m.dom_load_ms == 900.0
    assert m.window_load_ms == 1850.0
    assert m.total_dom_nodes == 620
    assert len(m.heavy_resources) == 1
    assert m.sla_status == "EXCELLENT"

