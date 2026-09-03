from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass
from typing import Protocol

from .errors import AuthenticationError, IdempotencyConflictError, ValidationError


class ReplayStore(Protocol):
    async def claim(self, tenant_id: str, provider: str, event_id: str, payload_hash: str) -> bool: ...


class InMemoryReplayStore:
    """Test-only replay store. Production callers must inject durable storage."""

    def __init__(self) -> None:
        self._claims: set[tuple[str, str, str, str]] = set()

    async def claim(self, tenant_id: str, provider: str, event_id: str, payload_hash: str) -> bool:
        key = (tenant_id, provider, event_id, payload_hash)
        if key in self._claims:
            return False
        self._claims.add(key)
        return True


@dataclass(frozen=True)
class VerifiedWebhook:
    tenant_id: str
    provider: str
    event_id: str
    payload_hash: str
    raw_body: bytes
    timestamp: int


class WebhookVerifier:
    def __init__(self, replay_store: ReplayStore, *, tolerance_seconds: int = 300) -> None:
        if tolerance_seconds < 1:
            raise ValueError("tolerance_seconds must be positive")
        self._replay_store = replay_store
        self._tolerance_seconds = tolerance_seconds

    async def verify_hmac_sha256(
        self,
        *,
        tenant_id: str,
        provider: str,
        event_id: str,
        timestamp: str,
        signature: str,
        secret: str,
        raw_body: bytes,
        now: int | None = None,
    ) -> VerifiedWebhook:
        if not all((tenant_id, provider, event_id, timestamp, signature, secret)):
            raise ValidationError("Webhook authority fields are required")
        try:
            parsed_timestamp = int(timestamp)
        except ValueError as exc:
            raise ValidationError("Webhook timestamp is invalid") from exc
        current = int(time.time()) if now is None else now
        if abs(current - parsed_timestamp) > self._tolerance_seconds:
            raise AuthenticationError("Webhook timestamp is outside the replay window")
        signed = b".".join(
            (timestamp.encode(), tenant_id.encode(), provider.encode(), event_id.encode(), raw_body)
        )
        expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
        supplied = signature.removeprefix("sha256=")
        if not hmac.compare_digest(expected, supplied):
            raise AuthenticationError("Webhook signature is invalid")
        payload_hash = hashlib.sha256(raw_body).hexdigest()
        if not await self._replay_store.claim(tenant_id, provider, event_id, payload_hash):
            raise IdempotencyConflictError("Webhook event was already received")
        return VerifiedWebhook(
            tenant_id=tenant_id,
            provider=provider,
            event_id=event_id,
            payload_hash=payload_hash,
            raw_body=raw_body,
            timestamp=parsed_timestamp,
        )
