from __future__ import annotations

import hashlib
import hmac

import pytest

from codestra_moneybee_connectors import AuthenticationError, IdempotencyConflictError
from codestra_moneybee_connectors import InMemoryReplayStore, WebhookVerifier


def signature(secret: str, timestamp: str, body: bytes) -> str:
    return hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_verifies_raw_body_and_blocks_replay() -> None:
    verifier = WebhookVerifier(InMemoryReplayStore())
    body = b'{"event":"completed"}'
    kwargs = {
        "tenant_id": "tenant-1", "provider": "docusign", "event_id": "event-1",
        "timestamp": "1000", "signature": signature("secret", "1000", body),
        "secret": "secret", "raw_body": body, "now": 1000,
    }
    verified = await verifier.verify_hmac_sha256(**kwargs)
    assert verified.payload_hash == hashlib.sha256(body).hexdigest()
    with pytest.raises(IdempotencyConflictError):
        await verifier.verify_hmac_sha256(**kwargs)


@pytest.mark.asyncio
async def test_rejects_modified_body_and_stale_timestamp() -> None:
    verifier = WebhookVerifier(InMemoryReplayStore(), tolerance_seconds=30)
    with pytest.raises(AuthenticationError):
        await verifier.verify_hmac_sha256(
            tenant_id="tenant-1", provider="stripe", event_id="event-1",
            timestamp="1000", signature=signature("secret", "1000", b"original"),
            secret="secret", raw_body=b"modified", now=1000,
        )
    with pytest.raises(AuthenticationError):
        await verifier.verify_hmac_sha256(
            tenant_id="tenant-1", provider="stripe", event_id="event-2",
            timestamp="1000", signature=signature("secret", "1000", b"body"),
            secret="secret", raw_body=b"body", now=1031,
        )
