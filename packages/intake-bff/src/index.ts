export interface IntakeBffConfig {
  clientId?: string;
  clientSecret: string;
  tokenUrl?: string;
  intakeUrl?: string;
  scope?: string;
  allowedTenantIds?: readonly string[];
  maxBodyBytes?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface IntakeBffHandler {
  handle(request: Request): Promise<Response>;
  clearTokenCache(): void;
}

type TokenCache = { accessToken: string; expiresAtMs: number } | undefined;

type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
};

const DEFAULT_TOKEN_URL = "https://auth.codestra.co/realms/codestra/protocol/openid-connect/token";
const DEFAULT_INTAKE_URL = "https://api.codestra.co/v1/intake/leads";
const DEFAULT_CLIENT_ID = "sdk-intake";
const DEFAULT_SCOPE = "leads.write";
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const TOKEN_EXPIRY_SKEW_MS = 20_000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export function createIntakeBff(config: IntakeBffConfig): IntakeBffHandler {
  if (!config.clientSecret) throw new Error("clientSecret is required");

  const clientId = config.clientId ?? DEFAULT_CLIENT_ID;
  const tokenUrl = config.tokenUrl ?? DEFAULT_TOKEN_URL;
  const intakeUrl = config.intakeUrl ?? DEFAULT_INTAKE_URL;
  const scope = config.scope ?? DEFAULT_SCOPE;
  const maxBodyBytes = config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const fetchImpl = config.fetchImpl ?? fetch;
  const now = config.now ?? Date.now;
  const allowedTenantIds = config.allowedTenantIds ? new Set(config.allowedTenantIds) : undefined;
  let tokenCache: TokenCache;

  async function getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && tokenCache && tokenCache.expiresAtMs - TOKEN_EXPIRY_SKEW_MS > now()) {
      return tokenCache.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: config.clientSecret,
      scope,
    });

    const response = await fetchWithTimeout(fetchImpl, tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }, timeoutMs);

    if (!response.ok) {
      throw new BffUpstreamError("identity_provider_error", response.status);
    }

    const payload = (await response.json()) as TokenResponse;
    if (typeof payload.access_token !== "string" || payload.access_token.length < 10) {
      throw new BffUpstreamError("identity_provider_invalid_response", 502);
    }

    const expiresInSeconds = typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 60;
    tokenCache = {
      accessToken: payload.access_token,
      expiresAtMs: now() + expiresInSeconds * 1000,
    };
    return tokenCache.accessToken;
  }

  async function forward(
    bodyText: string,
    tenantId: string,
    correlationId: string,
    idempotencyKey: string,
  ): Promise<Response> {
    let accessToken = await getAccessToken();
    let lastResponse: Response | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetchWithTimeout(fetchImpl, intakeUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Tenant-ID": tenantId,
          "X-Correlation-ID": correlationId,
          "Idempotency-Key": idempotencyKey,
        },
        body: bodyText,
      }, timeoutMs);

      lastResponse = response;

      if (response.status === 401 && attempt < maxAttempts) {
        accessToken = await getAccessToken(true);
        continue;
      }
      if (!RETRYABLE_STATUSES.has(response.status) || attempt >= maxAttempts) {
        return response;
      }
    }

    return lastResponse ?? new Response(JSON.stringify({ error: "upstream_unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return {
    async handle(request: Request): Promise<Response> {
      try {
        if (request.method !== "POST") {
          return jsonResponse(405, { error: "method_not_allowed" }, { Allow: "POST" });
        }

        const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
        if (!contentType.startsWith("application/json")) {
          return jsonResponse(415, { error: "unsupported_media_type" });
        }

        const tenantId = requiredHeader(request, "X-Tenant-ID");
        const correlationId = requiredHeader(request, "X-Correlation-ID");
        const idempotencyKey = requiredHeader(request, "Idempotency-Key");
        if (!tenantId || !correlationId || !idempotencyKey) {
          return jsonResponse(400, { error: "missing_required_headers" });
        }
        if (allowedTenantIds && !allowedTenantIds.has(tenantId)) {
          return jsonResponse(403, { error: "tenant_not_allowed" });
        }

        const declaredLength = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
          return jsonResponse(413, { error: "payload_too_large" });
        }

        const bodyBytes = new Uint8Array(await request.arrayBuffer());
        if (bodyBytes.byteLength === 0) return jsonResponse(400, { error: "empty_body" });
        if (bodyBytes.byteLength > maxBodyBytes) return jsonResponse(413, { error: "payload_too_large" });
        const bodyText = new TextDecoder().decode(bodyBytes);

        let parsed: unknown;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          return jsonResponse(400, { error: "invalid_json" });
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return jsonResponse(400, { error: "invalid_payload" });
        }
        const bodyTenant = (parsed as Record<string, unknown>).tenantId;
        if (typeof bodyTenant !== "string" || bodyTenant !== tenantId) {
          return jsonResponse(403, { error: "tenant_mismatch" });
        }

        const upstream = await forward(bodyText, tenantId, correlationId, idempotencyKey);
        const responseBody = await upstream.arrayBuffer();
        const headers = new Headers();
        headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/json");
        headers.set("Cache-Control", "no-store");
        headers.set("X-Correlation-ID", correlationId);
        return new Response(responseBody, { status: upstream.status, headers });
      } catch (error) {
        if (error instanceof BffUpstreamError) {
          return jsonResponse(error.status >= 500 ? 502 : error.status, { error: error.code });
        }
        if (isAbortError(error)) {
          return jsonResponse(504, { error: "upstream_timeout" });
        }
        return jsonResponse(502, { error: "upstream_unavailable" });
      }
    },
    clearTokenCache() {
      tokenCache = undefined;
    },
  };
}

export function createFetchHandler(config: IntakeBffConfig): (request: Request) => Promise<Response> {
  const bff = createIntakeBff(config);
  return (request: Request) => bff.handle(request);
}

class BffUpstreamError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

function requiredHeader(request: Request, name: string): string | undefined {
  const value = request.headers.get(name)?.trim();
  return value ? value : undefined;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function jsonResponse(status: number, body: Record<string, unknown>, headersInit?: HeadersInit): Response {
  const headers = new Headers(headersInit);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
