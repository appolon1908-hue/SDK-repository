import { parseInternalWebhookConfig } from "./internal-event-config.js";
import type { AcceptSignedInternalEventInput, AcceptedInternalEvent, CodestraInternalWebhookConfig, ReplayClaimReceipt } from "./internal-event-model.js";
import { InternalEventBoundaryError } from "./internal-event-model.js";
import { parseAndValidateCanonicalEvent } from "./internal-event-schema.js";
import { singleHeader } from "./internal-event-primitives.js";
import { verifyWebhook, WebhookVerificationError } from "./standard-webhooks.js";

export { InternalEventBoundaryError } from "./internal-event-model.js";

export async function acceptSignedInternalEvent(input: AcceptSignedInternalEventInput): Promise<AcceptedInternalEvent> {
  const config = parseInternalWebhookConfig(input.credentials);
  const rawBody = normalizeBody(input.rawBody, config.maxBodyBytes);
  const headers = lowerHeaders(input.headers);
  const tenantId = singleHeader(headers, "x-codestra-tenant-id").toLowerCase();
  if (tenantId !== config.expectedTenantId) {
    throw new InternalEventBoundaryError("The authenticated tenant is not allowed for this trigger.", "TENANT_NOT_ALLOWED", { status: 403 });
  }

  let verified;
  try {
    const verifyInput = {
      id: singleHeader(headers, "webhook-id"),
      timestamp: singleHeader(headers, "webhook-timestamp"),
      signature: singleHeader(headers, "webhook-signature"),
      payload: rawBody,
      secrets: config.webhookSecrets,
      toleranceSeconds: config.timestampToleranceSeconds,
      ...(input.now === undefined ? {} : { now: input.now }),
    };
    verified = await verifyWebhook(verifyInput);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      throw new InternalEventBoundaryError(error.message, error.code, { status: 401, cause: error });
    }
    throw error;
  }

  const event = parseAndValidateCanonicalEvent(rawBody, config, tenantId);
  if (event.id !== verified.id) {
    throw new InternalEventBoundaryError("The signed webhook ID must match the CloudEvent ID.", "EVENT_ID_MISMATCH", { status: 422 });
  }
  const bodySha256 = await sha256Hex(rawBody);
  const claimInput = {
    eventId: event.id,
    tenantId,
    eventType: event.type,
    source: event.source,
    bodySha256,
    signatureTimestamp: verified.timestamp,
    matchedSecretIndex: verified.matchedSecretIndex,
    correlationId: headerOrDefault(headers, "x-correlation-id", event.id),
    ...(input.fetch === undefined ? {} : { fetchImpl: input.fetch }),
  };
  const claim = await claimReplayGuard(config, claimInput);

  return {
    event,
    delivery: {
      deliveryId: claim.deliveryId,
      claimId: claim.claimId,
      tenantId,
      correlationId: headerOrDefault(headers, "x-correlation-id", event.id),
      bodySha256,
      signatureTimestamp: verified.timestamp,
      claimedAt: claim.claimedAt,
      expiresAt: claim.expiresAt,
    },
  };
}

async function claimReplayGuard(
  config: CodestraInternalWebhookConfig,
  input: {
    eventId: string;
    tenantId: string;
    eventType: string;
    source: string;
    bodySha256: string;
    signatureTimestamp: number;
    matchedSecretIndex: number;
    correlationId: string;
    fetchImpl?: typeof globalThis.fetch;
  },
): Promise<ReplayClaimReceipt> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new InternalEventBoundaryError("A fetch implementation is required for replay guard claims.", "FETCH_UNAVAILABLE", { status: 500 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const url = new URL("n8n/event-claims", config.replayGuardBaseUrl);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.replayGuardAccessToken}`,
        "content-type": "application/json",
        "x-codestra-tenant-id": input.tenantId,
        "x-correlation-id": input.correlationId,
      },
      body: JSON.stringify({
        eventId: input.eventId,
        tenantId: input.tenantId,
        eventType: input.eventType,
        source: input.source,
        bodySha256: input.bodySha256,
        signatureTimestamp: input.signatureTimestamp,
        matchedSecretIndex: input.matchedSecretIndex,
      }),
      signal: controller.signal,
    });
    if (response.status === 409) {
      throw new InternalEventBoundaryError("The signed internal event was already claimed.", "REPLAY_DETECTED", { status: 409 });
    }
    if (!response.ok) {
      throw new InternalEventBoundaryError("Replay guard rejected the internal event claim.", "REPLAY_GUARD_REJECTED", { status: response.status, retryable: response.status >= 500 });
    }
    return validateClaimReceipt(await response.json());
  } catch (error) {
    if (error instanceof InternalEventBoundaryError) throw error;
    throw new InternalEventBoundaryError("Replay guard claim failed before workflow dispatch.", "REPLAY_GUARD_UNAVAILABLE", { status: 503, retryable: true, cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

function validateClaimReceipt(value: unknown): ReplayClaimReceipt {
  if (typeof value !== "object" || value === null) {
    throw new InternalEventBoundaryError("Replay guard claim response must be an object.", "INVALID_REPLAY_GUARD_RESPONSE", { status: 502, retryable: true });
  }
  const record = value as Record<string, unknown>;
  if (record.status !== "claimed" || typeof record.claimId !== "string" || typeof record.deliveryId !== "string" || typeof record.claimedAt !== "string" || typeof record.expiresAt !== "string") {
    throw new InternalEventBoundaryError("Replay guard claim response is malformed.", "INVALID_REPLAY_GUARD_RESPONSE", { status: 502, retryable: true });
  }
  return record as unknown as ReplayClaimReceipt;
}

function normalizeBody(value: string | Uint8Array, maxBodyBytes: number): Uint8Array {
  const body = typeof value === "string" ? new TextEncoder().encode(value) : value;
  if (body.byteLength > maxBodyBytes) {
    throw new InternalEventBoundaryError("Signed internal event body exceeds the configured limit.", "EVENT_BODY_TOO_LARGE", { status: 413 });
  }
  return body;
}

function lowerHeaders(headers: Readonly<Record<string, string | readonly string[] | undefined>>): Record<string, string | readonly string[] | undefined> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function headerOrDefault(headers: Readonly<Record<string, string | readonly string[] | undefined>>, name: string, fallback: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  const resolved = Array.isArray(value) ? value[0] : value;
  return typeof resolved === "string" && resolved.trim() ? resolved.trim() : fallback;
}

async function sha256Hex(body: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new InternalEventBoundaryError("Web Crypto SHA-256 support is required.", "CRYPTO_UNAVAILABLE", { status: 500 });
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(body).buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
