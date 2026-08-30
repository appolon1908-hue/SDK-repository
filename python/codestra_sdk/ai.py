from dataclasses import dataclass
from typing import Any
import httpx

@dataclass
class AIClient:
    base_url: str
    token: str

    async def generate(self, payload: dict[str, Any], *, correlation_id: str | None = None) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.token}"}
        if correlation_id:
            headers["X-Correlation-ID"] = correlation_id
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
            response = await client.post("/v1/ai/generate", json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
