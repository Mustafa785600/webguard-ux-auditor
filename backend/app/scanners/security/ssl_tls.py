import asyncio
from datetime import datetime, timezone
import ssl
from typing import List, Optional
from urllib.parse import urlparse
import httpx
from app.models.schema import Finding, Category, Severity
from app.scanners.base import BaseScanner

class SSLTLSScanner(BaseScanner):
    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []
        parsed = urlparse(target_url)

        if parsed.scheme == "http":
            findings.append(
                Finding(
                    id="SEC_NO_ENCRYPTION",
                    category=Category.SECURITY,
                    severity=Severity.CRITICAL,
                    title="Unencrypted HTTP Transport",
                    description="The target communicates over plaintext HTTP without transport-layer encryption.",
                    remediation="Migrate all endpoints to HTTPS and enforce an automatic HTTP-to-HTTPS redirect."
                )
            )
            return findings

        hostname = parsed.hostname
        if not hostname:
            return findings

        port = parsed.port or 443

        try:
            cert, tls_version, cipher = await self._fetch_cert_and_tls_details(hostname, port)
        except ssl.SSLCertVerificationError as exc:
            findings.append(
                Finding(
                    id="SEC_CERT_VERIFY_FAILED",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="Invalid or Self-Signed SSL Certificate",
                    description=f"TLS certificate verification failed: {str(exc.verify_message or exc)}",
                    remediation="Install a valid SSL/TLS certificate issued by a trusted Certificate Authority (CA)."
                )
            )
            return findings
        except ssl.SSLError as exc:
            findings.append(
                Finding(
                    id="SEC_TLS_HANDSHAKE_ERROR",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title="TLS Handshake Failure",
                    description=f"A TLS error occurred during handshake: {str(exc)}",
                    remediation="Review server SSL/TLS cipher suites and protocol configurations."
                )
            )
            return findings
        except Exception as exc:
            findings.append(
                Finding(
                    id="SEC_TLS_CONNECT_TIMEOUT",
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title="TLS Connection Failure",
                    description=f"Could not establish TLS connection to port {port}: {str(exc)}",
                    remediation="Ensure the server is accepting secure TLS connections on port 443."
                )
            )
            return findings

        if not cert:
            return findings

        # Check Certificate Expiration
        not_after_str = cert.get("notAfter")
        if not_after_str:
            try:
                expire_date = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                days_left = (expire_date - now).days

                if days_left < 0:
                    findings.append(
                        Finding(
                            id="SEC_CERT_EXPIRED",
                            category=Category.SECURITY,
                            severity=Severity.CRITICAL,
                            title="SSL/TLS Certificate Expired",
                            description=f"Certificate expired {abs(days_left)} days ago on {expire_date.strftime('%Y-%m-%d')}.",
                            remediation="Immediately renew and deploy a valid SSL/TLS certificate.",
                            evidence={"expiration_date": expire_date.isoformat(), "days_left": days_left}
                        )
                    )
                elif days_left <= 14:
                    findings.append(
                        Finding(
                            id="SEC_CERT_EXPIRING_CRITICAL",
                            category=Category.SECURITY,
                            severity=Severity.HIGH,
                            title=f"SSL/TLS Certificate Expiring in {days_left} Days",
                            description=f"Certificate will expire on {expire_date.strftime('%Y-%m-%d')}.",
                            remediation="Renew certificate immediately to avoid service interruption and security warnings.",
                            evidence={"expiration_date": expire_date.isoformat(), "days_left": days_left}
                        )
                    )
                elif days_left <= 30:
                    findings.append(
                        Finding(
                            id="SEC_CERT_EXPIRING_SOON",
                            category=Category.SECURITY,
                            severity=Severity.LOW,
                            title=f"SSL/TLS Certificate Renewal Due ({days_left} Days Remaining)",
                            description=f"Certificate expires on {expire_date.strftime('%Y-%m-%d')}.",
                            remediation="Plan certificate renewal before the 30-day window closes.",
                            evidence={"expiration_date": expire_date.isoformat(), "days_left": days_left}
                        )
                    )
            except ValueError:
                pass

        # Check Deprecated TLS Versions
        if tls_version and tls_version in ("TLSv1", "TLSv1.1", "SSLv3", "SSLv2"):
            findings.append(
                Finding(
                    id="SEC_DEPRECATED_TLS_VERSION",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title=f"Deprecated TLS Protocol ({tls_version})",
                    description=f"Server negotiated connection using obsolete {tls_version}, vulnerable to cryptographic attacks.",
                    remediation="Disable SSLv3, TLS 1.0, and TLS 1.1 on the server. Enforce TLS 1.2 or TLS 1.3.",
                    evidence={"tls_version": tls_version}
                )
            )

        # Cipher Suite Inspection
        if cipher:
            cipher_name = cipher[0]
            if any(weak in cipher_name for weak in ("RC4", "3DES", "DES", "MD5", "NULL")):
                findings.append(
                    Finding(
                        id="SEC_WEAK_CIPHER_SUITE",
                        category=Category.SECURITY,
                        severity=Severity.HIGH,
                        title=f"Weak Cipher Suite In Use ({cipher_name})",
                        description=f"Server selected an insecure cipher suite: {cipher_name}.",
                        remediation="Configure the server to exclusively use forward-secret AEAD cipher suites (e.g., ECDHE-RSA-AES-GCM).",
                        evidence={"cipher": cipher_name}
                    )
                )

        return findings

    async def _fetch_cert_and_tls_details(self, hostname: str, port: int):
        ctx = ssl.create_default_context()
        loop = asyncio.get_running_loop()

        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(hostname, port, ssl=ctx, server_hostname=hostname),
            timeout=10.0
        )
        try:
            ssl_obj = writer.get_extra_info("ssl_object")
            cert = ssl_obj.getpeercert()
            tls_version = ssl_obj.version()
            cipher = ssl_obj.cipher()
            return cert, tls_version, cipher
        finally:
            writer.close()
            await writer.wait_closed()
