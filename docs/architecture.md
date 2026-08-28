# Architecture and ownership

## Request path

```text
Application -> Codestra SDK -> Kong -> Codestra Middleware -> provider adapter -> provider-local restricted gateway
```

## Event path

```text
Provider webhook -> signed Middleware inbox -> replay/schema checks -> canonical event -> transactional outbox -> approved consumers
```

Middleware is the only cross-system write authority. SDKs provide transport, typing, authentication hooks, correlation, idempotency, error normalization, and observability hooks. They do not contain business approval rules.

Provider adapters in this monorepo are server-side libraries. Product-local modules and restricted gateway implementations remain in their respective Postiz, Odoo, Klyrow, Telnexa, and VICIdial repositories.

## Package boundaries

- `@codestra/contracts`: canonical API and event types.
- `@codestra/social-sdk`: public social publishing client.
- `@codestra/webhook-sdk`: producer/consumer signing and replay protection.
- `@codestra/connector-kit`: server connector interfaces and execution controls.
- `@codestra/n8n-nodes`: thin automation actions and triggers.
- `@codestra/provider-adapters`: disabled-by-default server adapters.
- `@codestra/testing`: compatibility fixtures and Pact helpers.
