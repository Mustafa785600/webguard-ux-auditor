import pytest
from app.core.security import validate_and_sanitize_target_url, SecurityValidationError

def test_valid_urls_allowed():
    valid = [
        "https://example.com",
        "http://example.com/path?query=1",
        "https://sub.domain.org/nested/resource",
        "https://github.com",
    ]
    for url in valid:
        sanitized = validate_and_sanitize_target_url(url)
        assert sanitized.startswith("http")

def test_ssrf_private_and_loopback_blocked():
    forbidden = [
        "http://127.0.0.1",
        "http://127.0.0.1:8080/admin",
        "http://localhost",
        "http://localhost:3000",
        "http://10.0.0.1",
        "http://10.255.255.255",
        "http://172.16.0.1",
        "http://172.31.255.255",
        "http://192.168.0.1",
        "http://192.168.1.254",
        "http://169.254.169.254", # AWS metadata
        "http://0.0.0.0",
        "http://[::1]",
    ]
    for target in forbidden:
        with pytest.raises(SecurityValidationError):
            validate_and_sanitize_target_url(target)

def test_invalid_schemes_blocked():
    schemes = [
        "ftp://example.com",
        "file:///etc/passwd",
        "gopher://example.com",
        "javascript:alert(1)",
        "data:text/html,<h1>Test</h1>",
    ]
    for url in schemes:
        with pytest.raises(SecurityValidationError):
            validate_and_sanitize_target_url(url)

def test_malformed_urls_blocked():
    malformed = [
        "",
        "   ",
        "not-a-url",
        "://missing-scheme",
        "http://",
    ]
    for item in malformed:
        with pytest.raises(SecurityValidationError):
            validate_and_sanitize_target_url(item)
