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
        "risk_impact": "Veritabanı bağlantı şifreleri, API gizli anahtarları ve JWT imzalama anahtarları internete sızar. Saldırganlar tüm veritabanını indirebilir veya sunucuya sızabilir.",
        "code_example": "# Nginx - Gizli dosyalara (. ile başlayan) erişimi engelleme\nlocation ~ /\\.(?!well-known).* {\n    deny all;\n    return 404;\n}"
    },
    {
        "path": "/.git/HEAD",
        "id": "SEC_EXPOSED_GIT_REPO",
        "severity": Severity.CRITICAL,
        "title": "Exposed Git Repository (.git/HEAD)",
        "description": "The .git directory is publicly accessible, allowing attackers to download and reconstruct entire source code repositories.",
        "remediation": "Block HTTP/HTTPS access to all '.git' directories and files in your web server configuration.",
        "validator": lambda text, ct: text.strip().startswith("ref: refs/"),
        "risk_impact": "Saldırganlar git-dumper gibi araçlarla tüm kaynak kod geçmişinizi, commit kayıtlarınızı ve geçmişte koda gömülmüş tüm gizli şifreleri indirip yeniden oluşturabilir.",
        "code_example": "# Nginx - .git dizinini tamamen bloke et\nlocation ~ /\\.git {\n    deny all;\n    return 404;\n}"
    },
    {
        "path": "/swagger.json",
        "id": "SEC_EXPOSED_SWAGGER_SCHEMA",
        "severity": Severity.LOW,
        "title": "Publicly Accessible OpenAPI/Swagger Specification",
        "description": "Detailed API schema definition is exposed publicly, detailing endpoints, parameters, and authentication schemes.",
        "remediation": "Restrict API documentation access behind authentication or disable schema exposure in production.",
        "validator": lambda text, ct: "swagger" in text[:200].lower() or "openapi" in text[:200].lower(),
        "risk_impact": "Sitenin tüm gizli API endpoint'leri ve parametreleri saldırganlar için saldırı yüzeyini haritalandıran açık bir rehber haline gelir.",
        "code_example": "# FastAPI - Canlı ortamda docs_url ve openapi_url'i kapatın\napp = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)"
    },
    {
        "path": "/openapi.json",
        "id": "SEC_EXPOSED_OPENAPI_SCHEMA",
        "severity": Severity.LOW,
        "title": "Publicly Accessible OpenAPI Specification",
        "description": "API contract is exposed publicly, aiding reconnaissance of internal data models and endpoints.",
        "remediation": "Disable automated OpenAPI schema endpoints in production environments.",
        "validator": lambda text, ct: "openapi" in text[:200].lower(),
        "risk_impact": "Dahili veri modelleri ve yetkilendirme şemaları ifşa olarak API istismarını kolaylaştırır.",
        "code_example": "# FastAPI - Canlı ortamda openapi_url=None yapın\napp = FastAPI(openapi_url=None)"
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
                        target_location="Web Root (Sunucu Döküman Kök Dizini)",
                        problematic_code=f"Açıkta Kalan Dosya/Dizin: {target_path}\nErişilebilir URL: {probe_url}"
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
                leaked_paths = []
                for line in resp.text.splitlines():
                    clean_line = line.strip().lower()
                    if clean_line.startswith("disallow:"):
                        path = clean_line.split(":", 1)[1].strip()
                        if any(kw in path for kw in sensitive_keywords):
                            leaked_paths.append(path)

                if leaked_paths:
                    return Finding(
                        id="SEC_ROBOTS_PATH_DISCLOSURE",
                        category=Category.SECURITY,
                        severity=Severity.MEDIUM,
                        title="Sensitive Directory Disclosure via robots.txt",
                        description=f"robots.txt disallow directives advertise sensitive internal paths: {', '.join(leaked_paths[:5])}.",
                        remediation="Do not rely on robots.txt for security; restrict access to sensitive paths using authentication and authorization controls.",
                        evidence={"sensitive_paths": leaked_paths},
                        risk_impact="robots.txt dosyası halka açıktır. 'Disallow' direktifine yazılan gizli yönetici ve yedek dizinleri saldırganlar tarafından ilk taranan adresler olur.",
                        code_example="# Hassas dizinleri robots.txt ile gizlemek yerine Nginx/Apache seviyesinde parola veya IP kısıtlaması koyun:\nlocation /admin {\n    allow 192.168.1.0/24;\n    deny all;\n}"
                    )
        except Exception:
            pass
        return None
