import asyncio
import re
from typing import List, Optional, Tuple
from urllib.parse import urljoin
import httpx
from app.models.schema import Finding, Category, Severity
from app.scanners.base import BaseScanner

DEBUG_PATTERNS = [
    {
        "tech": "Django Debug Mode",
        "regex": re.compile(
            r"You're seeing this error because you have DEBUG = True|Traceback \(most recent call last\):",
            re.IGNORECASE
        ),
        "critical": False,
    },
    {
        "tech": "Werkzeug Interactive Debugger",
        "regex": re.compile(
            r"Werkzeug Debugger|The debugger caught an exception in your WSGI application",
            re.IGNORECASE
        ),
        "critical": True,
    },
    {
        "tech": "Laravel Whoops / Ignition",
        "regex": re.compile(
            r"Spatie\\LaravelIgnition|Facade\\Ignition|Whoops\\Exception|Whoops! There was an error",
            re.IGNORECASE
        ),
        "critical": True,
    },
    {
        "tech": "ASP.NET Detailed Error",
        "regex": re.compile(
            r"Server Error in '/' Application\.|System\.Web\.HttpException|\[NullReferenceException:",
            re.IGNORECASE
        ),
        "critical": False,
    },
    {
        "tech": "Spring Boot / Java Stack Trace",
        "regex": re.compile(
            r"Whitelabel Error Page.*org\.springframework|java\.lang\.[a-zA-Z]+Exception",
            re.DOTALL | re.IGNORECASE
        ),
        "critical": False,
    },
    {
        "tech": "Node.js Unhandled Stack Trace",
        "regex": re.compile(
            r"(?:TypeError|ReferenceError|RangeError):.*?\n\s+at\s+(?:[a-zA-Z0-9_$.]+|\([^)]+:\d+:\d+\))",
            re.DOTALL
        ),
        "critical": False,
    },
    {
        "tech": "PHP Fatal Error",
        "regex": re.compile(
            r"Fatal error:.*?in\s+(?:/|[A-Za-z]:\\).*?on line \d+|Stack trace:\s+#0",
            re.IGNORECASE
        ),
        "critical": False,
    },
    {
        "tech": "Database Syntax / Driver Error",
        "regex": re.compile(
            r"You have an error in your SQL syntax|pg_query\(\): Query failed|SQLSTATE\[\d+\]",
            re.IGNORECASE
        ),
        "critical": False,
    },
]

class ErrorHandlingScanner(BaseScanner):
    """
    Scans for detailed stack traces, framework debug modes, and unhandled exception disclosures.
    """

    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []
        if not client:
            return findings

        # Probe paths to test error handling
        probes = [
            target_url,
            urljoin(target_url, "/webguard_err_handling_test_404_probe"),
            urljoin(target_url, "?__webguard_debug_probe__=%27%22%3C%3E%00"),
        ]

        tasks = [self._probe_for_debug_leak(url, client) for url in probes]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        seen_techs = set()
        for res in results:
            if isinstance(res, Finding) and res.title not in seen_techs:
                seen_techs.add(res.title)
                findings.append(res)

        return findings

    async def _probe_for_debug_leak(self, probe_url: str, client: httpx.AsyncClient) -> Optional[Finding]:
        try:
            resp = await client.get(probe_url, timeout=5.0)
            body_text = resp.text
            if not body_text:
                return None

            for pattern in DEBUG_PATTERNS:
                match = pattern["regex"].search(body_text)
                if match:
                    tech = pattern["tech"]
                    is_critical = pattern["critical"]
                    snippet = body_text[max(0, match.start() - 40): min(len(body_text), match.end() + 160)].strip()

                    return Finding(
                        id="SEC_STACK_TRACE_DISCLOSURE",
                        category=Category.SECURITY,
                        severity=Severity.CRITICAL if is_critical else Severity.HIGH,
                        title=f"Stack Trace / Debug Screen Exposed ({tech})",
                        description=f"Server returned a detailed application debug screen or stack trace ({tech}) when responding to requests at {probe_url}.",
                        remediation="Disable debug mode in production (e.g. DEBUG=False in Django/Flask, display_errors=Off in php.ini, NODE_ENV=production in Node.js). Implement a custom global error handler that returns sanitized, user-friendly 500 error pages without stack traces.",
                        evidence={
                            "technology": tech,
                            "probe_url": probe_url,
                            "snippet": snippet[:200]
                        },
                        risk_impact="Detailed stack traces disclose internal file paths, framework versions, database schema names, and potentially sensitive environment variables. Attackers use this blueprint to find unpatched CVEs and construct targeted exploit chains.",
                        code_example="# Django settings.py\nDEBUG = False\nALLOWED_HOSTS = ['example.com']\n\n# Nginx custom 500 page\nerror_page 500 502 503 504 /50x.html;\nlocation = /50x.html {\n    root /usr/share/nginx/html;\n}",
                        target_location="Application Error Handler / Server Configuration",
                        problematic_code=snippet[:180]
                    )
        except Exception:
            pass

        return None

