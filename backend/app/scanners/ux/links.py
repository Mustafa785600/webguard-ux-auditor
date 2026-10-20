import asyncio
from typing import List, Set, Tuple
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import httpx
from app.models.schema import Finding, Category, Severity
from app.scanners.base import BaseScanner

MAX_PROBE_URLS = 25

class BrokenLinksScanner(BaseScanner):
    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []
        try:
            response = await client.get(target_url, timeout=10.0)
            if response.status_code >= 400:
                return findings
        except Exception:
            return findings

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract links and critical assets
        links_to_check: Set[str] = set()
        assets_to_check: Set[str] = set()

        for a_tag in soup.find_all("a", href=True):
            cleaned = self._clean_url(target_url, a_tag["href"])
            if cleaned:
                links_to_check.add(cleaned)

        for img_tag in soup.find_all("img", src=True):
            cleaned = self._clean_url(target_url, img_tag["src"])
            if cleaned:
                assets_to_check.add(cleaned)

        for script_tag in soup.find_all("script", src=True):
            cleaned = self._clean_url(target_url, script_tag["src"])
            if cleaned:
                assets_to_check.add(cleaned)

        for link_tag in soup.find_all("link", rel=lambda r: r and "stylesheet" in r, href=True):
            cleaned = self._clean_url(target_url, link_tag["href"])
            if cleaned:
                assets_to_check.add(cleaned)

        # Cap checks for latency optimization
        probe_assets = list(assets_to_check)[:MAX_PROBE_URLS]
        probe_links = list(links_to_check)[:MAX_PROBE_URLS]

        asset_tasks = [self._probe_url(url, client) for url in probe_assets]
        link_tasks = [self._probe_url(url, client) for url in probe_links]

        asset_results = await asyncio.gather(*asset_tasks, return_exceptions=True)
        link_results = await asyncio.gather(*link_tasks, return_exceptions=True)

        broken_assets = [res for res in asset_results if isinstance(res, tuple) and res[1] >= 400]
        broken_links = [res for res in link_results if isinstance(res, tuple) and res[1] >= 400]

        if broken_assets:
            first_asset = broken_assets[0]
            findings.append(
                Finding(
                    id="UX_BROKEN_ASSETS",
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title=f"{len(broken_assets)} Broken Critical Asset(s) Detected",
                    description="Essential assets (images, stylesheets, or scripts) failed to load, degrading page appearance and functionality.",
                    remediation="Verify resource paths, ensure CDN availability, and remove obsolete asset references.",
                    evidence={"broken_assets": [{"url": u, "status": s} for u, s in broken_assets[:5]]},
                    risk_impact="Stil dosyaları (CSS), JS kütüphaneleri veya kritik resimler yüklenemediğinde sayfa tasarımı parçalanır, butonlar çalışmaz ve kullanıcılar siteyi bozuk sanıp terk eder.",
                    code_example="<!-- Bozuk dosya yolunu güncelleyin veya doğru CDN URL'si verin -->\n<link rel=\"stylesheet\" href=\"/css/main.min.css\" />\n<script src=\"/js/app.bundle.js\" defer></script>",
                    target_location="HTML (<head> veya <body> varlık linkleri)",
                    problematic_code=f"Yüklenemeyen Dosya: {first_asset[0]} (HTTP {first_asset[1]})"
                )
            )

        if broken_links:
            first_link = broken_links[0]
            findings.append(
                Finding(
                    id="UX_BROKEN_LINKS",
                    category=Category.UX,
                    severity=Severity.MEDIUM,
                    title=f"{len(broken_links)} Broken Internal/External Link(s) Detected",
                    description="Hyperlinks directing to 4xx/5xx dead ends degrade user experience and harm SEO.",
                    remediation="Update or remove dead URLs and configure proper 301 redirects.",
                    evidence={"broken_links": [{"url": u, "status": s} for u, s in broken_links[:5]]},
                    risk_impact="Kullanıcılar tıkladıklarında 404/500 hata sayfalarıyla karşılaşır. Bu durum kullanıcı güvenini zedeler ve Google botlarının tarama bütçesini tüketerek arama sıralamalarına (SEO) darbe vurur.",
                    code_example="<!-- Linki güncelleyin veya sunucuda 301 yönlendirmesi tanımlayın -->\n<a href=\"/guncel-sayfa\">Aktif Sayfaya Git</a>",
                    target_location="Sayfa Şablonu (HTML / <a>)",
                    problematic_code=f"Kırık Bağlantı (Ölü Link): {first_link[0]} (HTTP {first_link[1]})"
                )
            )

        return findings

    def _clean_url(self, base_url: str, raw_url: str) -> str | None:
        trimmed = raw_url.strip()
        if not trimmed or trimmed.startswith(("javascript:", "mailto:", "tel:", "#", "data:")):
            return None
        absolute = urljoin(base_url, trimmed)
        parsed = urlparse(absolute)
        return absolute if parsed.scheme in ("http", "https") else None

    async def _probe_url(self, url: str, client: httpx.AsyncClient) -> Tuple[str, int]:
        try:
            head_resp = await client.head(url, timeout=5.0)
            if head_resp.status_code in (405, 501):
                get_resp = await client.get(url, timeout=5.0)
                return (url, get_resp.status_code)
            return (url, head_resp.status_code)
        except httpx.HTTPStatusError as exc:
            return (url, exc.response.status_code)
        except Exception:
            return (url, 599)
