import ipaddress
import socket
from urllib.parse import urlparse

class SecurityValidationError(ValueError):
    pass

def validate_and_sanitize_target_url(raw_url: str) -> str:
    cleaned_url = raw_url.strip()
    if not (cleaned_url.startswith("http://") or cleaned_url.startswith("https://")):
        cleaned_url = f"https://{cleaned_url}"

    parsed = urlparse(cleaned_url)
    if parsed.scheme not in ("http", "https"):
        raise SecurityValidationError("Invalid scheme. Only HTTP and HTTPS are permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise SecurityValidationError("Invalid URL: missing hostname.")

    try:
        resolved_ips = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise SecurityValidationError(f"DNS resolution failed for hostname: {hostname}") from exc

    for entry in resolved_ips:
        sockaddr = entry[4]
        ip_str = sockaddr[0]
        ip_obj = ipaddress.ip_address(ip_str)

        if (
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_reserved
            or ip_obj.is_link_local
            or ip_obj.is_multicast
        ):
            raise SecurityValidationError("SSRF Protection: Access to private or loopback addresses is forbidden.")

    port_segment = f":{parsed.port}" if parsed.port and parsed.port not in (80, 443) else ""
    path_segment = parsed.path if parsed.path else "/"
    query_segment = f"?{parsed.query}" if parsed.query else ""

    return f"{parsed.scheme}://{hostname}{port_segment}{path_segment}{query_segment}"
