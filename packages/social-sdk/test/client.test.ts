import { describe, expect, it, vi } from "vitest";
import { CodestraClient, CodestraConfigurationError, CodestraContractViolationError } from "../src/index.js";

const post = {
  id: "d0313dba-09f7-4cce-8894-195f72c62126",
  tenantId: "042880db-aa51-4f16-83b5-ae858ee45ad6",
  workspaceId: "204ddc3a-3a33-445f-bfc5-0bb15167b624",
  status: "accepted",
  channels: [{ channel: "linkedin", status: "accepted" }],
  content: { text: "Hello" },
  createdAt: "2026-08-27T00:00:00Z",
  updatedAt: "2026-08-27T00:00:00Z",
} as const;

const subscription = {
  id: "31e2115b-bf6b-40f5-9e15-c549a3b4c052",
  endpointUrl: "https://hooks.customer.test/codestra",
  eventTypes: ["codestra.social.post.status.v1"],
  status: "active",
  createdAt: "2026-08-27T00:00:00Z",
  updatedAt: "2026-08-27T00:00:00Z",
} as const;

describe("CodestraClient", () => {
  it("adds tenant, correlation, authorization and idempotency headers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(post), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new CodestraClient({
      baseUrl: "https://api.codestra.co",
      tenantId: post.tenantId,
      getAccessToken: () => "test-token",
      fetch: fetchMock,
      correlationIdFactory: () => "correlation-0001",
    });

    await client.social.posts.create(
      {
        workspaceId: post.workspaceId,
        channels: ["linkedin"],
        content: { text: "Hello" },
      },
      { idempotencyKey: "idempotency-key-0001" },
    );

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("x-codestra-tenant-id")).toBe(post.tenantId);
    expect(headers.get("x-correlation-id")).toBe("correlation-0001");
    expect(headers.get("idempotency-key")).toBe("idempotency-key-0001");
    expect(init?.cache).toBe("no-store");
  });

  it("rejects insecure non-loopback base URLs", () => {
    expect(
      () =>
        new CodestraClient({
          baseUrl: "http://api.codestra.co",
          tenantId: post.tenantId,
          getAccessToken: () => "test-token",
        }),
    ).toThrow(CodestraConfigurationError);
  });

  it("creates webhook subscriptions with one-time signing secret response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(201, {
        subscription: { ...subscription, status: "pending_verification" },
        signingSecret: "whsec_MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      }),
    );
    const client = testClient(fetchMock);

    const result = await client.webhooks.subscriptions.create(
      {
        endpointUrl: subscription.endpointUrl,
        eventTypes: subscription.eventTypes,
      },
      { idempotencyKey: "idempotency-key-0002" },
    );

    expect(result.signingSecret).toMatch(/^whsec_/u);
    expectRequest(fetchMock, "POST", "/v1/webhook-subscriptions", "idempotency-key-0002");
  });

  it("supports webhook subscription management operations", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(200, { items: [subscription] }))
      .mockResolvedValueOnce(jsonResponse(200, subscription))
      .mockResolvedValueOnce(jsonResponse(202, {
        deliveryId: "0da44cb8-dd6b-49d7-90c0-2585b05346fe",
        subscriptionId: subscription.id,
        status: "queued",
        acceptedAt: "2026-08-27T00:00:00Z",
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        subscription,
        signingSecret: "whsec_MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        previousSecretExpiresAt: "2026-08-28T00:00:00Z",
      }))
      .mockResolvedValueOnce(jsonResponse(200, { ...subscription, status: "active" }))
      .mockResolvedValueOnce(jsonResponse(200, { ...subscription, status: "disabled" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = testClient(fetchMock);

    await client.webhooks.subscriptions.list();
    await client.webhooks.subscriptions.get(subscription.id);
    await client.webhooks.subscriptions.test(subscription.id, { idempotencyKey: "idempotency-key-0003" });
    await client.webhooks.subscriptions.rotateSecret(subscription.id, { idempotencyKey: "idempotency-key-0004" });
    await client.webhooks.subscriptions.enable(subscription.id, { idempotencyKey: "idempotency-key-0005" });
    await client.webhooks.subscriptions.disable(subscription.id, { idempotencyKey: "idempotency-key-0006" });
    await client.webhooks.subscriptions.delete(subscription.id, { idempotencyKey: "idempotency-key-0007" });

    expectRequest(fetchMock, "GET", "/v1/webhook-subscriptions");
    expectRequest(fetchMock, "GET", `/v1/webhook-subscriptions/${subscription.id}`);
    expectRequest(fetchMock, "POST", `/v1/webhook-subscriptions/${subscription.id}/test`, "idempotency-key-0003");
    expectRequest(fetchMock, "POST", `/v1/webhook-subscriptions/${subscription.id}/rotate-secret`, "idempotency-key-0004");
    expectRequest(fetchMock, "POST", `/v1/webhook-subscriptions/${subscription.id}/enable`, "idempotency-key-0005");
    expectRequest(fetchMock, "POST", `/v1/webhook-subscriptions/${subscription.id}/disable`, "idempotency-key-0006");
    expectRequest(fetchMock, "DELETE", `/v1/webhook-subscriptions/${subscription.id}`, "idempotency-key-0007");
  });

  it("rejects invalid JavaScript caller input before sending", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = testClient(fetchMock);

    expect(() =>
      client.webhooks.subscriptions.create(
        {
          endpointUrl: "http://169.254.169.254/latest",
          eventTypes: ["codestra.social.post.status.v1"],
        },
        { idempotencyKey: "idempotency-key-0008" },
      ),
    ).toThrow(CodestraContractViolationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed successful responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { ...subscription, status: "surprise" }));
    const client = testClient(fetchMock);

    await expect(client.webhooks.subscriptions.get(subscription.id)).rejects.toMatchObject({
      code: "CONTRACT_VIOLATION",
      path: "response.status",
    });
  });
});

function testClient(fetch: typeof globalThis.fetch): CodestraClient {
  return new CodestraClient({
    baseUrl: "https://api.codestra.co",
    tenantId: post.tenantId,
    getAccessToken: () => "test-token",
    fetch,
    correlationIdFactory: () => "correlation-0001",
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function expectRequest(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, method: string, path: string, idempotencyKey?: string): void {
  const call = fetchMock.mock.calls.find(([url, init]) => {
    const requestUrl = new URL(String(url));
    return requestUrl.pathname === path && init?.method === method;
  });
  expect(call).toBeDefined();
  const headers = new Headers(call?.[1]?.headers);
  expect(headers.get("x-codestra-tenant-id")).toBe(post.tenantId);
  if (idempotencyKey !== undefined) expect(headers.get("idempotency-key")).toBe(idempotencyKey);
}
