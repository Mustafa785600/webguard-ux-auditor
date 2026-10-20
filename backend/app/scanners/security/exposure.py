import asyncio
from typing import List, Tuple
from urllib.parse import urljoin
import httpx
from app.models.schema import Finding, Category, Severity
from app.scanners.base import BaseScanner

SENSITIVE_TARGETS = [
    {
        "path": "/.env",
        "id": "SEC_EXPOSED_ENV_FILE",
        "severity": Severity.CRITICAL,
        "title": "Exposed Environment Configuration (.env)",
        "description": "Publicly accessible .env file detected, exposing sensitive database credentials and API secrets.",
        "remediation": "Restrict web server access to dotfiles and move secret configuration files outside the web root.",
        "validator": lambda text, ct: not text.lstrip().startswith("<!DOCTYPE") and not text.lstrip().startswith("<html") and any(
            k in text for k in ("APP_KEY=", "DB_PASSWORD=", "DATABASE_URL=", "SECRET_KEY=", "AWS_ACCESS_KEY")
        ),
        "risk_impact": "Database passwords, secret API keys, and JWT signing secrets are exposed to the public internet, allowing attackers to dump backend databases or compromise the server.",
        "code_example": "location ~ /\\.(?!well-known).* {\n    deny all;\n    return 404;\n}",
        "target_location": ".env",
        "line_number": 1,
        "problematic_code": "/.env (Publicly Accessible)"
    },
    {
        "path": "/.git/HEAD",
        "id": "SEC_EXPOSED_GIT_REPO",
        "severity": Severity.CRITICAL,
        "title": "Exposed Git Repository (.git/HEAD)",
        "description": "The .git directory is publicly accessible, allowing attackers to download and reconstruct entire source code repositories.",
        "remediation": "Block HTTP/HTTPS access to all '.git' directories and files in your web server configuration.",
        "validator": lambda text, ct: text.strip().startswith("ref: refs/"),
        "risk_impact": "Attackers can dump the complete Git repository, recovering full proprietary source code, commit history, and historical hardcoded credentials.",
        "code_example": "location ~ /\\.git {\n    deny all;\n    return 404;\n}",
        "target_location": ".git/HEAD",
        "line_number": 1,
        "problematic_code": "/.git/HEAD (Publicly Accessible)"
    },
    {
        "path": "/swagger.json",
        "id": "SEC_EXPOSED_SWAGGER_SCHEMA",
        "severity": Severity.LOW,
        "title": "Publicly Accessible OpenAPI/Swagger Specification",
        "description": "Detailed API schema definition is exposed publicly, detailing endpoints, parameters, and authentication schemes.",
        "remediation": "Restrict API documentation access behind authentication or disable schema exposure in production.",
        "validator": lambda text, ct: "swagger" in text[:200].lower() or "openapi" in text[:200].lower(),
        "risk_impact": "Internal API endpoints, schema definitions, and parameter structures are exposed, facilitating automated vulnerability discovery.",
        "code_example": "app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)",
        "target_location": "main.py",
        "line_number": 1,
        "problematic_code": "/swagger.json (Publicly Accessible)"
    },
    {
        "path": "/openapi.json",
        "id": "SEC_EXPOSED_OPENAPI_SCHEMA",
        "severity": Severity.LOW,
        "title": "Publicly Accessible OpenAPI Specification",
        "description": "API contract is exposed publicly, aiding reconnaissance of internal data models and endpoints.",
        "remediation": "Disable automated OpenAPI schema endpoints in production environments.",
        "validator": lambda text, ct: "openapi" in text[:200].lower(),
        "risk_impact": "Internal data models and authentication scopes are disclosed, aiding reconnaissance and targeted API exploitation.",
        "code_example": "app = FastAPI(openapi_url=None)",
        "target_location": "main.py",
        "line_number": 1,
        "problematic_code": "/openapi.json (Publicly Accessible)"
    }
]

class ExposureScanner(BaseScanner):
    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []
        
        # 1. Concurrently check sensitive file targets
        tasks = [self._check_file_target(target_url, target, client) for target in SENSITIVE_TARGETS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for res in results:
            if isinstance(res, Finding):
                findings.append(res)

        # 2. Check robots.txt for sensitive path leaks
        robots_finding = await self._check_robots_txt(target_url, client)
        if robots_finding:
            findings.append(robots_finding)

        return findings

    async def _check_file_target(self, base_url: str, target_spec: dict, client: httpx.AsyncClient) -> Finding | None:
        target_path = target_spec["path"]
        probe_url = urljoin(base_url, target_path)

        try:
            resp = await client.get(probe_url, timeout=5.0)
            if resp.status_code == 200:
                body_text = resp.text
                content_type = resp.headers.get("content-type", "")
                if target_spec["validator"](body_text, content_type):
                    return Finding(
                        id=target_spec["id"],
                        category=Category.SECURITY,
                        severity=target_spec["severity"],
                        title=target_spec["title"],
                        description=target_spec["description"],
                        remediation=target_spec["remediation"],
                        evidence={"exposed_url": probe_url, "content_snippet": body_text[:150]},
                        risk_impact=target_spec.get("risk_impact"),
                        code_example=target_spec.get("code_example"),
                        target_location=target_spec.get("target_location", "Web Root"),
                        line_number=target_spec.get("line_number"),
                        problematic_code=f"Accessible Resource: {probe_url}"
                    )
        except Exception:
            pass
        return None

    async def _check_robots_txt(self, base_url: str, client: httpx.AsyncClient) -> Finding | None:
        robots_url = urljoin(base_url, "/robots.txt")
        try:
            resp = await client.get(robots_url, timeout=5.0)
            if resp.status_code == 200 and not resp.text.lstrip().startswith("<!DOCTYPE"):
                sensitive_keywords = ["admin", "backup", "secret", "private", "internal", "dashboard", "portal"]
                leaked_entries = []
                for line_idx, line in enumerate(resp.text.splitlines(), start=1):
                    clean_line = line.strip().lower()
                    if clean_line.startswith("disallow:"):
                        path = clean_line.split(":", 1)[1].strip()
                        if any(kw in path for kw in sensitive_keywords):
                            leaked_entries.append((path, line_idx))

                if leaked_entries:
                    return Finding(
                        id="SEC_ROBOTS_PATH_DISCLOSURE",
                        category=Category.SECURITY,
                        severity=Severity.MEDIUM,
                        title="Sensitive Directory Disclosure via robots.txt",
                        description=f"robots.txt disallow directives advertise sensitive internal paths: {', '.join([e[0] for e in leaked_entries[:5]])}.",
                        remediation="Do not rely on robots.txt for security; restrict access to sensitive paths using authentication and authorization controls.",
                        evidence={"sensitive_paths": [e[0] for e in leaked_entries]},
                        risk_impact="robots.txt is public. Listing private administration or backup paths in Disallow directives exposes them to discovery by attackers.",
                        code_example="location /admin {\n    allow 192.168.1.0/24;\n    deny all;\n}",
                        target_location="robots.txt",
                        line_number=leaked_entries[0][1],
                        problematic_code="\n".join([f"Disallow: {e[0]}" for e in leaked_entries[:3]])
                    )
        except Exception:
            pass
        return None
