# @codestra/apps-shared

Shared plumbing for the three dashboard apps (`ops-dashboard`, `developer-portal`,
`admin-console`): a typed Codestra API client, synthetic fixtures, and
presentational UI primitives.

## Mock vs. real API

`src/client.ts` calls a real `@codestra/social-sdk` `CodestraClient` when
`NEXT_PUBLIC_CODESTRA_API_URL` is set, and otherwise falls back to
`src/mock-client.ts` — an in-memory implementation backed by `src/fixtures/`.
Every app runs fully demoable against the mock client today, since no
Middleware deployment exists yet (see `services/middleware`). Point
`NEXT_PUBLIC_CODESTRA_API_URL` at a real one once it's deployed; no app code
needs to change.

## Import paths — read this before adding a barrel export

`src/ui/index.ts` (exported as `@codestra/apps-shared/ui`) is imported from
both server components and **client** components (e.g.
`WebhookSubscriptionsManager.tsx`). Anything re-exported from it must be
free of `next/headers` / `next/navigation`'s server-only APIs, or Next's
build fails with "You're importing a component that needs next/headers" —
the whole barrel module is resolved into the client bundle even if the
client component only uses one export from it.

`AppShell` and `StubLoginPage` need `next/headers` (via `src/auth/session.ts`
and `src/auth/actions.ts`) and are therefore exported from their own
subpaths instead — `@codestra/apps-shared/ui/AppShell` and
`@codestra/apps-shared/ui/StubLoginPage` — imported only from server
components (`(protected)/layout.tsx` and `login/page.tsx` in each app).

## Auth

`src/auth/` is a stub — a signed-nothing cookie, not real authentication.
See the doc comment at the top of `src/auth/session.ts` for exactly what to
replace it with once a real OIDC provider is deployed.
