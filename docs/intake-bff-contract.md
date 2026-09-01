# Unified Intake BFF Contract

## Canonical path

`site -> @codestra/intake-sdk -> same-origin @codestra/intake-bff -> Caddy -> Kong -> Middleware -> durable inbox/outbox -> Odoo`

## Browser boundary

Browser code submits only to its own origin. It never receives `sdk-intake` client credentials, never calls a Middleware private address, and never calls Odoo.

## Server boundary

The BFF obtains a short-lived Keycloak client-credentials token for `sdk-intake` with `leads.write`, then sends to `https://api.codestra.co/v1/intake/leads`. That URL is owned by the Caddy edge; Caddy forwards to Kong; Kong enforces gateway policy before Middleware.

Required forwarded headers:

- `Authorization: Bearer <short-lived service token>`
- `X-Tenant-ID`
- `X-Correlation-ID`
- `Idempotency-Key`
- `Content-Type: application/json`

The BFF must preserve correlation and idempotency values through retry attempts. Tenant identity in the JSON body must equal `X-Tenant-ID`. Deployments should configure an explicit tenant allowlist per website/application.

## Failure behavior

- malformed input fails before token acquisition;
- tenant mismatch is `403`;
- oversized payload is `413`;
- token-provider failures fail closed;
- one token refresh may occur after `401`;
- retries are limited to retry-safe gateway responses and preserve request identity;
- responses are `Cache-Control: no-store`.

## Prohibited routes

- browser -> Caddy using embedded `sdk-intake` secret
- browser -> Kong with service credentials
- BFF -> Middleware private address
- BFF -> Odoo
- Caddy -> Middleware bypassing Kong for intake
- Kong -> Odoo

Runtime activation is outside this contract and requires the companion Caddy, Kong, Keycloak, Middleware, and Odoo authorities to pass their release gates.
