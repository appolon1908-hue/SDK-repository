# @codestra/intake-bff

Server-only adapter for Codestra unified intake.

Canonical request path:

`website / landing page / chat / voice -> @codestra/intake-sdk -> same-origin BFF -> Caddy -> Kong -> Middleware -> durable inbox/outbox -> Odoo`

## Security boundary

This package must run on the server. Never ship `clientSecret` to browser code. The BFF obtains a short-lived Keycloak client-credentials token for `sdk-intake`, requests the narrow `leads.write` scope, and forwards the request through the public Caddy edge at `https://api.codestra.co/v1/intake/leads`.

It preserves `X-Tenant-ID`, `X-Correlation-ID`, and `Idempotency-Key` across retries, validates body/header tenant agreement, supports a server-configured tenant allowlist, bounds request bodies, uses no-store responses, caches service tokens only in server memory, refreshes once on 401, and retries only retry-safe gateway statuses.

## Minimal use

```ts
import { createIntakeBff } from "@codestra/intake-bff";

const intake = createIntakeBff({
  clientSecret: process.env.CODESTRA_SDK_INTAKE_CLIENT_SECRET!,
  allowedTenantIds: ["tenant-id-from-server-config"],
});

export async function handleRequest(request: Request) {
  return intake.handle(request);
}
```

Mount the handler on the website's same-origin route, normally `/api/codestra/intake`. Browser code should use `@codestra/intake-sdk` with its default endpoint and must not possess the Keycloak client secret or a long-lived Middleware credential.

## Defaults

- Keycloak token endpoint: `https://auth.codestra.co/realms/codestra/protocol/openid-connect/token`
- service client: `sdk-intake`
- scope: `leads.write`
- public intake URL: `https://api.codestra.co/v1/intake/leads`
- body limit: 1 MiB
- upstream timeout: 8 seconds
- maximum attempts: 2

No direct BFF -> Middleware private address, BFF -> Odoo, Caddy -> Odoo, or Kong -> Odoo path is supported.
