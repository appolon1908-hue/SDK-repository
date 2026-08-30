from dataclasses import dataclass
from typing import Any
import httpx

@dataclass
class CommunicationClient:
    base_url: str
    token: str

    async def send(self, payload: dict[str, Any], *, idempotency_key: str, correlation_id: str | None = None) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.token}", "Idempotency-Key": idempotency_key}
        if correlation_id:
            headers["X-Correlation-ID"] = correlation_id
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15.0) as client:
            response = await client.post("/v1/communication/messages", json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
