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

        # Extract links and critical assets with their source HTML tag
        links_map: dict[str, any] = {}
        assets_map: dict[str, any] = {}

        for a_tag in soup.find_all("a", href=True):
            cleaned = self._clean_url(target_url, a_tag["href"])
            if cleaned and cleaned not in links_map:
                links_map[cleaned] = a_tag

        for img_tag in soup.find_all("img", src=True):
            cleaned = self._clean_url(target_url, img_tag["src"])
            if cleaned and cleaned not in assets_map:
                assets_map[cleaned] = img_tag

        for script_tag in soup.find_all("script", src=True):
            cleaned = self._clean_url(target_url, script_tag["src"])
            if cleaned and cleaned not in assets_map:
                assets_map[cleaned] = script_tag

        for link_tag in soup.find_all("link", rel=lambda r: r and "stylesheet" in r, href=True):
            cleaned = self._clean_url(target_url, link_tag["href"])
            if cleaned and cleaned not in assets_map:
                assets_map[cleaned] = link_tag

        # Cap checks for latency optimization
        probe_assets = list(assets_map.keys())[:MAX_PROBE_URLS]
        probe_links = list(links_map.keys())[:MAX_PROBE_URLS]

        asset_tasks = [self._probe_url(url, client) for url in probe_assets]
        link_tasks = [self._probe_url(url, client) for url in probe_links]

        asset_results = await asyncio.gather(*asset_tasks, return_exceptions=True)
        link_results = await asyncio.gather(*link_tasks, return_exceptions=True)

        broken_assets = [res for res in asset_results if isinstance(res, tuple) and res[1] >= 400]
        broken_links = [res for res in link_results if isinstance(res, tuple) and res[1] >= 400]

        if broken_assets:
            first_url, first_status = broken_assets[0]
            first_tag = assets_map.get(first_url)
            asset_line = getattr(first_tag, "sourceline", None) if first_tag else None
            findings.append(
                Finding(
                    id="UX_BROKEN_ASSETS",
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title=f"{len(broken_assets)} Broken Critical Asset(s) Detected",
                    description="Essential assets (images, stylesheets, or scripts) failed to load, degrading page appearance and functionality.",
                    remediation="Verify resource paths, ensure CDN availability, and remove obsolete asset references.",
                    evidence={"broken_assets": [{"url": u, "status": s} for u, s in broken_assets[:5]]},
                    risk_impact="When CSS stylesheets, JS bundles, or key images fail to load, page layout breaks, client-side interactivity fails, and users quickly abandon the site.",
                    code_example="<link rel=\"stylesheet\" href=\"/css/main.min.css\" />\n<script src=\"/js/app.bundle.js\" defer></script>",
                    target_location="index.html",
                    line_number=asset_line,
                    problematic_code=str(first_tag)[:160] if first_tag else f"Failed Resource: {first_url} (HTTP {first_status})"
                )
            )

        if broken_links:
            first_url, first_status = broken_links[0]
            first_tag = links_map.get(first_url)
            link_line = getattr(first_tag, "sourceline", None) if first_tag else None
            findings.append(
                Finding(
                    id="UX_BROKEN_LINKS",
                    category=Category.UX,
                    severity=Severity.MEDIUM,
                    title=f"{len(broken_links)} Broken Internal/External Link(s) Detected",
                    description="Hyperlinks directing to 4xx/5xx dead ends degrade user experience and harm SEO.",
                    remediation="Update or remove dead URLs and configure proper 301 redirects.",
                    evidence={"broken_links": [{"url": u, "status": s} for u, s in broken_links[:5]]},
                    risk_impact="Visitors encountering 404/500 dead ends lose trust, conversion rates drop, and search engine crawlers waste crawl budget, degrading search rankings.",
                    code_example="<a href=\"/contact-us\">Contact Us</a>",
                    target_location="index.html",
                    line_number=link_line,
                    problematic_code=str(first_tag)[:160] if first_tag else f"Broken Link: {first_url} (HTTP {first_status})"
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
