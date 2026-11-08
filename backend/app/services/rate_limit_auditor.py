"""
WebGuard Hız Sınırı ve Kaba Kuvvet Direnç Testi Motoru (Rate-Limiting & Brute-Force Auditor)
============================================================================================
OWASP API4:2023, BDDK Madde 34 ve PCI-DSS 8.3.4 kurumsal standartlarında:
- Kimlik doğrulama, form ve API uç noktalarına kontrollü, sentetik ve zararsız kısa süreli istek patlamaları (burst requests) gönderir.
- Sunucunun HTTP 429 Too Many Requests, Retry-After ve X-RateLimit başlıklarını uygulayıp uygulamadığını ölçer.
- Kaba kuvvet (brute-force) ve DDoS saldırılarına karşı hız sınırlama direnç skorunu hesaplar.
"""

import asyncio
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
import httpx

from app.models.schema import (
    Category,
    Finding,
    RCACategory,
    RateLimitProbeAttempt,
    RateLimitResilienceReport,
    RateLimitStatus,
    Severity,
)

AUTH_CANDIDATE_PATHS = [
    "/api/auth/login",
    "/api/v1/auth/login",
    "/api/login",
    "/login",
    "/signin",
    "/user/login",
    "/auth/login",
]


class RateLimitingAuditor:
    """
    Hız Sınırı (Rate-Limiting) ve Kaba Kuvvet (Brute-Force) Savunma Denetçisi.
    """

    def __init__(self, burst_count: int = 15, timeout_seconds: float = 5.0):
        self.burst_count = burst_count
        self.timeout_seconds = timeout_seconds

    async def audit_rate_limiting(
        self,
        target_url: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[RateLimitResilienceReport, List[Finding]]:
        """
        Hedef URL veya ilişkili kimlik doğrulama uç noktasına kontrollü burst istekleri göndererek
        hız sınırını (Rate-Limiting) denetler.
        """
        findings: List[Finding] = []
        attempts: List[RateLimitProbeAttempt] = []

        headers = {
            "User-Agent": "WebGuard-RateLimit-Auditor/2.0 (Virgosol-Enterprise-Compliance)",
            "Content-Type": "application/json",
            "Accept": "application/json, text/html, */*",
        }

        session = client or httpx.AsyncClient(headers=headers, follow_redirects=True, verify=False)
        should_close_session = client is None

        # 1. Test Edilecek En Uygun Uç Noktayı Belirle
        test_endpoint = await self._discover_candidate_endpoint(target_url, session)

        detected_status = RateLimitStatus.NOT_ENFORCED
        throttled_at_attempt: Optional[int] = None
        http_429_received = False
        retry_after_present = False
        collected_rate_headers: Dict[str, str] = {}

        dummy_payload = {
            "email": "canary_probe@webguard.local",
            "username": "canary_rate_test",
            "password": "CanaryDummyPassword123!",
        }

        try:
            # 2. Kontrollü İstek Patlaması (Burst Probing)
            for i in range(1, self.burst_count + 1):
                t0 = time.perf_counter()
                status_code = 0
                resp_headers: Dict[str, str] = {}
                is_throttled = False
                retry_after_val: Optional[int] = None
                remaining_val: Optional[int] = None

                try:
                    # POST ile kimlik doğrulama probu, başarısızsa GET ile deneme
                    resp = await session.post(test_endpoint, json=dummy_payload, timeout=self.timeout_seconds)
                    if resp.status_code in (404, 405):
                        resp = await session.get(test_endpoint, timeout=self.timeout_seconds)

                    status_code = resp.status_code
                    resp_headers = {k.lower(): v for k, v in resp.headers.items()}

                    # Standart RateLimit Başlıklarını Tara
                    for h_name, h_val in resp_headers.items():
                        if "ratelimit" in h_name or h_name == "retry-after":
                            collected_rate_headers[h_name] = h_val

                    # Retry-After Çözümlemesi
                    if "retry-after" in resp_headers:
                        retry_after_present = True
                        try:
                            retry_after_val = int(resp_headers["retry-after"])
                        except ValueError:
                            retry_after_val = 60

                    # Kalan İstek Sayısı
                    for rem_key in ("ratelimit-remaining", "x-ratelimit-remaining"):
                        if rem_key in resp_headers:
                            try:
                                remaining_val = int(resp_headers[rem_key])
                            except ValueError:
                                pass

                    # Throttling Tespiti (HTTP 429 veya 403 Rate Limit Mesajı)
                    if status_code == 429:
                        http_429_received = True
                        is_throttled = True
                    elif status_code == 403 and any(k in resp.text.lower() for k in ("rate limit", "too many", "blocked")):
                        is_throttled = True

                except httpx.TimeoutException:
                    status_code = 504
                except Exception:
                    status_code = 500

                lat_ms = round((time.perf_counter() - t0) * 1000.0, 1)

                attempts.append(
                    RateLimitProbeAttempt(
                        attempt_number=i,
                        status_code=status_code,
                        latency_ms=lat_ms,
                        rate_limit_remaining=remaining_val,
                        retry_after_seconds=retry_after_val,
                        throttled=is_throttled,
                    )
                )

                if is_throttled and throttled_at_attempt is None:
                    throttled_at_attempt = i
                    break  # Hız sınırı devreye girdiğinde fazladan yük bindirmemek için dur

                # İstekler arasında minik 40ms aralık
                await asyncio.sleep(0.04)

        finally:
            if should_close_session:
                await session.aclose()

        # 3. Sonuçların ve Güvenlik Durumunun Sınıflandırılması
        if http_429_received:
            detected_status = RateLimitStatus.ENFORCED_HTTP_429
            score = 100 if retry_after_present else 90
        elif throttled_at_attempt is not None:
            detected_status = RateLimitStatus.ENFORCED_ACCOUNT_LOCK
            score = 85
        else:
            # Gecikme artışı var mı kontrol et (Tarpit)
            if len(attempts) >= 10 and attempts[-1].latency_ms > (attempts[0].latency_ms * 3) and attempts[-1].latency_ms > 1500:
                detected_status = RateLimitStatus.PARTIAL_DELAY
                score = 70
            else:
                detected_status = RateLimitStatus.NOT_ENFORCED
                score = 30

        # 4. Güvenlik ve Uyum Bulgularının Üretilmesi (Findings Formulation)
        if detected_status == RateLimitStatus.NOT_ENFORCED:
            findings.append(
                Finding(
                    id="SEC_RATE_LIMIT_ABSENT",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="Kimlik Doğrulama / API Uç Noktasında Hız Sınırı (Rate Limiting) Eksik",
                    description=(
                        f"'{test_endpoint}' uç noktasına art arda gönderilen {len(attempts)} adet istek hiçbir hız sınırlaması, "
                        f"gecikme veya HTTP 429 engeliyle karşılaşmadan doğrudan kabul edildi. Sistem kaba kuvvet (brute-force) "
                        f"ve kimlik bilgisi doldurma (credential stuffing) saldırılarına karşı korumasızdır."
                    ),
                    remediation=(
                        "Uç noktalara IP ve kullanıcı bazlı hız sınırı (Rate Limiting) uygulayın (örneğin dakikada maks 5-10 deneme). "
                        "Hız aşıldığında standart 'HTTP 429 Too Many Requests' durum kodu ve 'Retry-After' başlığı döndürün. "
                        "Nginx limit_req_zone, Redis token-bucket veya Cloudflare Rate Limiting kurallarını aktif edin."
                    ),
                    risk_impact=(
                        "Saldırganlar otomatik botlarla binlerce parola denemesi yapabilir, kullanıcı hesaplarını ele geçirebilir "
                        "ve sunucu kaynaklarını tüketerek Hizmet Engelleme (DoS) oluşturabilir. BDDK ve OWASP API4 uyumsuzluğudur."
                    ),
                    compliance_standard="BDDK Madde 34, OWASP API4:2023, PCI-DSS 8.3.4",
                    evidence={
                        "tested_endpoint": test_endpoint,
                        "burst_requests_sent": len(attempts),
                        "throttled": False,
                        "http_status_codes": [a.status_code for a in attempts],
                    },
                    rca_category=RCACategory.REAL_BUG,
                    team_assignment="Yazılım Geliştirici (Backend / Auth & SecOps)",
                    root_cause_hypothesis="Kimlik doğrulama rotalarında hız sınırlayıcı middleware veya Redis sliding-window mekanizması yapılandırılmamış.",
                    code_example=(
                        "# FastAPI & SlowAPI ile Hız Sınırı Örneği\n"
                        "from slowapi import Limiter\n"
                        "from slowapi.util import get_remote_address\n\n"
                        "limiter = Limiter(key_func=get_remote_address)\n\n"
                        "@app.post('/api/auth/login')\n"
                        "@limiter.limit('5/minute')\n"
                        "async def login(request: Request):\n"
                        "    return {'status': 'authenticated'}\n"
                    ),
                )
            )
        elif detected_status == RateLimitStatus.ENFORCED_HTTP_429 and not retry_after_present:
            findings.append(
                Finding(
                    id="SEC_RATE_LIMIT_MISSING_RETRY_AFTER",
                    category=Category.UX,
                    severity=Severity.LOW,
                    title="HTTP 429 Yanıtında Standart 'Retry-After' Başlığı Eksik",
                    description=(
                        "Sunucu hız sınırını başarıyla uygulayarak HTTP 429 döndürdü ancak istemcinin ne zaman "
                        "tekrar deneme yapabileceğini belirten standart 'Retry-After' başlığını içermiyor."
                    ),
                    remediation="HTTP 429 yanıtlarına saniye cinsinden bekleme süresini belirten 'Retry-After: 60' başlığı ekleyin.",
                    risk_impact="Kullanıcı arayüzleri kullanıcının ne kadar beklemesi gerektiğini bilemez ve erken istek göndermeye devam edebilir.",
                    compliance_standard="RFC 6585, OWASP API4:2023",
                    evidence={"rate_limit_headers": collected_rate_headers},
                    rca_category=RCACategory.ENV_ISSUE,
                    team_assignment="Yazılım Geliştirici (API / Backend)",
                )
            )

        report = RateLimitResilienceReport(
            rate_limiting_detected=(detected_status != RateLimitStatus.NOT_ENFORCED),
            status=detected_status,
            resilience_score=score,
            tested_endpoint=test_endpoint,
            total_burst_requests=len(attempts),
            throttled_at_attempt=throttled_at_attempt,
            http_429_received=http_429_received,
            retry_after_header_present=retry_after_present,
            rate_limit_headers=collected_rate_headers,
            attempts=attempts,
        )

        return report, findings

    async def _discover_candidate_endpoint(self, base_url: str, session: httpx.AsyncClient) -> str:
        """Hedef sitede kimlik doğrulama veya form rotası arar, yoksa ana URL'yi döner."""
        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        for path in AUTH_CANDIDATE_PATHS:
            candidate = urljoin(origin, path)
            try:
                resp = await session.get(candidate, timeout=3.0)
                if resp.status_code in (200, 401, 403, 405):
                    return candidate
            except Exception:
                continue

        return base_url

