import { describe, expect, it, vi } from "vitest";
import { acceptSignedInternalEvent } from "../src/internal-event-boundary.js";
import { signWebhook } from "../src/standard-webhooks.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const secret = `whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;
const nowMs = Date.parse("2026-08-28T15:00:00.000Z");
const timestamp = Math.floor(nowMs / 1_000);

describe("signed internal n8n event boundary", () => {
  it("accepts a signed tenant-scoped event after an atomic replay claim", async () => {
    const body = canonicalBody();
    const fetch = vi.fn(async (_url: URL, request: RequestInit) => {
      expect(request.method).toBe("POST");
      expect(request.headers).toMatchObject({
        authorization: "Bearer replay-token-for-n8n",
        "x-codestra-tenant-id": tenantId,
      });
      expect(JSON.parse(String(request.body))).toMatchObject({
        eventId,
        tenantId,
        eventType: "codestra.social.post.status.v1",
        matchedSecretIndex: 0,
      });
      return jsonResponse(200, {
        claimId: "claim_123",
        deliveryId: "delivery_123",
        status: "claimed",
        claimedAt: "2026-08-28T15:00:00.000Z",
        expiresAt: "2026-08-28T15:05:00.000Z",
      });
    });

    const accepted = await acceptSignedInternalEvent({
      headers: await signedHeaders(body),
      rawBody: body,
      credentials: credentials(),
      fetch,
      now: () => nowMs,
    });

    expect(accepted.event.id).toBe(eventId);
    expect(accepted.delivery.deliveryId).toBe("delivery_123");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects tampered bodies before replay claim", async () => {
    const body = canonicalBody();
    const fetch = vi.fn();

    await expect(acceptSignedInternalEvent({
      headers: await signedHeaders(body),
      rawBody: body.replace("published", "failed"),
      credentials: credentials(),
      fetch,
      now: () => nowMs,
    })).rejects.toMatchObject({ code: "INVALID_SIGNATURE", status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant events before replay claim", async () => {
    const body = canonicalBody({ tenantid: "33333333-3333-4333-8333-333333333333" });
    const fetch = vi.fn();

    await expect(acceptSignedInternalEvent({
      headers: await signedHeaders(body),
      rawBody: body,
      credentials: credentials(),
      fetch,
      now: () => nowMs,
    })).rejects.toMatchObject({ code: "EVENT_TENANT_MISMATCH", status: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects duplicate replay claims", async () => {
    const body = canonicalBody();
    const fetch = vi.fn(async () => jsonResponse(409, { error: "duplicate" }));

    await expect(acceptSignedInternalEvent({
      headers: await signedHeaders(body),
      rawBody: body,
      credentials: credentials(),
      fetch,
      now: () => nowMs,
    })).rejects.toMatchObject({ code: "REPLAY_DETECTED", status: 409 });
  });

  it("rejects non-allowlisted event types", async () => {
    const body = canonicalBody({ type: "codestra.raw.provider.event.v1" });

    await expect(acceptSignedInternalEvent({
      headers: await signedHeaders(body),
      rawBody: body,
      credentials: credentials(),
      fetch: vi.fn(),
      now: () => nowMs,
    })).rejects.toMatchObject({ code: "EVENT_TYPE_NOT_ALLOWED", status: 403 });
  });

  it("accepts call disposition update events", async () => {
    const body = canonicalBody({
      type: "call_disposition_updated",
      data: {
        event_type: "call_disposition_updated",
        correlation_id: "55555555-5555-4555-8555-555555555555",
        causation_id: "vicidial-call-123",
        odoo_contact_id: 4301,
        odoo_lead_id: null,
        disposition: "sale_completed",
        phone_number: "+15551234567",
        duration_seconds: 180,
        campaign_id: "campaign-alpha",
        provider_call_id: "1745850000.42",
        dry_run: false,
      },
    });
    const fetch = replayClaimFetch("call_disposition_updated");

    const accepted = await acceptSignedInternalEvent({
      headers: await signedHeaders(body),
      rawBody: body,
      credentials: credentials(),
      fetch,
      now: () => nowMs,
    });

    expect(accepted.event.type).toBe("call_disposition_updated");
    expect(accepted.event.data).toMatchObject({
      disposition: "sale_completed",
      phone_number: "+15551234567",
      provider_call_id: "1745850000.42",
    });
  });

  it("accepts inbound SMS events", async () => {
    const body = canonicalBody({
      type: "sms_received",
      data: {
        event_type: "sms_received",
        correlation_id: "77777777-7777-4777-8777-777777777777",
        causation_id: "telnexa-message-123",
        odoo_contact_id: 4301,
        odoo_message_id: null,
        from_number: "+15551234567",
        body_preview: "Reply received",
        provider_event_id: "telnexa-message-123",
        dry_run: false,
      },
    });
    const fetch = replayClaimFetch("sms_received");

    const accepted = await acceptSignedInternalEvent({
      headers: await signedHeaders(body),
      rawBody: body,
      credentials: credentials(),
      fetch,
      now: () => nowMs,
    });

    expect(accepted.event.type).toBe("sms_received");
    expect(accepted.event.data).toMatchObject({
      body_preview: "Reply received",
      from_number: "+15551234567",
      provider_event_id: "telnexa-message-123",
    });
  });
});

function credentials() {
  return {
    expectedTenantId: tenantId,
    webhookSecrets: secret,
    allowedEventTypes: "codestra.social.post.status.v1\ncodestra.webhook.delivery.status.v1\ncall_disposition_updated\nsms_received",
    allowedSourcePrefixes: "urn:codestra:",
    replayGuardBaseUrl: "https://middleware.codestra.test/internal/",
    replayGuardAccessToken: "replay-token-for-n8n",
    timestampToleranceSeconds: 300,
    maxBodyBytes: 1_048_576,
    requestTimeoutMs: 1_000,
  };
}

function replayClaimFetch(eventType: string) {
  return vi.fn(async (_url: URL, request: RequestInit) => {
    expect(JSON.parse(String(request.body))).toMatchObject({
      eventId,
      tenantId,
      eventType,
      matchedSecretIndex: 0,
    });
    return jsonResponse(200, {
      claimId: "claim_123",
      deliveryId: "delivery_123",
      status: "claimed",
      claimedAt: "2026-08-28T15:00:00.000Z",
      expiresAt: "2026-08-28T15:05:00.000Z",
    });
  });
}

async function signedHeaders(body: string) {
  return {
    ...(await signWebhook({ id: eventId, timestamp, payload: body, secret })),
    "x-codestra-tenant-id": tenantId,
    "x-correlation-id": "corr_123",
  };
}

function canonicalBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    specversion: "1.0",
    id: eventId,
    tenantid: tenantId,
    source: "urn:codestra:middleware:social",
    type: "codestra.social.post.status.v1",
    time: "2026-08-28T15:00:00.000Z",
    datacontenttype: "application/json",
    data: {
      postId: "44444444-4444-4444-8444-444444444444",
      tenantId,
      status: "published",
      deliveries: [{ channel: "linkedin", status: "published" }],
      occurredAt: "2026-08-28T15:00:00.000Z",
    },
    ...overrides,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
