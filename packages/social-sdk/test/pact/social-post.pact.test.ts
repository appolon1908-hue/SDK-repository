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
});
