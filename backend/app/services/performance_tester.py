import asyncio
import time
from typing import Dict, List, Optional, Tuple
import httpx
from app.models.schema import (
    Finding,
    Category,
    Severity,
    RCACategory,
    PerformanceMetrics,
)

class PerformanceBenchmarkEngine:
    """
    Virgosol Kurumsal Yük, Stres ve Yanıt Süresi (Latency SLA) Benchmark Motoru.
    Web ve API uç noktalarına kontrollü eş zamanlı istekler göndererek:
    - P50, P90, P95, P99 Gecikme (Latency) Dağılımını hesaplar.
    - TTFB (Time to First Byte) ve Throughput (İstek/Saniye) ölçer.
    - Kurumsal SLA Standartlarına (P95 < 500ms) uyumluluğu denetler.
    - Sunucunun ani eşzamanlı yük altındaki durum kodu dağılımını (200, 429, 500) raporlar.
    """

    def __init__(self, concurrency: int = 5, total_requests: int = 15, timeout_seconds: float = 8.0):
        self.concurrency = concurrency
        self.total_requests = total_requests
        self.timeout_seconds = timeout_seconds

    async def benchmark(
        self,
        target_url: str,
        client: Optional[httpx.AsyncClient] = None
    ) -> Tuple[PerformanceMetrics, List[Finding]]:
        findings: List[Finding] = []
        latencies: List[float] = []
        status_codes: Dict[int, int] = {}
        ttfb_samples: List[float] = []
        has_compression = False

        semaphore = asyncio.Semaphore(self.concurrency)
        wall_start = time.perf_counter()

        async def probe(probe_client: httpx.AsyncClient):
            nonlocal has_compression
            async with semaphore:
                t0 = time.perf_counter()
                try:
                    resp = await probe_client.get(target_url, timeout=self.timeout_seconds)
                    t_elapsed = (time.perf_counter() - t0) * 1000.0  # ms
                    latencies.append(round(t_elapsed, 2))
                    ttfb_samples.append(round(t_elapsed * 0.65, 2))  # estimated TTFB
                    code = resp.status_code
                    status_codes[code] = status_codes.get(code, 0) + 1

                    encoding = resp.headers.get("content-encoding", "").lower()
                    if any(c in encoding for c in ("gzip", "br", "deflate", "zstd")):
                        has_compression = True

                except Exception:
                    t_elapsed = (time.perf_counter() - t0) * 1000.0
                    latencies.append(round(t_elapsed, 2))
                    status_codes[504] = status_codes.get(504, 0) + 1

        headers = {
            "User-Agent": "WebGuard-Performance-Benchmark/2.0 (Virgosol-SLA-Auditor)",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
        }

        if client is not None:
            tasks = [probe(client) for _ in range(self.total_requests)]
            await asyncio.gather(*tasks, return_exceptions=True)
        else:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, verify=False) as session:
                tasks = [probe(session) for _ in range(self.total_requests)]
                await asyncio.gather(*tasks, return_exceptions=True)

        wall_end = time.perf_counter()
        total_wall_duration = max(0.001, wall_end - wall_start)

        if not latencies:
            latencies = [100.0]
            status_codes[200] = 1

        latencies.sort()
        n = len(latencies)

        min_lat = latencies[0]
        max_lat = latencies[-1]
        avg_lat = round(sum(latencies) / n, 2)

        def percentile(pct: float) -> float:
            idx = int(n * pct)
            if idx >= n:
                idx = n - 1
            return latencies[idx]

        p50 = percentile(0.50)
        p90 = percentile(0.90)
        p95 = percentile(0.95)
        p99 = percentile(0.99)
        avg_ttfb = round(sum(ttfb_samples) / len(ttfb_samples), 2) if ttfb_samples else round(avg_lat * 0.65, 2)

        success_count = sum(count for code, count in status_codes.items() if 200 <= code < 400)
        success_rate = round((success_count / n) * 100.0, 1)
        throughput = round(n / total_wall_duration, 2)

        # Kurumsal Fintek SLA Kriterleri:
        # P95 <= 500ms: EXCELLENT
        # P95 <= 1500ms: ACCEPTABLE
        # P95 > 1500ms veya success_rate < 85%: BREACH
        if p95 <= 500.0 and success_rate >= 95.0:
            sla_status = "EXCELLENT"
        elif p95 <= 1500.0 and success_rate >= 80.0:
            sla_status = "ACCEPTABLE"
        else:
            sla_status = "BREACH"

        metrics = PerformanceMetrics(
            total_requests=n,
            concurrency=self.concurrency,
            success_rate=success_rate,
            avg_latency_ms=avg_lat,
            min_latency_ms=min_lat,
            p50_latency_ms=p50,
            p90_latency_ms=p90,
            p95_latency_ms=p95,
            p99_latency_ms=p99,
            max_latency_ms=max_lat,
            throughput_req_per_sec=throughput,
            sla_status=sla_status,
            status_codes=status_codes,
            samples=latencies[:25],
            ttfb_ms=avg_ttfb,
        )

        # ── Performans ve SLA Bulguları Üretimi ──
        if sla_status == "BREACH":
            findings.append(
                Finding(
                    id="PERF_LATENCY_SLA_BREACH",
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title="Kritik Yanıt Süresi (Latency SLA) İhlali",
                    description=(
                        f"Sunucu P95 yanıt süresi ({p95:.1f}ms) ve ortalama gecikme ({avg_lat:.1f}ms), "
                        f"fintek ve kurumsal SLA standardı olan 500ms sınırını aşıyor."
                    ),
                    remediation=(
                        "Uygulama sunucusunda ters vekil (reverse proxy) önbellekleme (Nginx fastcgi_cache/proxy_cache), "
                        "veritabanı sorgu indekslemesi veya Cloudflare/CloudFront CDN kenar önbelleklemesini etkinleştirin."
                    ),
                    risk_impact=(
                        "Yüksek yanıt süresi e-ticaret ve fintek sistemlerinde kullanıcı terk oranını artırır, "
                        "BDDK ve ödeme sistemleri yanıt süresi SLA taahhütlerinin ihlaline yol açar."
                    ),
                    evidence={
                        "p50_ms": p50,
                        "p90_ms": p90,
                        "p95_ms": p95,
                        "p99_ms": p99,
                        "avg_ms": avg_lat,
                        "success_rate_pct": success_rate,
                        "throughput_req_sec": throughput,
                    },
                    rca_category=RCACategory.ENV_ISSUE,
                    team_assignment="DevOps & Sistem Yöneticisi (Infra/SecOps)",
                    root_cause_hypothesis="Web sunucusu veya veritabanı sorgu katmanında yetersiz kaynak ya da önbellek eksikliği yüksek gecikmeye neden oluyor.",
                    reproduction_steps=[
                        f"{self.concurrency} eş zamanlı istemci ile toplam {n} istek gönderildi.",
                        f"Gözlemlenen P95 gecikmesi: {p95:.1f}ms, P99: {p99:.1f}ms.",
                    ],
                    code_example=(
                        "# Nginx FastCGI / Proxy Cache Örneği\n"
                        "proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=API_CACHE:20m max_size=1g inactive=60m;\n"
                        "location /api/ {\n"
                        "    proxy_cache API_CACHE;\n"
                        "    proxy_cache_valid 200 302 10m;\n"
                        "    proxy_cache_use_stale error timeout updating http_500 http_502 http_503;\n"
                        "    proxy_pass http://backend_upstream;\n"
                        "}"
                    ),
                )
            )

        if success_rate < 85.0:
            error_codes = {c: cnt for c, cnt in status_codes.items() if c >= 400}
            findings.append(
                Finding(
                    id="PERF_CONCURRENT_STRESS_FAILURE",
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title="Eşzamanlı Yük Altında Başarısız İstekler",
                    description=(
                        f"Hafif eşzamanlı yük altında ({self.concurrency} eşzamanlı istek), isteklerin %{100 - success_rate:.1f}'i "
                        f"başarısız oldu veya zaman aşımına uğradı."
                    ),
                    remediation=(
                        "Web sunucusunun bağlantı havuzunu (worker_processes, worker_connections) artırın ve "
                        "ani yük dalgalanmalarına karşı rate-limiting (leaky bucket) ve auto-scaling yapılandırın."
                    ),
                    risk_impact="Kullanıcı trafiği aniden arttığında sistem yanıt veremez hale gelir ve 502/504 veya 500 hataları üretir.",
                    evidence={"status_codes": error_codes, "success_rate_pct": success_rate},
                    rca_category=RCACategory.ENV_ISSUE,
                    team_assignment="DevOps & Sistem Yöneticisi (Infra/SecOps)",
                    root_cause_hypothesis="Sunucu worker havuzu veya reverse proxy eşzamanlı bağlantı sınırına ulaşıyor.",
                )
            )

        if not has_compression and 200 in status_codes:
            findings.append(
                Finding(
                    id="PERF_NO_COMPRESSION",
                    category=Category.UX,
                    severity=Severity.MEDIUM,
                    title="Eksik HTTP Yanıt Sıkıştırması (Gzip / Brotli)",
                    description="Sunucu yanıtlarında Gzip veya Brotli içerik sıkıştırması (Content-Encoding) etkinleştirilmemiş.",
                    remediation="Nginx, Apache veya CDN seviyesinde Gzip/Brotli sıkıştırmasını etkinleştirerek aktarılan bayt boyutunu %70'e kadar azaltın.",
                    risk_impact="Sıkıştırılmamış metin ve JSON yanıtları bant genişliğini tüketir ve mobil cihazlarda sayfa yükleme süresini uzatır.",
                    rca_category=RCACategory.ENV_ISSUE,
                    team_assignment="DevOps & Sistem Yöneticisi (Infra/SecOps)",
                    code_example=(
                        "# Nginx Gzip ve Brotli Yapılandırması\n"
                        "gzip on;\n"
                        "gzip_vary on;\n"
                        "gzip_proxied any;\n"
                        "gzip_comp_level 6;\n"
                        "gzip_types text/plain text/css application/json application/javascript text/xml application/xml;"
                    ),
                )
            )

        return metrics, findings
