import { CodestraClient } from "@codestra/social-sdk";
import { getAccessTokenForSession, type StubSession } from "./auth/session.js";
import { getConfiguredApiBaseUrl } from "./env.js";
import { createMockCodestraApiClient, type CodestraApiClient } from "./mock-client.js";

export type { CodestraApiClient } from "./mock-client.js";

/**
 * Returns the one typed API client every page and route handler in all
 * three apps should use.
 *
 * - If `NEXT_PUBLIC_CODESTRA_API_URL` is set, this returns a real
 *   `CodestraClient` (from `@codestra/social-sdk`) pointed at it, sending
 *   the session's tenant ID and a bearer token on every request.
 * - If it is unset (the default today, since no Middleware is deployed),
 *   this returns the in-memory mock client so the app is fully interactive
 *   without a backend.
 *
 * See each app's README for how to point it at a real deployment.
 */
export function getApiClient(session: StubSession): CodestraApiClient {
  const baseUrl = getConfiguredApiBaseUrl();
  if (baseUrl === undefined) return createMockCodestraApiClient();

  return new CodestraClient({
    baseUrl,
    tenantId: session.tenantId,
    getAccessToken: () => getAccessTokenForSession(session),
  });
}

/** A stable idempotency key for one client-side mutation, e.g. a form submit. */
export function generateIdempotencyKey(): string {
  return `ui-${globalThis.crypto.randomUUID()}`;
}
