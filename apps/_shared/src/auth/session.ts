import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * ---------------------------------------------------------------------------
 * DEVELOPMENT AUTH STUB -- NOT REAL AUTHENTICATION.
 * ---------------------------------------------------------------------------
 * The Codestra public OpenAPI (`contracts/openapi/codestra-public.openapi.yaml`)
 * declares `security: [{ oidc: [] }]`: every real deployment sits behind an
 * OIDC identity provider (Keycloak or equivalent). No such provider is
 * deployed for this repository yet, and `docs/PRODUCTION_CONFIGURATION_CHECKLIST.md`
 * is explicit that sign-in, password reset, and credential handling are
 * owned outside this repo.
 *
 * This module stands in for that seam with a plain signed-nothing cookie so
 * the three apps have a real, working "logged out -> redirected to /login ->
 * logged in" flow to demo today. Swap it out by:
 *   1. Replacing `getStubSession` with a call into your OIDC middleware/SDK
 *      (e.g. NextAuth, next-auth-keycloak, or a custom OIDC PKCE flow) that
 *      returns the verified subject, tenant claim, and access token.
 *   2. Replacing `createStubSession` (the /login form action) with the real
 *      OIDC authorization-code redirect.
 *   3. Replacing `getAccessTokenForSession` so it returns the real bearer
 *      token instead of a synthetic placeholder -- the token is what
 *      `@codestra/social-sdk`'s `CodestraClient` sends as `Authorization`.
 * Every app's README repeats this note next to its login page.
 */

export const STUB_SESSION_COOKIE = "codestra_stub_session";

export interface StubSession {
  subject: string;
  tenantId: string;
}

const SYNTHETIC_TENANT_ID = "042880db-aa51-4f16-83b5-ae858ee45ad6";

export function defaultStubTenantId(): string {
  return SYNTHETIC_TENANT_ID;
}

export async function getStubSession(): Promise<StubSession | null> {
  const store = await cookies();
  const raw = store.get(STUB_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).subject === "string" &&
      typeof (parsed as Record<string, unknown>).tenantId === "string"
    ) {
      return parsed as StubSession;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Server-only guard used at the top of every protected layout/page: reads
 * the stub session and redirects to `/login` when it is missing. Swap for a
 * real OIDC session check per the note above the `StubSession` type.
 */
export async function requireStubSession(): Promise<StubSession> {
  const session = await getStubSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Stands in for `getAccessToken` on `CodestraClientOptions`. Returns a
 * clearly-fake token -- it is never sent anywhere real because the mock API
 * client is used whenever `NEXT_PUBLIC_CODESTRA_API_URL` is unset, and this
 * repository never talks to a live Middleware in CI or local dev.
 */
export function getAccessTokenForSession(session: StubSession): string {
  return `dev-stub-token.${session.subject}.not-a-real-credential`;
}
