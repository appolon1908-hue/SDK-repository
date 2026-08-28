import { describe, it } from "vitest";
import { MatchersV3, PactV3, syntheticAccessToken, syntheticIdentity } from "@codestra/testing";
import { CodestraClient } from "../../src/index.js";

const { like } = MatchersV3;
const provider = new PactV3({
  consumer: "codestra-social-sdk",
  provider: "codestra-middleware",
  dir: "../../pact/pacts",
  logLevel: "error",
});

describe("Codestra Middleware consumer contract", () => {
  it("accepts an idempotent social post command", async () => {
    provider
      .given("a tenant is entitled to publish to LinkedIn")
      .uponReceiving("an idempotent social post command")
      .withRequest({
        method: "POST",
        path: "/v1/social/posts",
        headers: {
          authorization: `Bearer ${syntheticAccessToken()}`,
          "content-type": "application/json",
          "x-codestra-tenant-id": syntheticIdentity.tenantId,
          "x-correlation-id": syntheticIdentity.correlationId,
          "idempotency-key": syntheticIdentity.idempotencyKey,
        },
        body: {
          workspaceId: syntheticIdentity.workspaceId,
          channels: ["linkedin"],
          content: { text: "Compatibility test" },
        },
      })
      .willRespondWith({
        status: 202,
        headers: { "content-type": "application/json" },
        body: like({
          id: syntheticIdentity.postId,
          tenantId: syntheticIdentity.tenantId,
          workspaceId: syntheticIdentity.workspaceId,
          status: "accepted",
          channels: [{ channel: "linkedin", status: "accepted" }],
          content: { text: "Compatibility test" },
          createdAt: "2026-08-27T00:00:00Z",
          updatedAt: "2026-08-27T00:00:00Z",
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const client = new CodestraClient({
        baseUrl: mockServer.url,
        tenantId: syntheticIdentity.tenantId,
        getAccessToken: syntheticAccessToken,
        correlationIdFactory: () => syntheticIdentity.correlationId,
        maxRetries: 0,
      });
      await client.social.posts.create(
        {
          workspaceId: syntheticIdentity.workspaceId,
          channels: ["linkedin"],
          content: { text: "Compatibility test" },
        },
        { idempotencyKey: syntheticIdentity.idempotencyKey },
      );
    });
  });

  it("creates a webhook subscription with one-time secret material", async () => {
    provider
      .given("a tenant can register webhook subscriptions")
      .uponReceiving("an idempotent webhook subscription create command")
      .withRequest({
        method: "POST",
        path: "/v1/webhook-subscriptions",
        headers: {
          authorization: `Bearer ${syntheticAccessToken()}`,
          "content-type": "application/json",
          "x-codestra-tenant-id": syntheticIdentity.tenantId,
          "x-correlation-id": syntheticIdentity.correlationId,
          "idempotency-key": syntheticIdentity.idempotencyKey,
        },
        body: {
          endpointUrl: "https://hooks.customer.test/codestra",
          eventTypes: ["codestra.social.post.status.v1"],
        },
      })
      .willRespondWith({
        status: 201,
        headers: { "content-type": "application/json" },
        body: like({
          subscription: webhookSubscription("pending_verification"),
          signingSecret: "whsec_MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const client = pactClient(mockServer.url);
      await client.webhooks.subscriptions.create(
        {
          endpointUrl: "https://hooks.customer.test/codestra",
          eventTypes: ["codestra.social.post.status.v1"],
        },
        { idempotencyKey: syntheticIdentity.idempotencyKey },
      );
    });
  });

  it("reads and manages webhook subscriptions", async () => {
    provider
      .given("a tenant has an active webhook subscription")
      .uponReceiving("webhook subscription lifecycle requests")
      .withRequest({
        method: "GET",
        path: "/v1/webhook-subscriptions",
        headers: {
          authorization: `Bearer ${syntheticAccessToken()}`,
          "x-codestra-tenant-id": syntheticIdentity.tenantId,
          "x-correlation-id": syntheticIdentity.correlationId,
        },
      })
      .willRespondWith({
        status: 200,
        headers: { "content-type": "application/json" },
        body: like({ items: [webhookSubscription("active")] }),
      });

    await provider.executeTest(async (mockServer) => {
      await pactClient(mockServer.url).webhooks.subscriptions.list();
    });
  });
});

function pactClient(baseUrl: string): CodestraClient {
  return new CodestraClient({
    baseUrl,
    tenantId: syntheticIdentity.tenantId,
    getAccessToken: syntheticAccessToken,
    correlationIdFactory: () => syntheticIdentity.correlationId,
    maxRetries: 0,
  });
}

function webhookSubscription(status: "active" | "pending_verification") {
  return {
    id: "31e2115b-bf6b-40f5-9e15-c549a3b4c052",
    endpointUrl: "https://hooks.customer.test/codestra",
    eventTypes: ["codestra.social.post.status.v1"],
    status,
    verification: { status: status === "active" ? "verified" : "pending" },
    destinationPolicy: {
      httpsOnly: true,
      privateAddressBlocked: true,
      redirectsBlocked: true,
    },
    createdAt: "2026-08-27T00:00:00Z",
    updatedAt: "2026-08-27T00:00:00Z",
  };
}
