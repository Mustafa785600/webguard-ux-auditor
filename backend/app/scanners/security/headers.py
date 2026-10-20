from typing import List
import httpx
from app.models.schema import Finding, Category, Severity
from app.scanners.base import BaseScanner

class SecurityHeadersScanner(BaseScanner):
    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []
        try:
            response = await client.get(target_url)
        except Exception as exc:
            findings.append(
                Finding(
                    id="SEC_UNREACHABLE",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="Target Unreachable",
                    description=f"Failed to establish HTTP connection: {str(exc)}",
                    remediation="Ensure the target server is online and reachable over standard HTTP/HTTPS ports."
                )
            )
            return findings

        headers = {k.lower(): v for k, v in response.headers.items()}

        if "strict-transport-security" not in headers:
            findings.append(
                Finding(
                    id="SEC_HSTS_MISSING",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="Missing HTTP Strict Transport Security (HSTS)",
                    description="The web server does not enforce HTTPS connections via the Strict-Transport-Security header.",
                    remediation="Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' to server responses.",
                    risk_impact="HTTPS zorunlu kılınmadığında, ortak Wi-Fi veya güvensiz ağlardaki saldırganlar SSL Stripping ile trafiği şifresiz HTTP'ye düşürüp şifre ve oturum çerezlerini dinleyebilir.",
                    code_example="# Nginx Yapılandırması\nadd_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;\n\n# Apache (.htaccess)\nHeader always set Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\"",
                    target_location="nginx.conf (server/http bloğu) veya .htaccess",
                    problematic_code="HTTP/1.1 Yanıt Başlıkları: [Strict-Transport-Security Başlığı Tanımlanmamış]"
                )
            )

        if "content-security-policy" not in headers:
            findings.append(
                Finding(
                    id="SEC_CSP_MISSING",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="Missing Content-Security-Policy (CSP)",
                    description="No Content Security Policy header defined, increasing vulnerability to Cross-Site Scripting (XSS) and data injection.",
                    remediation="Implement a restrictive Content-Security-Policy header restricting trusted script, style, and media origins.",
                    risk_impact="CSP olmadığında tarayıcı harici sitelerden yüklenen her türlü zararlı JavaScript kodunu çalıştırır. XSS, veri sızdırma ve kötü niyetli form enjeksiyonu riskleri tavan yapar.",
                    code_example="# Nginx Temel Güvenli CSP Şablonu\nadd_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;\" always;",
                    target_location="nginx.conf (server/http bloğu) veya .htaccess",
                    problematic_code="HTTP/1.1 Yanıt Başlıkları: [Content-Security-Policy Başlığı Tanımlanmamış]"
                )
            )

        if "x-frame-options" not in headers and "frame-ancestors" not in headers.get("content-security-policy", ""):
            findings.append(
                Finding(
                    id="SEC_CLICKJACKING_RISK",
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title="Clickjacking Protection Missing",
                    description="Neither X-Frame-Options nor CSP frame-ancestors directive is configured to prevent iframe embedding.",
                    remediation="Set 'X-Frame-Options: DENY' or 'X-Frame-Options: SAMEORIGIN'.",
                    risk_impact="Saldırganlar sitenizi sahte bir web sitesi içine görünmez bir <iframe> ile yerleştirebilir (Clickjacking / UI Redressing). Kullanıcılar farkında olmadan butonlara tıklatılabilir.",
                    code_example="# Nginx\nadd_header X-Frame-Options \"SAMEORIGIN\" always;\n\n# Apache (.htaccess)\nHeader always set X-Frame-Options \"SAMEORIGIN\"",
                    target_location="nginx.conf (server/http bloğu) veya .htaccess",
                    problematic_code="HTTP/1.1 Yanıt Başlıkları: [X-Frame-Options ve frame-ancestors Yok]"
                )
            )

        if headers.get("x-content-type-options", "").lower() != "nosniff":
            findings.append(
                Finding(
                    id="SEC_NOSNIFF_MISSING",
                    category=Category.SECURITY,
                    severity=Severity.LOW,
                    title="Missing X-Content-Type-Options Header",
                    description="Missing or misconfigured 'nosniff' directive allows MIME-type sniffing attacks.",
                    remediation="Set 'X-Content-Type-Options: nosniff'.",
                    risk_impact="Tarayıcılar dosya türünü içeriğe bakarak tahmin etmeye çalışır (MIME Sniffing). Kullanıcıların yüklediği zararsız dosyalar (örn. avatar.jpg) zararlı JavaScript olarak yürütülebilir.",
                    code_example="# Nginx\nadd_header X-Content-Type-Options \"nosniff\" always;\n\n# Apache (.htaccess)\nHeader always set X-Content-Type-Options \"nosniff\"",
                    target_location="nginx.conf veya .htaccess",
                    problematic_code="HTTP/1.1 Yanıt Başlıkları: [X-Content-Type-Options Başlığı Eksik]"
                )
            )

        server_header = headers.get("server") or headers.get("x-powered-by")
        if server_header:
            findings.append(
                Finding(
                    id="SEC_SERVER_INFO_LEAK",
                    category=Category.SECURITY,
                    severity=Severity.LOW,
                    title="Server Version / Technology Leak",
                    description=f"Server exposes technology signatures: {server_header}",
                    remediation="Suppress or obfuscate 'Server' and 'X-Powered-By' headers in the web server configuration.",
                    evidence={"header_value": server_header},
                    risk_impact="Sunucunun ve kütüphanelerin tam sürümünün açığa çıkması, saldırganların o sürüme ait bilinen güvenlik açıklarını (1-day/0-day CVE) doğrudan denemesine kapı aralar.",
                    code_example="# Nginx (nginx.conf)\nserver_tokens off;\n\n# Apache (security.conf)\nServerTokens Prod\nServerSignature Off",
                    target_location="nginx.conf (http bloğu) veya Apache security.conf",
                    problematic_code=f"Giden Başlık: Server / X-Powered-By: {server_header}"
                )
            )

        for cookie in response.cookies.jar:
            issues = []
            if not cookie.secure:
                issues.append("Missing Secure flag")
            if not cookie.has_nonstandard_attr("HttpOnly") and not getattr(cookie, "httponly", False):
                issues.append("Missing HttpOnly flag")
            if issues:
                findings.append(
                    Finding(
                        id="SEC_INSECURE_COOKIE",
                        category=Category.SECURITY,
                        severity=Severity.MEDIUM,
                        title=f"Insecure Cookie Flags: {cookie.name}",
                        description=f"Cookie '{cookie.name}' has security deficiencies: {', '.join(issues)}.",
                        remediation="Ensure all session and authentication cookies enforce 'Secure', 'HttpOnly', and 'SameSite=Lax/Strict'.",
                        evidence={"cookie_name": cookie.name, "issues": issues},
                        risk_impact="Secure bayrağı olmayan çerezler şifresiz ağlarda dinlenebilir. HttpOnly bayrağı olmayan çerezler ise olası bir XSS açığında saldırganın JavaScript koduyla çalınıp oturum gaspı yapılabilir.",
                        code_example="# Python / FastAPI / Starlette ile Güvenli Çerez Ayarlama\nresponse.set_cookie(\n    key=\"session_token\",\n    value=user_token,\n    secure=True,       # Yalnızca HTTPS\n    httponly=True,     # JS erişimi engelli\n    samesite=\"lax\"     # CSRF koruması\n)",
                        target_location="Uygulama Backend Kodu (Set-Cookie)",
                        problematic_code=f"Set-Cookie: {cookie.name}=***; (Eksikler: {', '.join(issues)})"
                    )
                )

        return findings
