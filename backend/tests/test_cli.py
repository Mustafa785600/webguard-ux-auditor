import pytest
from app.cli import run_cli_scan


@pytest.mark.asyncio
async def test_cli_scan_invalid_url_returns_error_code():
    # Loopback IP is blocked by SSRF
    code = await run_cli_scan("http://127.0.0.1:8000")
    assert code == 2  # Scan failed status code
