import { describe, expect, it, vi } from "vitest";
import {
  CodestraCommunicationsClient,
  CodestraCommunicationsConfigurationError,
  CodestraCommunicationsContractViolationError,
} from "../src/index.js";

const tenantId = "tenant-001";
const commandId = "d0313dba-09f7-4cce-8894-195f72c62126";
const correlationId = "correlation-0001";
const operation = {
  command_id: commandId,
  tenant_id: tenantId,
  command_type: "email.message.send.v1",
  command_version: "1.0",
  target: "klyrow-email",
  requested_by: "moneybee-backend",
  correlation_id: correlationId,
  idempotency_key: "email-send-0001",
  capability: "EMAIL_DELIVERY",
  state: "accepted",
  provider_operation_id: null,
  last_error: null,
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
  duplicate: false,
} as const;

describe("CodestraCommunicationsClient", () => {
  it("submits email through the Middleware command plane", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(202, operation));
    const client = testClient(fetchMock);

    await expect(
      client.email.send(
        {
          from: { email: "support@example.com", name: "Support" },
          to: [{ email: "customer@example.com" }],
          subject: "Application update",
          content: { text: "Your application was received." },
          metadata: { source: "moneybee" },
        },
        { idempotencyKey: "email-send-0001" },
      ),
    ).resolves.toMatchObject(operation);

    const { body, headers, init, url } = firstJsonRequest(fetchMock);
    expect(url.pathname).toBe("/v1/commands");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("x-tenant-id")).toBe(tenantId);
    expect(headers.get("x-correlation-id")).toBe(correlationId);
    expect(headers.get("idempotency-key")).toBe("email-send-0001");
    expect(body).toMatchObject({
      command_id: commandId,
      command_type: "email.message.send.v1",
      command_version: "1.0",
      target: "klyrow-email",
      tenant_id: tenantId,
      requested_by: "moneybee-backend",
      correlation_id: correlationId,
      idempotency_key: "email-send-0001",
      capability: "EMAIL_DELIVERY",
      payload: {
        from: { email: "support@example.com", name: "Support" },
        to: [{ email: "customer@example.com" }],
        subject: "Application update",
        content: { text: "Your application was received." },
        metadata: { source: "moneybee" },
      },
    });
  });

  it("maps SMS and voice commands to the current Middleware targets", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(202, { ...operation, command_type: "sms.message.send.v1", target: "telnexa-sms", capability: "SMS_DELIVERY" }))
      .mockResolvedValueOnce(jsonResponse(202, { ...operation, command_type: "telephony.call.start.v1", target: "vicidial-restricted", capability: "PRODUCTION_DIALING" }));
    const client = testClient(fetchMock);

    await client.sms.send({ to: { phoneNumber: "+15551234567" }, body: "Hello" }, { idempotencyKey: "sms-send-0001" });
    await client.voice.call({ to: "+15557654321", campaignId: "campaign-1" }, { idempotencyKey: "voice-call-0001" });

    expect(jsonBody(fetchMock, 0)).toMatchObject({
      command_type: "sms.message.send.v1",
      target: "telnexa-sms",
      capability: "SMS_DELIVERY",
    });
    expect(jsonBody(fetchMock, 1)).toMatchObject({
      command_type: "telephony.call.start.v1",
      target: "vicidial-restricted",
      capability: "PRODUCTION_DIALING",
    });
  });

  it("reads command operation state with tenant and bearer headers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, operation));
    const client = testClient(fetchMock);

    await expect(client.operations.get(commandId)).resolves.toMatchObject(operation);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(new URL(String(url)).pathname).toBe(`/v1/operations/${commandId}`);
    expect(init?.method).toBe("GET");
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("x-tenant-id")).toBe(tenantId);
    expect(headers.get("idempotency-key")).toBeNull();
  });

  it("rejects invalid caller input before sending", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = testClient(fetchMock);

    await expect(
      client.sms.send({ to: { phoneNumber: "555-1234" }, body: "Hello" }, { idempotencyKey: "sms-send-0002" }),
    ).rejects.toThrow(CodestraCommunicationsContractViolationError);
    await expect(
      client.email.send(
        { from: { email: "support@example.com" }, to: [{ email: "bad" }], subject: "Hi", content: { text: "Hello" } },
        { idempotencyKey: "email-send-0002" },
      ),
    ).rejects.toThrow(CodestraCommunicationsContractViolationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects insecure non-loopback base URLs", () => {
    expect(
      () =>
        new CodestraCommunicationsClient({
          baseUrl: "http://api.codestra.co",
          tenantId,
          requestedBy: "moneybee-backend",
          getAccessToken: () => "test-token",
        }),
    ).toThrow(CodestraCommunicationsConfigurationError);
  });

  it("parses Middleware error responses and preserves retryability", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(503, {
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "Provider is unavailable.",
          correlation_id: correlationId,
          retryable: true,
          details: { provider: "klyrow-email" },
        },
      }),
    );
    const client = testClient(fetchMock, { maxRetries: 0 });

    await expect(
      client.email.cancel({ messageId: "message-1", reason: "customer-request" }, { idempotencyKey: "email-cancel-0001" }),
    ).rejects.toMatchObject({
      status: 503,
      code: "PROVIDER_UNAVAILABLE",
      requestId: correlationId,
      retryable: true,
      details: { provider: "klyrow-email" },
    });
  });
});

function testClient(fetch: typeof globalThis.fetch, options: Partial<ConstructorParameters<typeof CodestraCommunicationsClient>[0]> = {}): CodestraCommunicationsClient {
  return new CodestraCommunicationsClient({
    baseUrl: "https://api.codestra.co",
    tenantId,
    requestedBy: "moneybee-backend",
    getAccessToken: () => "test-token",
    fetch,
    commandIdFactory: () => commandId,
    correlationIdFactory: () => correlationId,
    ...options,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function firstJsonRequest(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>): {
  body: Record<string, unknown>;
  headers: Headers;
  init: RequestInit;
  url: URL;
} {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return {
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    headers: new Headers(init?.headers),
    init: init ?? {},
    url: new URL(String(url)),
  };
}

function jsonBody(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, index: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[index]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}
