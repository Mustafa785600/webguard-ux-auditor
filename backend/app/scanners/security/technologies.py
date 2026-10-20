import re
from typing import List, Tuple
from bs4 import BeautifulSoup
import httpx
from app.models.schema import Finding, Category, Severity
from app.scanners.base import BaseScanner

KNOWN_TECH_RULES = [
    {
        "name": "jQuery",
        "pattern": r"jquery[.-]([0-9]+\.[0-9]+(?:\.[0-9]+)?)(?:\.min)?\.js",
        "vulnerable_check": lambda ver: tuple(map(int, ver.split(".")[:2])) < (3, 5),
        "vuln_severity": Severity.HIGH,
        "vuln_title": "Vulnerable jQuery Version Detected (< 3.5.0)",
        "vuln_desc": "Target uses jQuery {version}, which contains known Cross-Site Scripting (XSS) vulnerabilities (CVE-2020-11022, CVE-2020-11023).",
        "remediation": "Upgrade jQuery to version 3.5.0 or higher."
    },
    {
        "name": "Bootstrap",
        "pattern": r"bootstrap[.-]([0-9]+\.[0-9]+(?:\.[0-9]+)?)(?:\.min)?\.(?:js|css)",
        "vulnerable_check": lambda ver: tuple(map(int, ver.split(".")[:2])) < (4, 5),
        "vuln_severity": Severity.MEDIUM,
        "vuln_title": "Outdated Bootstrap Framework (< 4.5.0)",
        "vuln_desc": "Target uses Bootstrap {version}, subject to XSS flaws in data-attributes (tooltip/popover/collapse components).",
        "remediation": "Upgrade to Bootstrap 4.5.0+ or Bootstrap 5."
    }
]

class TechnologyScanner(BaseScanner):
    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []
        try:
            response = await client.get(target_url, timeout=10.0)
        except Exception:
            return findings

        soup = BeautifulSoup(response.text, "html.parser")
        headers = response.headers

        # 1. Meta generator inspection (CMS / Framework fingerprinting)
        generator_tag = soup.find("meta", attrs={"name": lambda x: x and x.lower() == "generator"})
        if generator_tag and generator_tag.get("content"):
            gen_val = generator_tag["content"].strip()
            findings.append(
                Finding(
                    id="SEC_GENERATOR_LEAK",
                    category=Category.SECURITY,
                    severity=Severity.LOW,
                    title=f"CMS / Generator Signature Exposed ({gen_val})",
                    description=f"HTML exposes software name and version: '{gen_val}', aiding attacker reconnaissance.",
                    remediation="Remove or sanitize the <meta name='generator'> tag from HTML templates.",
                    evidence={"generator": gen_val}
                )
            )

        # 2. Inspect script src tags for known libraries & vulnerable versions
        detected_scripts = [s.get("src", "") for s in soup.find_all("script", src=True)]
        detected_links = [l.get("href", "") for l in soup.find_all("link", href=True)]
        all_assets = detected_scripts + detected_links

        for rule in KNOWN_TECH_RULES:
            for asset_url in all_assets:
                match = re.search(rule["pattern"], asset_url, re.IGNORECASE)
                if match:
                    version = match.group(1)
                    if rule["vulnerable_check"](version):
                        findings.append(
                            Finding(
                                id=f"SEC_VULN_LIB_{rule['name'].upper()}",
                                category=Category.SECURITY,
                                severity=rule["vuln_severity"],
                                title=rule["vuln_title"].replace("{version}", version),
                                description=rule["vuln_desc"].replace("{version}", version),
                                remediation=rule["remediation"],
                                evidence={"library": rule["name"], "version": version, "source_url": asset_url}
                            )
                        )
                    break

        # 3. Backend Technology Fingerprinting from HTTP headers
        framework_headers = [
            ("x-aspnet-version", "ASP.NET Version Leak", Severity.MEDIUM),
            ("x-aspnetmvc-version", "ASP.NET MVC Version Leak", Severity.MEDIUM),
            ("x-powered-by", "Backend Framework Leak", Severity.LOW),
        ]
        for hdr_name, title, sev in framework_headers:
            if hdr_name in headers:
                val = headers[hdr_name]
                findings.append(
                    Finding(
                        id=f"SEC_HEADER_{hdr_name.upper().replace('-', '_')}",
                        category=Category.SECURITY,
                        severity=sev,
                        title=f"{title} ({val})",
                        description=f"HTTP response header '{hdr_name}' leaks backend technology details: '{val}'.",
                        remediation=f"Disable the '{hdr_name}' response header in your application server configuration.",
                        evidence={"header": hdr_name, "value": val}
                    )
                )

        return findings
