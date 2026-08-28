# @codestra/middleware

The Codestra Middleware service — the sole cross-system write authority in the
architecture described in `docs/CONTRACT_BOUNDARY_MATRIX.md`. Every SDK, n8n
node, and provider adapter in this repository is a client of this service;
nothing else is allowed to mutate provider state directly.

This is the first real, runnable implementation of that service. Before this
package existed, the repository only had client-side code — SDKs and
contracts with nothing behind them.

## What's implemented

Fastify + TypeScript + Prisma/PostgreSQL, covering the public and enterprise
OpenAPI contracts:

- `GET /health/ready`
- `POST /v1/social/posts`, `GET /v1/social/posts/{postId}`, `GET /v1/social/posts`, `POST /v1/social/posts/{postId}/cancel`
- `POST /v1/webhook-subscriptions` and its full lifecycle (list, read, rotate-secret, test, enable, disable, delete)
- `POST /v1/connectors/{connectorKey}/commands` and `/reconciliation`

Backed by a durable idempotency store (see `prisma/schema.prisma`,
`src/idempotency/`) implementing the same state machine
`packages/connector-kit` specifies client-side — pending, dispatched,
succeeded, failed, indeterminate — with a request-hash column for conflict
detection and a lease token + expiry for concurrent-request safety, all in
real Postgres transactions rather than an in-memory mutex.

Every route is authenticated by verifying a JWT against a configurable JWKS
URL (`src/auth/`) and every database query is scoped by the tenant ID pulled
from that verified token — never from a request body or URL parameter.
Webhook destinations are rejected unless HTTPS, non-private, non-loopback,
and non-redirecting (`src/webhooks/ssrf.ts`).

## What's a stub, on purpose

**There is no real identity provider deployed with this repository.**
`OIDC_ISSUER` / `OIDC_JWKS_URL` / `OIDC_AUDIENCE` in `.env.example` are the
seam where a real OIDC provider (Keycloak or similar) plugs in. Until one is
configured, every request is rejected — this service never accepts an
unverified token, it does not fall back to trusting the caller.

Similarly, `RESTRICTED_GATEWAY_BASE_URL` points at a product-local gateway
(Postiz, Odoo, Klyrow, Telnexa, VICIdial) that doesn't exist in this
repository — see `contracts/openapi/codestra-restricted-gateway.openapi.yaml`
for the contract the real gateway must implement.

## Running it locally

```bash
cp .env.example .env    # then fill in a real OIDC issuer once one exists
docker compose up -d postgres
pnpm --filter @codestra/middleware prisma:migrate:dev
pnpm --filter @codestra/middleware dev
```

## Running the tests

The integration tests run against a **real** Postgres instance — nothing is
mocked at the database layer, because the entire point of this service is
durable idempotency, and an in-memory fake can't prove that. Point
`DATABASE_URL` at any disposable Postgres (the `docker-compose.yml` in this
directory, or GitHub Actions' Postgres service container, which
`.github/workflows/middleware.yml` uses):

```bash
docker compose up -d postgres
DATABASE_URL=postgresql://codestra:codestra@localhost:5433/codestra_middleware \
  pnpm --filter @codestra/middleware test
```

JWT verification is tested against a real local JWKS HTTP server the test
suite starts itself (`test/support/jwks-server.ts`) — the `jose`
remote-JWKS verification path runs for real in tests, it is not mocked out.

Test files: `test/social-posts.test.ts`, `test/webhook-subscriptions.test.ts`,
`test/connectors.test.ts`, `test/idempotency-store.test.ts`,
`test/auth.test.ts`, `test/ssrf.test.ts`, `test/tenant-isolation.test.ts`.
