import { describe, expect, it, vi } from "vitest";
import { CodestraSdkConfigurationError, createCodestraSdk } from "../src/index.js";

const tenantId = "tenant-001";
const correlationId = "correlation-0001";
const idempotencyKey = "stable-idempotency-0001";

describe("codestra_sdk facade", () => {
  it("exposes the canonical domain module layout", () => {
    const sdk = testSdk(vi.fn<typeof fetch>());

    expect(sdk).toHaveProperty("auth");
    expect(sdk).toHaveProperty("marketing");
    expect(sdk).toHaveProperty("ai");
    expect(sdk).toHaveProperty("communication");
    expect(sdk).toHaveProperty("social");
    expect(sdk).toHaveProperty("crm");
    expect(sdk).toHaveProperty("workflow");
    expect(sdk).toHaveProperty("events");
    expect(sdk).toHaveProperty("common");
  });

  it("supports stable product-facing calls across current domains", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { output: "done" }))
      .mockResolvedValueOnce(jsonResponse(202, { messageId: "message-001" }))
      .mockResolvedValueOnce(jsonResponse(202, socialPost()))
      .mockResolvedValueOnce(jsonResponse(200, { leadId: "lead-001" }));
    const sdk = testSdk(fetchMock);

    await sdk.marketing.campaigns.list();
    await sdk.ai.generate({ prompt: "Summarize this lead." }, { idempotencyKey });
    await sdk.communication.messages.send(
      { channel: "email", to: ["customer@example.com"], content: { subject: "Hi", text: "Hello" } },
      { idempotencyKey },
    );
    await sdk.social.posts.schedule(
      {
        workspaceId: "204ddc3a-3a33-445f-bfc5-0bb15167b624",
        channels: ["linkedin"],
        content: { text: "Launch update" },
        publishAt: "2026-08-30T18:00:00Z",
      },
      { idempotencyKey },
    );
    await sdk.crm.leads.get("lead-001");

    expect(pathname(fetchMock, 0)).toBe("/v1/marketing/campaigns");
    expect(pathname(fetchMock, 1)).toBe("/v1/ai/generate");
    expect(pathname(fetchMock, 2)).toBe("/v1/communications/messages");
    expect(pathname(fetchMock, 3)).toBe("/v1/social/posts");
    expect(pathname(fetchMock, 4)).toBe("/v1/crm/leads/lead-001");
    expect(headersFor(fetchMock, 1).get("x-codestra-tenant-id")).toBe(tenantId);
    expect(headersFor(fetchMock, 2).get("x-tenant-id")).toBe(tenantId);
    expect(headersFor(fetchMock, 3).get("x-codestra-tenant-id")).toBe(tenantId);
  });

  it("certifies endpoint and credential hygiene for unified facade requests", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { runId: "run-001" }));
    const sdk = testSdk(fetchMock);

    await sdk.workflow.runs.trigger(
      { workflow: "lead-intake", payload: { source: "sdk-test" } },
      { idempotencyKey, correlationId: "correlation-explicit-0001" },
    );

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("omit");
    expect(init?.redirect).toBe("error");
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("x-codestra-tenant-id")).toBe(tenantId);
    expect(headers.get("x-correlation-id")).toBe("correlation-explicit-0001");
    expect(headers.get("idempotency-key")).toBe(idempotencyKey);
    expect(String(init?.body)).not.toContain("test-token");
  });

  it("rejects credential-bearing or insecure base URLs before requests leave the process", () => {
    expect(() =>
      createCodestraSdk({
        baseUrl: "https://user:pass@api.codestra.co",
        tenantId,
        requestedBy: "moneybee-backend",
        getAccessToken: () => "test-token",
      }),
    ).toThrow(CodestraSdkConfigurationError);

    expect(() =>
      createCodestraSdk({
        baseUrl: "http://api.codestra.co",
        tenantId,
        requestedBy: "moneybee-backend",
        getAccessToken: () => "test-token",
      }),
    ).toThrow(CodestraSdkConfigurationError);
  });
});

function testSdk(fetch: typeof globalThis.fetch) {
  return createCodestraSdk({
    baseUrl: "https://api.codestra.co",
    tenantId,
    requestedBy: "moneybee-backend",
    getAccessToken: () => "test-token",
    fetch,
    commandIdFactory: () => "d0313dba-09f7-4cce-8894-195f72c62126",
    correlationIdFactory: () => correlationId,
    maxRetries: 0,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pathname(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, index: number): string {
  return new URL(String(fetchMock.mock.calls[index]?.[0])).pathname;
}

function headersFor(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, index: number): Headers {
  return new Headers(fetchMock.mock.calls[index]?.[1]?.headers);
}

function socialPost() {
  return {
    id: "d0313dba-09f7-4cce-8894-195f72c62126",
    tenantId: "042880db-aa51-4f16-83b5-ae858ee45ad6",
    workspaceId: "204ddc3a-3a33-445f-bfc5-0bb15167b624",
    status: "scheduled",
    channels: [{ channel: "linkedin", status: "scheduled" }],
    content: { text: "Launch update" },
    publishAt: "2026-08-30T18:00:00Z",
    createdAt: "2026-08-30T00:00:00Z",
    updatedAt: "2026-08-30T00:00:00Z",
  };
}
