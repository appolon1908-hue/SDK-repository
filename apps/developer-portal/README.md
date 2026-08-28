# Codestra Developer Portal

Customer-facing portal: a live API reference and event catalogue generated
from the canonical contracts, webhook-subscription management, and the
signed-in tenant's own API credentials.

## What's real vs. mocked

- **Real**: the API reference (`/docs/api-reference`) is Redocly's
  `build-docs` output rendered from the actual
  `contracts/openapi/codestra-public.openapi.yaml`, regenerated before every
  `dev`/`build`. The event catalogue (`/docs/events`) parses the actual
  `contracts/asyncapi/codestra-events.asyncapi.yaml` (and its referenced JSON
  Schema) at request time -- both pages always match the checked-in contract
  files, not a snapshot. Webhook-subscription create/list/rotate-secret/
  enable/disable/delete calls the real, typed `CodestraClient` from
  `@codestra/social-sdk` through this app's `/api/webhook-subscriptions*`
  route handlers.
- **Mocked**: because no Middleware is deployed yet
  (`NEXT_PUBLIC_CODESTRA_API_URL` unset), those webhook calls run against
  `@codestra/apps-shared`'s in-memory mock API client instead of a live
  server -- the request/response shapes are the real contract, the backend
  behind them is not. The "API credentials" page is entirely mocked: there
  is no public API operation to read back a tenant's token yet, but the page
  is scoped to the signed-in tenant only, the way the real one must be.
- **Auth**: `/login` is a development stub, not a real identity provider --
  see `apps/_shared/src/auth/session.ts`. Docs pages are public; webhooks
  and credentials sit behind `app/(protected)/layout.tsx`.

## Pointing this app at a real Middleware

1. Deploy Middleware and note its public base URL.
2. Set `NEXT_PUBLIC_CODESTRA_API_URL=https://your-middleware-host` in this
   app's environment.
3. Replace the auth stub with real OIDC sign-in per
   `docs/PRODUCTION_CONFIGURATION_CHECKLIST.md`, and wire real
   `getAccessToken` into `apps/_shared/src/client.ts#getApiClient`. Once
   that's done, `/api/webhook-subscriptions*` and the credentials page need
   no further changes -- they already call the shared client, which switches
   to real HTTP automatically once the env var above is set.
4. The API reference and event catalogue pages need no changes either way:
   they always read the contract files directly, independent of Middleware.

## Development

```bash
pnpm --filter @codestra/developer-portal dev    # http://localhost:3002
pnpm --filter @codestra/developer-portal test
pnpm --filter @codestra/developer-portal typecheck
pnpm --filter @codestra/developer-portal build
```
