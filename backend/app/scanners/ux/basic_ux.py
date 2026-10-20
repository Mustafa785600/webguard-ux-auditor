from typing import List
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import httpx
from app.models.schema import Finding, Category, Severity
from app.scanners.base import BaseScanner

class BasicUXScanner(BaseScanner):
    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []
        try:
            response = await client.get(target_url)
        except Exception:
            return findings

        soup = BeautifulSoup(response.text, "html.parser")

        head_tag = soup.find("head")
        viewport = soup.find("meta", attrs={"name": lambda x: x and x.lower() == "viewport"})
        if not viewport or not viewport.get("content"):
            findings.append(
                Finding(
                    id="UX_MISSING_VIEWPORT",
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title="Missing Mobile Viewport Meta Tag",
                    description="The page lacks a responsive viewport meta tag, causing degraded layout and readability on mobile devices.",
                    remediation="Add '<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">' inside <head>.",
                    risk_impact="On mobile devices, pages without a viewport meta tag render in desktop scaling mode, forcing users to pinch-zoom and horizontally scroll, drastically degrading mobile usability.",
                    code_example="<head>\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n</head>",
                    target_location="Page Template (HTML <head>)",
                    line_number=getattr(head_tag, "sourceline", None),
                    problematic_code="<head>\n</head>"
                )
            )

        title_tag = soup.find("title")
        if not title_tag or not title_tag.text.strip():
            findings.append(
                Finding(
                    id="UX_MISSING_TITLE",
                    category=Category.UX,
                    severity=Severity.MEDIUM,
                    title="Missing or Empty Page Title",
                    description="The document lacks a descriptive <title> element, hampering navigation, tab management, and search UX.",
                    remediation="Provide a concise, context-rich <title> tag for every page.",
                    risk_impact="Users cannot identify tabs in browsers or bookmarks, and search engines fail to display relevant title snippets, causing severe SEO ranking loss.",
                    code_example="<head>\n  <title>Home - My Company</title>\n</head>",
                    target_location="Page Template (HTML <head>)",
                    line_number=getattr(head_tag, "sourceline", None),
                    problematic_code=str(title_tag) if title_tag else "<title></title>"
                )
            )

        all_imgs_without_alt = [img for img in soup.find_all("img") if not img.get("alt")]
        if all_imgs_without_alt:
            first_img = all_imgs_without_alt[0]
            findings.append(
                Finding(
                    id="UX_MISSING_IMG_ALT",
                    category=Category.UX,
                    severity=Severity.MEDIUM,
                    title=f"Missing Alt Attributes on {len(all_imgs_without_alt)} Image(s)",
                    description="Images without alt attributes prevent screen reader accessibility and degrade UX when images fail to load.",
                    remediation="Add descriptive 'alt' text to all informational images or 'alt=\"\"' for decorative elements.",
                    evidence={"count": len(all_imgs_without_alt), "samples": [img.get("src", "unknown") for img in all_imgs_without_alt[:5]]},
                    risk_impact="Screen reader users cannot understand image content or context. When images fail to load due to network issues, no fallback text is rendered, and image SEO indexing is lost.",
                    code_example="<img src=\"/images/logo.png\" alt=\"Company Logo\" />",
                    target_location="Page Template (HTML / <img>)",
                    line_number=getattr(first_img, "sourceline", None),
                    problematic_code=str(first_img)[:160]
                )
            )

        return findings
