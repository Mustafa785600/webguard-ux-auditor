from abc import ABC, abstractmethod
from typing import List
import httpx
from app.models.schema import Finding

class BaseScanner(ABC):
    @abstractmethod
    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        pass
