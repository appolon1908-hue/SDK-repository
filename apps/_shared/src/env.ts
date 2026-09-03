/**
 * All three apps (ops-dashboard, developer-portal, admin-console) read the
 * Codestra Middleware base URL from this single env var. It is intentionally
 * `NEXT_PUBLIC_*` so it can be read from both server and client components.
 *
 * When it is unset (the default for local dev and CI), every app falls back
 * to the in-memory mock API client in `./mock-client.ts` so the UI is fully
 * demoable without a deployed Middleware. Once a real Middleware is
 * reachable, set this to its base URL and the apps switch to real HTTP
 * calls through `@codestra/social-sdk`'s `CodestraClient` automatically.
 */
export const CODESTRA_API_URL_ENV_VAR = "NEXT_PUBLIC_CODESTRA_API_URL";

export function getConfiguredApiBaseUrl(): string | undefined {
  const value = process.env[CODESTRA_API_URL_ENV_VAR];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isMockApiMode(): boolean {
  return getConfiguredApiBaseUrl() === undefined;
}
