# Codestra Ops Dashboard

Internal operations tool: connector-command health broken down by the real
`packages/connector-kit` state machine, a webhook-delivery status feed, and a
cross-tenant activity list.

## What's real vs. mocked

- **Real**: Next.js App Router pages/components, the TypeScript domain types
  (imported straight from `@codestra/contracts` and `@codestra/connector-kit`),
  the webhook-subscription list this app reads (via `@codestra/social-sdk`'s
  `CodestraClient`, shared through `@codestra/apps-shared`), and the login
  redirect/session-gate flow.
- **Mocked**: all page *data*. Connector health, connector-command records,
  and the webhook-delivery feed have no corresponding public API operation
  yet (see `contracts/openapi/codestra-public.openapi.yaml`), so
  `@codestra/apps-shared/fixtures` provides synthetic, contract-shaped data
  for them unconditionally. The webhook-subscription list *would* be real
  once a Middleware is deployed (see below) -- until then it also comes from
  the in-memory mock API client.
- **Auth**: `/login` is a development stub (see
  `apps/_shared/src/auth/session.ts`) that sets a plain, unsigned cookie --
  it is not connected to any identity provider. `app/(protected)/layout.tsx`
  is the gate every protected route sits behind.

## Pointing this app at a real Middleware

1. Deploy Middleware and note its public base URL.
2. Set `NEXT_PUBLIC_CODESTRA_API_URL=https://your-middleware-host` in this
   app's environment (`.env.local` for dev, or your deploy platform's env
   config).
3. Replace the auth stub: implement real OIDC sign-in (see
   `docs/PRODUCTION_CONFIGURATION_CHECKLIST.md` for the identity-provider
   contract) and swap `getStubSession`/`createStubSession` in
   `apps/_shared/src/auth/session.ts` and `actions.ts` for your provider's
   session lookup and login redirect. `getApiClient` in
   `apps/_shared/src/client.ts` already switches to the real
   `CodestraClient` whenever the env var above is set -- once real
   `getAccessToken` wiring lands, nothing else in this app needs to change.
4. Connector-command health and the webhook-delivery feed will keep reading
   `@codestra/apps-shared/fixtures` until Middleware exposes a telemetry API
   for them; swap those imports for real API calls once that API exists.

## Development

```bash
pnpm --filter @codestra/ops-dashboard dev    # http://localhost:3001
pnpm --filter @codestra/ops-dashboard test
pnpm --filter @codestra/ops-dashboard typecheck
pnpm --filter @codestra/ops-dashboard build
```
