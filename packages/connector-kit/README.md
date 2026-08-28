# `@codestra/connector-kit`

Server-side connector interfaces plus a fail-closed runner that enforces operation allowlists, tenant-scoped idempotency, capability flags, timeout budgets, circuit breaking, and normalized errors.

The bundled in-memory idempotency store is for unit tests and local development only. Production Middleware must implement `ConnectorIdempotencyStore` using durable storage with atomic reservation and completion semantics.

Provider credentials are injected at runtime by Middleware. They must never be returned in health details, errors, logs, events, or command results.
