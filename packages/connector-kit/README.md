# `@codestra/connector-kit`

Server-side connector interfaces plus a fail-closed runner that enforces operation allowlists, capability flags, timeout budgets, circuit breaking, and durable idempotency semantics.

## Idempotency state machine

Mutating operations use a tenant-, connector-, operation-, actor-, and request-scoped SHA-256 fingerprint. A production store must implement atomic compare-and-transition behavior for:

```text
acquired -> dispatched -> completed
                       -> indeterminate -> completed after reconciliation
```

The runner releases a lease only before dispatch, when the provider was definitely not called. Once a command is marked `dispatched`, timeouts, network resets, invalid provider responses, aborts, and result-persistence failures remain `indeterminate`. A duplicate request receives `IDEMPOTENCY_OUTCOME_INDETERMINATE` and must reconcile instead of blindly issuing the mutation again.

The same idempotency key with a different command fingerprint fails with `IDEMPOTENCY_REQUEST_MISMATCH`. Dispatched and indeterminate records never expire into a new mutation automatically; they require explicit reconciliation through `ConnectorRunner.reconcileIndeterminate()` and a connector-specific `reconcileCommand()` implementation.

The bundled `InMemoryConnectorIdempotencyStore` is for unit tests and local development only. Production Middleware must use durable shared storage and make `begin`, `markDispatched`, `complete`, `markIndeterminate`, `releaseBeforeDispatch`, and `resolveIndeterminate` atomic with lease-token and request-hash checks.

Provider credentials are injected at runtime by Middleware. They must never be returned in health details, errors, logs, events, command fingerprints, or command results.
