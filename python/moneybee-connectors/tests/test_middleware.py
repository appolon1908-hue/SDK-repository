from __future__ import annotations

import httpx
import pytest

from codestra_moneybee_connectors import AdapterRequestContext, CapabilityDisabledError
from codestra_moneybee_connectors import CodestraMiddlewareClient, MiddlewareClientConfig
from codestra_moneybee_connectors import UnknownOutcomeError


def context() -> AdapterRequestContext:
    return AdapterRequestContext(
        tenant_id="tenant-1", principal="moneybee-worker", request_id="request-1",
        correlation_id="correlation-1", operation_id="00000000-0000-4000-8000-000000000001",
        idempotency_key="idem-0001", provider="codestra", release_id="release-sha",
    )


def operation() -> dict[str, object]:
    ctx = context()
    return {
        "command_id": ctx.operation_id, "tenant_id": ctx.tenant_id,
        "command_type": "crm.project", "command_version": "1.0", "target": "odoo",
        "requested_by": ctx.principal, "correlation_id": ctx.correlation_id,
        "idempotency_key": ctx.idempotency_key, "capability": "ODOO_WRITE",
        "state": "accepted", "provider_operation_id": None, "last_error": None,
        "created_at": "2026-09-02T00:00:00Z", "updated_at": "2026-09-02T00:00:00Z",
        "duplicate": False,
    }


@pytest.mark.asyncio
async def test_disabled_by_default() -> None:
    client = CodestraMiddlewareClient(
        MiddlewareClientConfig(base_url="https://middleware.example"), lambda: "token"
    )
    with pytest.raises(CapabilityDisabledError):
        await client.get_operation(context())
    await client.aclose()


@pytest.mark.asyncio
async def test_command_sends_authority_context_once() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(202, json=operation())

    client = CodestraMiddlewareClient(
        MiddlewareClientConfig(base_url="https://middleware.example", enabled=True,
                               allowed_capabilities=frozenset({"ODOO_WRITE"})),
        lambda: "service-token", transport=httpx.MockTransport(handler),
    )
    result = await client.submit_command(
        context(), command_type="crm.project", target="odoo",
        capability="ODOO_WRITE", payload={"id": "1"},
    )
    assert result.state == "accepted"
    assert len(requests) == 1
    assert requests[0].headers["Idempotency-Key"] == "idem-0001"
    assert requests[0].headers["X-Tenant-ID"] == "tenant-1"
    assert requests[0].headers["Authorization"] == "Bearer service-token"
    await client.aclose()


@pytest.mark.asyncio
async def test_mutation_timeout_is_unknown_and_not_retried() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise httpx.ReadTimeout("ambiguous", request=request)

    client = CodestraMiddlewareClient(
        MiddlewareClientConfig(base_url="https://middleware.example", enabled=True,
                               allowed_capabilities=frozenset({"ODOO_WRITE"})),
        lambda: "service-token", transport=httpx.MockTransport(handler),
    )
    with pytest.raises(UnknownOutcomeError):
        await client.submit_command(
            context(), command_type="crm.project", target="odoo",
            capability="ODOO_WRITE", payload={},
        )
    assert calls == 1
    await client.aclose()


@pytest.mark.asyncio
async def test_reads_retry_and_preserve_tenant() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls < 3:
            return httpx.Response(503, json={"error": {}})
        assert request.headers["X-Tenant-ID"] == "tenant-1"
        assert "Idempotency-Key" not in request.headers
        return httpx.Response(200, json=operation())

    client = CodestraMiddlewareClient(
        MiddlewareClientConfig(base_url="https://middleware.example", enabled=True),
        lambda: "service-token", transport=httpx.MockTransport(handler),
    )
    assert (await client.get_operation(context())).state == "accepted"
    assert calls == 3
    await client.aclose()
