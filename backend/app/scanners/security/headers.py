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
                    code_example="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}",
                    target_location="nginx.conf (server block)",
                    problematic_code="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}"
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
                    code_example="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    add_header Content-Security-Policy \"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:;\" always;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}",
                    target_location="nginx.conf (server block)",
                    problematic_code="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}"
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
                    code_example="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    add_header X-Frame-Options \"SAMEORIGIN\" always;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}",
                    target_location="nginx.conf (server block)",
                    problematic_code="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}"
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
                    code_example="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    add_header X-Content-Type-Options \"nosniff\" always;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}",
                    target_location="nginx.conf (server block)",
                    problematic_code="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}"
                )
            )

        # Referrer-Policy Check
        referrer_policy = headers.get("referrer-policy", "").lower().strip()
        if not referrer_policy:
            findings.append(
                Finding(
                    id="SEC_REFERRER_POLICY_MISSING",
                    category=Category.SECURITY,
                    severity=Severity.LOW,
                    title="Missing Referrer-Policy Header",
                    description="The server does not specify a Referrer-Policy header, which may lead to unintentional leakage of sensitive URL paths and query parameters to third-party domains.",
                    remediation="Configure the 'Referrer-Policy' header to 'strict-origin-when-cross-origin' or 'no-referrer'.",
                    risk_impact="Without an explicit policy, browsers may include full paths and query strings (potentially containing session tokens, email addresses, or internal parameters) in the HTTP Referer header when navigating to external websites.",
                    code_example="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}",
                    target_location="nginx.conf (server block)",
                    problematic_code="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    # Missing Referrer-Policy header\n}"
                )
            )
        elif referrer_policy == "unsafe-url":
            findings.append(
                Finding(
                    id="SEC_INSECURE_REFERRER_POLICY",
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title="Insecure Referrer-Policy ('unsafe-url')",
                    description="Referrer-Policy is set to 'unsafe-url', sending full URL paths and query strings to all destinations regardless of security protocol.",
                    remediation="Change Referrer-Policy to 'strict-origin-when-cross-origin' or 'no-referrer'.",
                    risk_impact="Setting 'unsafe-url' leaks full URLs (including sensitive query parameters) across all cross-origin requests, including unencrypted HTTP connections.",
                    code_example="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;\n}",
                    target_location="nginx.conf (server block)",
                    problematic_code="add_header Referrer-Policy \"unsafe-url\" always;"
                )
            )

        # Permissions-Policy Check (formerly Feature-Policy)
        if "permissions-policy" not in headers and "feature-policy" not in headers:
            findings.append(
                Finding(
                    id="SEC_PERMISSIONS_POLICY_MISSING",
                    category=Category.SECURITY,
                    severity=Severity.LOW,
                    title="Missing Permissions-Policy Header",
                    description="The web server does not provide a Permissions-Policy header to restrict powerful browser capabilities (camera, microphone, geolocation).",
                    remediation="Add a Permissions-Policy header explicitly controlling access to sensitive browser APIs (e.g. camera=(), microphone=(), geolocation=()).",
                    risk_impact="Without a Permissions-Policy header, embedded iframes or compromised third-party scripts may gain unauthorized access to browser APIs such as the camera, microphone, or user location.",
                    code_example="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    add_header Permissions-Policy \"camera=(), microphone=(), geolocation=()\" always;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}",
                    target_location="nginx.conf (server block)",
                    problematic_code="server {\n    listen 443 ssl http2;\n    server_name example.com;\n    # Missing Permissions-Policy header\n}"
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
                    code_example="http {\n    server_tokens off;\n    include mime.types;\n    default_type application/octet-stream;\n}",
                    target_location="nginx.conf (http block)",
                    problematic_code=f"http {{\n    server_tokens on;\n    include mime.types;\n    default_type application/octet-stream;\n}}"
                )
            )

        # Cookie Security Inspection (Secure, HttpOnly, SameSite)
        cookies_to_inspect = []
        seen_names = set()

        # 1. Inspect raw Set-Cookie headers
        raw_set_cookies = response.headers.get_list("set-cookie") if hasattr(response.headers, "get_list") else []
        for raw_cookie in raw_set_cookies:
            parts = [p.strip() for p in raw_cookie.split(";") if p.strip()]
            if not parts:
                continue
            name = parts[0].split("=", 1)[0].strip()
            directives = {}
            for p in parts[1:]:
                if "=" in p:
                    k, v = p.split("=", 1)
                    directives[k.strip().lower()] = v.strip()
                else:
                    directives[p.strip().lower()] = True

            seen_names.add(name)
            cookies_to_inspect.append({
                "name": name,
                "secure": "secure" in directives,
                "httponly": "httponly" in directives,
                "samesite": directives.get("samesite")
            })

        # 2. Fallback to response.cookies.jar
        try:
            jar = getattr(response.cookies, "jar", [])
        except Exception:
            jar = []

        for cookie in jar:
            if cookie.name in seen_names:
                continue
            is_secure = bool(cookie.secure)
            is_httponly = bool(cookie.has_nonstandard_attr("HttpOnly") or getattr(cookie, "httponly", False))
            samesite = cookie.get_nonstandard_attr("SameSite") or cookie.get_nonstandard_attr("samesite")
            if not samesite and hasattr(cookie, "_rest"):
                for k, v in cookie._rest.items():
                    if k.lower() == "samesite":
                        samesite = v or True
                        break

            cookies_to_inspect.append({
                "name": cookie.name,
                "secure": is_secure,
                "httponly": is_httponly,
                "samesite": samesite
            })

        for c in cookies_to_inspect:
            cookie_name = c["name"]
            issues = []
            if not c["secure"]:
                issues.append("Missing Secure flag")
            if not c["httponly"]:
                issues.append("Missing HttpOnly flag")

            samesite = c.get("samesite")
            if not samesite:
                issues.append("Missing SameSite attribute (CSRF risk)")
            else:
                samesite_str = str(samesite).lower()
                if samesite_str not in ("lax", "strict"):
                    if samesite_str == "none":
                        if not c["secure"]:
                            issues.append("SameSite=None without Secure flag (rejected by modern browsers)")
                        else:
                            issues.append("SameSite=None relaxes cross-site request forgery protection")
                    else:
                        issues.append(f"Invalid SameSite value ('{samesite}')")

            if issues:
                findings.append(
                    Finding(
                        id="SEC_INSECURE_COOKIE",
                        category=Category.SECURITY,
                        severity=Severity.MEDIUM,
                        title=f"Insecure Cookie Flags: {cookie_name}",
                        description=f"Cookie '{cookie_name}' has security deficiencies: {', '.join(issues)}.",
                        remediation="Ensure all session and authentication cookies enforce 'Secure', 'HttpOnly', and 'SameSite=Lax/Strict'.",
                        evidence={"cookie_name": cookie_name, "issues": issues},
                        risk_impact="Cookies lacking the Secure flag can be intercepted over unencrypted HTTP. Cookies without HttpOnly can be stolen by JavaScript in the event of an XSS vulnerability. Missing or improper SameSite flags allow cross-site requests to transmit cookies, leaving users vulnerable to Cross-Site Request Forgery (CSRF).",
                        code_example="response.set_cookie(key=\"session\", value=token, secure=True, httponly=True, samesite=\"lax\")",
                        target_location="Backend Application (Set-Cookie)",
                        problematic_code=f"Set-Cookie: {cookie_name}=***; (Deficiencies: {', '.join(issues)})"
                    )
                )

        return findings
