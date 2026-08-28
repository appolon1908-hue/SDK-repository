# Codestra Admin Console

Tenant provisioning and user management shell, with clearly-labeled
read-only "configured externally" panels for identity-provider and SMTP
settings.

## What's real vs. mocked

- **Real**: Next.js App Router pages/components, the login-redirect/session
  gate, and the read-only identity/SMTP panels' *shape* (they surface the
  exact categories `docs/PRODUCTION_CONFIGURATION_CHECKLIST.md` calls out as
  owned outside this repo).
- **Mocked, entirely**: tenant and user data. `@codestra/contracts` has no
  `Tenant` or `User` type -- tenant provisioning and user management are not
  part of the current public contract at all, only `tenantId: UUID` fields
  on the resources it does define. `lib/tenant-store.ts` is a small,
  in-memory, mutable store seeded from `@codestra/apps-shared/fixtures`
  (creating a tenant here really appends to the in-memory list, so the flow
  is interactive) -- there is no Middleware tenant-provisioning API to call
  yet. The identity-provider and SMTP panel *values* are synthetic too.
- **By design, not built**: editable forms for identity-provider settings,
  SMTP settings, password reset, or any secret material. Per
  `docs/PRODUCTION_CONFIGURATION_CHECKLIST.md`, those are owned by an
  external identity provider and must never be editable from this repo.
  `test/tenant-detail-page.test.tsx` asserts the tenant detail page contains
  zero `<input>`/`<textarea>`/`<select>`/`<button>` elements at all.
- **Auth**: `/login` is a development stub, not a real identity provider --
  see `apps/_shared/src/auth/session.ts`.

## Pointing this app at a real Middleware / tenant-provisioning API

There is no tenant-provisioning API to point at yet. Once Middleware
publishes one:

1. Add its operations to `contracts/openapi/codestra-public.openapi.yaml` (or
   an internal/admin contract) and regenerate `@codestra/contracts` types.
2. Replace `lib/tenant-store.ts`'s in-memory functions with calls through
   `@codestra/apps-shared`'s `getApiClient` (the same typed-client pattern
   `apps/developer-portal` already uses for webhook subscriptions), pointed
   at `NEXT_PUBLIC_CODESTRA_API_URL`.
3. Replace the auth stub with real OIDC sign-in per
   `docs/PRODUCTION_CONFIGURATION_CHECKLIST.md`.
4. Leave the identity-provider and SMTP panels read-only. If Middleware ever
   exposes a *status* endpoint for them (not a settings-write endpoint),
   swap their fixture calls for that read -- the panels' UI already renders
   any `IdentityProviderConfigSummary`/`SmtpConfigSummary` shape without
   further changes; still never add input/edit controls to them.

## Development

```bash
pnpm --filter @codestra/admin-console dev    # http://localhost:3003
pnpm --filter @codestra/admin-console test
pnpm --filter @codestra/admin-console typecheck
pnpm --filter @codestra/admin-console build
```
