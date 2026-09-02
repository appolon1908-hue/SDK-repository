# Codestra MoneyBee Connectors

Server-only Python safety contracts for MoneyBee provider integrations.

- External capabilities are disabled by default.
- Middleware mutations use only the verified `POST /v1/commands` contract.
- Ambiguous mutation outcomes are never retried blindly; callers reconcile through `GET /v1/operations/{command_id}`.
- Consequential calls carry tenant, principal, request, correlation, operation, idempotency, provider, and release context.
- Webhook HMAC verification operates on the exact raw body and requires an injected durable replay store in production.

This package contains no credentials and is not intended for browser bundles.
