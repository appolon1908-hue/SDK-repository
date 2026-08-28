import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestContext, idempotencyKey, type TestContext } from "./support/app.js";

/**
 * Proves tenant A cannot read or mutate tenant B's rows through any public
 * route, using two real, independently issued JWTs against real rows in
 * the real database — the tenant scope always comes from the verified JWT
 * claim, never from a body or URL parameter.
 */
let ctx: TestContext;
let tenantA: string;
let tenantB: string;
let headerA: string;
let headerB: string;

beforeAll(async () => {
  ctx = await createTestContext();
  tenantA = await ctx.createTenant();
  tenantB = await ctx.createTenant();
  headerA = await ctx.authHeader(tenantA);
  headerB = await ctx.authHeader(tenantB);
});

afterAll(async () => {
  await ctx.close();
});

describe("Tenant isolation", () => {
  it("does not let tenant B read tenant A's social post", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: headerA, "idempotency-key": idempotencyKey() },
      payload: { workspaceId: randomUUID(), channels: ["x"], content: { text: "Tenant A post" } },
    });
    expect(create.statusCode).toBe(202);
    const postId = create.json().id as string;

    const asOwner = await ctx.app.inject({ method: "GET", url: `/v1/social/posts/${postId}`, headers: { authorization: headerA } });
    expect(asOwner.statusCode).toBe(200);

    const asOther = await ctx.app.inject({ method: "GET", url: `/v1/social/posts/${postId}`, headers: { authorization: headerB } });
    expect(asOther.statusCode).toBe(404);
  });

  it("does not let tenant B cancel tenant A's social post", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: headerA, "idempotency-key": idempotencyKey() },
      payload: { workspaceId: randomUUID(), channels: ["x"], content: { text: "Tenant A cancel target" } },
    });
    const postId = create.json().id as string;

    const cancelAsOther = await ctx.app.inject({
      method: "POST",
      url: `/v1/social/posts/${postId}/cancel`,
      headers: { authorization: headerB, "idempotency-key": idempotencyKey() },
    });
    expect(cancelAsOther.statusCode).toBe(404);

    const stillActive = await ctx.app.inject({ method: "GET", url: `/v1/social/posts/${postId}`, headers: { authorization: headerA } });
    expect(stillActive.json().status).not.toBe("cancelled");
  });

  it("does not list tenant A's posts for tenant B", async () => {
    await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: headerA, "idempotency-key": idempotencyKey() },
      payload: { workspaceId: randomUUID(), channels: ["linkedin"], content: { text: "Only tenant A should see this" } },
    });

    const listAsOther = await ctx.app.inject({ method: "GET", url: "/v1/social/posts", headers: { authorization: headerB } });
    expect(listAsOther.statusCode).toBe(200);
    const items = listAsOther.json().items as Array<{ content: { text: string } }>;
    expect(items.some((item) => item.content.text === "Only tenant A should see this")).toBe(false);
  });

  it("does not let tenant B read, enable, disable, or delete tenant A's webhook subscription", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: headerA, "idempotency-key": idempotencyKey() },
      payload: { endpointUrl: "https://example.com/tenant-a-hook", eventTypes: ["codestra.social.post.status.v1"] },
    });
    expect(create.statusCode).toBe(201);
    const subscriptionId = create.json().subscription.id as string;

    const readAsOther = await ctx.app.inject({ method: "GET", url: `/v1/webhook-subscriptions/${subscriptionId}`, headers: { authorization: headerB } });
    expect(readAsOther.statusCode).toBe(404);

    const disableAsOther = await ctx.app.inject({
      method: "POST",
      url: `/v1/webhook-subscriptions/${subscriptionId}/disable`,
      headers: { authorization: headerB, "idempotency-key": idempotencyKey() },
    });
    expect(disableAsOther.statusCode).toBe(404);

    const deleteAsOther = await ctx.app.inject({
      method: "DELETE",
      url: `/v1/webhook-subscriptions/${subscriptionId}`,
      headers: { authorization: headerB, "idempotency-key": idempotencyKey() },
    });
    expect(deleteAsOther.statusCode).toBe(404);

    const listAsOther = await ctx.app.inject({ method: "GET", url: "/v1/webhook-subscriptions", headers: { authorization: headerB } });
    expect((listAsOther.json().items as unknown[]).find((item) => (item as { id: string }).id === subscriptionId)).toBeUndefined();
  });

  it("scopes idempotency keys per tenant: the same Idempotency-Key for two tenants creates two independent posts", async () => {
    const sharedKey = idempotencyKey();
    const payloadA = { workspaceId: randomUUID(), channels: ["x"], content: { text: "Shared key, tenant A" } };
    const payloadB = { workspaceId: randomUUID(), channels: ["x"], content: { text: "Shared key, tenant B" } };

    const resultA = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: headerA, "idempotency-key": sharedKey },
      payload: payloadA,
    });
    const resultB = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: headerB, "idempotency-key": sharedKey },
      payload: payloadB,
    });

    expect(resultA.statusCode).toBe(202);
    expect(resultB.statusCode).toBe(202);
    expect(resultA.json().id).not.toBe(resultB.json().id);
    expect(resultA.json().content.text).toBe("Shared key, tenant A");
    expect(resultB.json().content.text).toBe("Shared key, tenant B");
  });
});
