import pytest
import httpx
from typing import Dict, Optional

class MockResponse:
    def __init__(
        self,
        status_code: int = 200,
        text: str = "",
        headers: Optional[Dict[str, str]] = None,
        cookies: Optional[Dict[str, str]] = None
    ):
        self.status_code = status_code
        self.text = text
        self.headers = httpx.Headers(headers or {})
        self._cookies = cookies or {}

    @property
    def cookies(self):
        class MockJar:
            jar = []
        return MockJar()

class MockAsyncClient:
    def __init__(self, responses: Optional[Dict[str, MockResponse]] = None, default_response: Optional[MockResponse] = None):
        self.responses = responses or {}
        self.default_response = default_response or MockResponse(200, "<html></html>", {})

    async def get(self, url: str, **kwargs):
        return self.responses.get(url, self.default_response)

    async def head(self, url: str, **kwargs):
        return self.responses.get(url, self.default_response)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

@pytest.fixture
def mock_client_factory():
    def _create(responses=None, default=None):
        return MockAsyncClient(responses, default)
    return _create
