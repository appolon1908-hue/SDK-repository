from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass
from typing import Protocol

from .errors import AuthenticationError, IdempotencyConflictError, ValidationError


class ReplayStore(Protocol):
    async def claim(self, tenant_id: str, provider: str, endpoint_id: str, event_id: str, payload_hash: str) -> bool: ...


class InMemoryReplayStore:
    """Test-only replay store. Production callers must inject durable storage."""

    def __init__(self) -> None:
        self._claims: dict[tuple[str, str, str, str], str] = {}

    async def claim(self, tenant_id: str, provider: str, endpoint_id: str, event_id: str, payload_hash: str) -> bool:
        # Scope is tenant + provider + endpoint + event ID, matching the
        # scope this repo's TypeScript webhook-sdk already uses
        # (buildWebhookProcessingScope: tenantId:endpointId:signerType:
        # eventId) and docs/API_AUDIT_REPORT.md's API-011 correction --
        # event IDs are only unique *within* one tenant's endpoint, not
        # across every endpoint a tenant might register for a provider.
        # An endpoint's own signing secret already disambiguates which
        # signer produced a given claim, so unlike webhook-sdk's
        # current/previous secret-rotation dimension, this client doesn't
        # need a separate signer/version field until it supports secret
        # rotation itself.
        #
        # payload_hash is intentionally excluded from the key -- an event
        # ID is only ever supposed to name one payload, so keying on the
        # hash too let a second, differently-hashed body under the *same*
        # event ID slip through as an unrelated new claim instead of being
        # rejected, whether that's a payload-conflict bug upstream or a
        # forged retry.
        key = (tenant_id, provider, endpoint_id, event_id)
        if key in self._claims:
            return False
        self._claims[key] = payload_hash
        return True


@dataclass(frozen=True)
class VerifiedWebhook:
    tenant_id: str
    provider: str
    endpoint_id: str
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
        endpoint_id: str,
        event_id: str,
        timestamp: str,
        signature: str,
        secret: str,
        raw_body: bytes,
        now: int | None = None,
    ) -> VerifiedWebhook:
        if not all((tenant_id, provider, endpoint_id, event_id, timestamp, signature, secret)):
            raise ValidationError("Webhook authority fields are required")
        try:
            parsed_timestamp = int(timestamp)
        except ValueError as exc:
            raise ValidationError("Webhook timestamp is invalid") from exc
        current = int(time.time()) if now is None else now
        if abs(current - parsed_timestamp) > self._tolerance_seconds:
            raise AuthenticationError("Webhook timestamp is outside the replay window")
        signed = timestamp.encode() + b"." + raw_body
        expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
        supplied = signature.removeprefix("sha256=")
        if not hmac.compare_digest(expected, supplied):
            raise AuthenticationError("Webhook signature is invalid")
        payload_hash = hashlib.sha256(raw_body).hexdigest()
        if not await self._replay_store.claim(tenant_id, provider, endpoint_id, event_id, payload_hash):
            raise IdempotencyConflictError("Webhook event was already received")
        return VerifiedWebhook(
            tenant_id=tenant_id,
            provider=provider,
            endpoint_id=endpoint_id,
            event_id=event_id,
            payload_hash=payload_hash,
            raw_body=raw_body,
            timestamp=parsed_timestamp,
        )
