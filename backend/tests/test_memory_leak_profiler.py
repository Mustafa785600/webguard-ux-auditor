import pytest
from app.services.memory_leak_profiler import MemoryLeakProfilerEngine
from app.models.schema import (
    MemoryLeakType,
    Severity,
    Category,
)

@pytest.mark.asyncio
async def test_detect_dangling_window_event_listener():
    """Bileşen unmount olduğunda temizlenmeyen yetim window dinleyicilerinin tespitini test eder."""
    engine = MemoryLeakProfilerEngine()
    html = """
    <html>
    <head><title>SPA Dashboard</title></head>
    <body>
        <div id="root"></div>
        <script>
            // React bileşeni içinde temizlenmemiş resize ve scroll dinleyicileri
            window.addEventListener('resize', function() { console.log('resized'); });
            window.addEventListener('scroll', function() { console.log('scrolled'); });
            document.addEventListener('keydown', function(e) { console.log('key'); });
        </script>
    </body>
    </html>
    """

    report, findings = await engine.audit_memory_leaks("https://test.local", html_content=html)

    assert report.dangling_listeners_count >= 2
    assert any(l.leak_type == MemoryLeakType.DANGLING_EVENT_LISTENER for l in report.leaks)
    assert any(dl.event_type == "resize" for dl in report.dangling_listeners)
    assert any(dl.event_type == "scroll" for dl in report.dangling_listeners)
    assert len(findings) > 0
    assert report.memory_health_score < 100
    assert any("removeEventListener" in (l.code_fix_template or "") for l in report.leaks)


@pytest.mark.asyncio
async def test_detect_uncleaned_timer_and_observer():
    """Temizlenmemiş setInterval ve kapatılmamış ResizeObserver nesnelerinin tespitini test eder."""
    engine = MemoryLeakProfilerEngine()
    html = """
    <html>
    <body>
        <script>
            // Temizlenmemiş setInterval
            setInterval(() => { fetch('/api/heartbeat'); }, 3000);
            
            // Kapatılmamış ResizeObserver
            const ro = new ResizeObserver((entries) => { console.log(entries); });
            ro.observe(document.body);
            // ro.disconnect() hiç çağrılmıyor!
        </script>
    </body>
    </html>
    """

    report, findings = await engine.audit_memory_leaks("https://test.local", html_content=html)

    assert report.uncleaned_timers_count >= 1
    assert any(l.leak_type == MemoryLeakType.UNRELEASED_TIMER_INTERVAL for l in report.leaks)
    assert any(l.leak_type == MemoryLeakType.UNCLEANED_OBSERVER for l in report.leaks)
    assert report.memory_health_score <= 85


@pytest.mark.asyncio
async def test_detect_detached_dom_clusters():
    """Modallar, portallar ve canvas elementleri üzerinden kopuk DOM düğümü riskini test eder."""
    engine = MemoryLeakProfilerEngine()
    html = """
    <html>
    <body>
        <div class="modal-backdrop fade show">
            <div class="modal-dialog">
                <div class="modal-content">
                    <p>Modal İçeriği</p>
                </div>
            </div>
        </div>
        <div class="portal-root drawer-overlay">
            <aside class="drawer-sidebar"></aside>
        </div>
        <canvas id="chart-canvas" width="800" height="400"></canvas>
    </body>
    </html>
    """

    report, findings = await engine.audit_memory_leaks("https://test.local", html_content=html)

    assert report.detached_dom_nodes_count > 0
    assert len(report.detached_clusters) >= 2
    assert any(c.tag_name == "canvas" for c in report.detached_clusters)
    assert any("modal" in (c.class_or_id or "").lower() for c in report.detached_clusters)
    assert any(l.leak_type == MemoryLeakType.DETACHED_DOM_NODES for l in report.leaks)


@pytest.mark.asyncio
async def test_js_heap_bloat_and_scoring():
    """Yüksek JS heap büyümesi ve bellek şişmesi simülasyonunu test eder."""
    engine = MemoryLeakProfilerEngine()
    html = "<html><body><script>window.addEventListener('resize', () => {});</script></body></html>"

    custom_browser_memory = {
        "used_js_heap_size_mb": 98.4,
        "total_js_heap_size_mb": 115.0,
        "js_heap_size_limit_mb": 2190.0,
        "heap_growth_delta_mb": 18.6,
    }

    report, findings = await engine.audit_memory_leaks(
        "https://test.local",
        html_content=html,
        browser_memory_info=custom_browser_memory,
    )

    assert report.heap_metrics.growth_rate_status == "CRITICAL_GROWTH"
    assert report.heap_metrics.used_js_heap_size_mb == 98.4
    assert any(l.leak_type == MemoryLeakType.UNBOUNDED_HEAP_GROWTH for l in report.leaks)
    assert report.memory_health_score < 75


@pytest.mark.asyncio
async def test_clean_spa_page_perfect_score():
    """Tüm dinleyicilerin ve zamanlayıcıların doğru temizlendiği optimize bir sayfanın 100 puan almasını test eder."""
    engine = MemoryLeakProfilerEngine()
    html = """
    <html>
    <body>
        <main><h1>Temiz ve Optimize SPA Sayfası</h1></main>
        <script>
            // Eşleşen addEventListener ve removeEventListener
            function onResize() { console.log('resizing'); }
            window.addEventListener('resize', onResize);
            window.removeEventListener('resize', onResize);

            // Temizlenen interval
            const timer = setInterval(() => {}, 1000);
            clearInterval(timer);

            // Kapatılan observer
            const obs = new ResizeObserver(() => {});
            obs.disconnect();
        </script>
    </body>
    </html>
    """

    report, findings = await engine.audit_memory_leaks("https://test.local", html_content=html)

    assert report.dangling_listeners_count == 0
    assert report.uncleaned_timers_count == 0
    assert report.total_leaks_count == 0
    assert report.memory_health_score == 100
    assert len(findings) == 0
    assert report.heap_metrics.growth_rate_status == "HEALTHY"

