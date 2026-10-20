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
                    remediation="Add the Strict-Transport-Security header to all server responses to enforce HTTPS and prevent protocol downgrade attacks.",
                    risk_impact="Without HSTS, attackers on the local network (e.g., public Wi-Fi) can perform SSL stripping attacks, downgrading connections to plaintext HTTP and intercepting session cookies and passwords.",
                    code_example="add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;",
                    target_location="nginx.conf (server block) or .htaccess",
                    problematic_code="Strict-Transport-Security: <header missing in response>"
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
                    remediation="Define a restrictive Content-Security-Policy header specifying allowed origins for scripts, styles, and other resources.",
                    risk_impact="Without CSP, the browser executes any script injected into the page, dramatically increasing the impact of XSS vulnerabilities, session hijacking, and unauthorized data exfiltration.",
                    code_example="add_header Content-Security-Policy \"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self';\" always;",
                    target_location="nginx.conf (server block) or .htaccess",
                    problematic_code="Content-Security-Policy: <header missing in response>"
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
                    remediation="Set the X-Frame-Options header to DENY or SAMEORIGIN, or configure frame-ancestors in CSP.",
                    risk_impact="Attackers can embed this website inside a transparent <iframe> on a malicious domain, tricking users into clicking hidden buttons or executing unintended actions (UI Redressing).",
                    code_example="add_header X-Frame-Options \"SAMEORIGIN\" always;",
                    target_location="nginx.conf (server block) or .htaccess",
                    problematic_code="X-Frame-Options: <header missing in response>"
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
                    remediation="Set X-Content-Type-Options to 'nosniff' to instruct browsers to honor declared MIME types strictly.",
                    risk_impact="Browsers may attempt to infer the MIME type of a file based on its contents, causing non-executable uploads (e.g. images) to be interpreted and executed as malicious JavaScript.",
                    code_example="add_header X-Content-Type-Options \"nosniff\" always;",
                    target_location="nginx.conf (server block) or .htaccess",
                    problematic_code="X-Content-Type-Options: <header missing in response>"
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
                    risk_impact="Exposing detailed server software and version numbers helps automated scanners and attackers identify and target unpatched CVE vulnerabilities.",
                    code_example="server_tokens off;",
                    target_location="nginx.conf (http block) or Apache security.conf",
                    problematic_code=f"Server: {server_header}"
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
                        risk_impact="Cookies lacking the Secure flag can be intercepted over unencrypted HTTP. Cookies without HttpOnly can be stolen by JavaScript in the event of an XSS vulnerability.",
                        code_example="response.set_cookie(key=\"session\", value=token, secure=True, httponly=True, samesite=\"lax\")",
                        target_location="Backend Application (Set-Cookie)",
                        problematic_code=f"Set-Cookie: {cookie.name}=***; (Deficiencies: {', '.join(issues)})"
                    )
                )

        return findings
