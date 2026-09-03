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
        "tenant_id": "tenant-1", "provider": "docusign", "endpoint_id": "endpoint-1", "event_id": "event-1",
        "timestamp": "1000", "signature": signature("secret", "1000", body),
        "secret": "secret", "raw_body": body, "now": 1000,
    }
    verified = await verifier.verify_hmac_sha256(**kwargs)
    assert verified.payload_hash == hashlib.sha256(body).hexdigest()
    with pytest.raises(IdempotencyConflictError):
        await verifier.verify_hmac_sha256(**kwargs)


@pytest.mark.asyncio
async def test_blocks_replay_even_when_the_second_body_differs() -> None:
    # Codex review finding: keying the replay claim on (tenant, provider,
    # event_id, payload_hash) let a second, differently-hashed but validly
    # signed body under the *same* event ID through as an unrelated new
    # claim. Event ID identity must dominate -- a payload change under the
    # same event ID is a conflict to reject, not a new event to accept.
    verifier = WebhookVerifier(InMemoryReplayStore())
    first_body = b'{"event":"completed"}'
    await verifier.verify_hmac_sha256(
        tenant_id="tenant-1", provider="docusign", endpoint_id="endpoint-1", event_id="event-1",
        timestamp="1000", signature=signature("secret", "1000", first_body),
        secret="secret", raw_body=first_body, now=1000,
    )
    second_body = b'{"event":"completed","amount":999}'
    with pytest.raises(IdempotencyConflictError):
        await verifier.verify_hmac_sha256(
            tenant_id="tenant-1", provider="docusign", endpoint_id="endpoint-1", event_id="event-1",
            timestamp="1000", signature=signature("secret", "1000", second_body),
            secret="secret", raw_body=second_body, now=1000,
        )


@pytest.mark.asyncio
async def test_does_not_collapse_claims_across_different_endpoints() -> None:
    # Codex review finding on the fix above: scoping the claim on (tenant,
    # provider, event_id) alone collapses claims across every endpoint a
    # tenant registers for the same provider, even though event IDs are
    # only guaranteed unique within one endpoint (docs/API_AUDIT_REPORT.md
    # API-011). The same event_id on two different endpoints must be
    # accepted independently.
    verifier = WebhookVerifier(InMemoryReplayStore())
    body = b'{"event":"completed"}'
    await verifier.verify_hmac_sha256(
        tenant_id="tenant-1", provider="docusign", endpoint_id="endpoint-1", event_id="event-1",
        timestamp="1000", signature=signature("secret", "1000", body),
        secret="secret", raw_body=body, now=1000,
    )
    verified = await verifier.verify_hmac_sha256(
        tenant_id="tenant-1", provider="docusign", endpoint_id="endpoint-2", event_id="event-1",
        timestamp="1000", signature=signature("secret", "1000", body),
        secret="secret", raw_body=body, now=1000,
    )
    assert verified.endpoint_id == "endpoint-2"


@pytest.mark.asyncio
async def test_rejects_modified_body_and_stale_timestamp() -> None:
    verifier = WebhookVerifier(InMemoryReplayStore(), tolerance_seconds=30)
    with pytest.raises(AuthenticationError):
        await verifier.verify_hmac_sha256(
            tenant_id="tenant-1", provider="stripe", endpoint_id="endpoint-1", event_id="event-1",
            timestamp="1000", signature=signature("secret", "1000", b"original"),
            secret="secret", raw_body=b"modified", now=1000,
        )
    with pytest.raises(AuthenticationError):
        await verifier.verify_hmac_sha256(
            tenant_id="tenant-1", provider="stripe", endpoint_id="endpoint-1", event_id="event-2",
            timestamp="1000", signature=signature("secret", "1000", b"body"),
            secret="secret", raw_body=b"body", now=1031,
        )
