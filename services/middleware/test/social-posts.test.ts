import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestContext, idempotencyKey, type TestContext } from "./support/app.js";

let ctx: TestContext;
let tenantId: string;
let auth: string;

beforeAll(async () => {
  ctx = await createTestContext();
  tenantId = await ctx.createTenant();
  auth = await ctx.authHeader(tenantId);
});

afterAll(async () => {
  await ctx.close();
});

describe("POST /v1/social/posts", () => {
  it("creates a post and returns the exact SocialPost shape", async () => {
    const workspaceId = randomUUID();
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { workspaceId, channels: ["facebook", "x"], content: { text: "Launching Codestra Middleware" } },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body).toMatchObject({
      tenantId,
      workspaceId,
      status: "accepted",
      content: { text: "Launching Codestra Middleware" },
    });
    expect(body.channels).toEqual([
      { channel: "facebook", status: "accepted" },
      { channel: "x", status: "accepted" },
    ]);
    expect(typeof body.id).toBe("string");
    expect(typeof body.createdAt).toBe("string");
    expect(typeof body.updatedAt).toBe("string");
  });

  it("requires an Idempotency-Key header", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: auth },
      payload: { workspaceId: randomUUID(), channels: ["x"], content: { text: "no key" } },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects an invalid request body", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { workspaceId: "not-a-uuid", channels: [], content: { text: "" } },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("replays the identical response for a repeated Idempotency-Key + payload", async () => {
    const key = idempotencyKey();
    const payload = { workspaceId: randomUUID(), channels: ["instagram"], content: { text: "Replay me" } };

    const first = await ctx.app.inject({ method: "POST", url: "/v1/social/posts", headers: { authorization: auth, "idempotency-key": key }, payload });
    const second = await ctx.app.inject({ method: "POST", url: "/v1/social/posts", headers: { authorization: auth, "idempotency-key": key }, payload });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(second.json().id).toBe(first.json().id);

    const list = await ctx.app.inject({ method: "GET", url: `/v1/social/posts?workspaceId=${payload.workspaceId}`, headers: { authorization: auth } });
    expect((list.json().items as unknown[]).length).toBe(1);
  });

  it("rejects a repeated Idempotency-Key used with a different payload", async () => {
    const key = idempotencyKey();
    const workspaceId = randomUUID();
    const first = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: auth, "idempotency-key": key },
      payload: { workspaceId, channels: ["x"], content: { text: "Original" } },
    });
    expect(first.statusCode).toBe(202);

    const second = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: auth, "idempotency-key": key },
      payload: { workspaceId, channels: ["x"], content: { text: "Different text" } },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("IDEMPOTENCY_REQUEST_MISMATCH");
  });
});

describe("GET /v1/social/posts and /v1/social/posts/{postId}", () => {
  it("returns 404 for a post that does not exist", async () => {
    const response = await ctx.app.inject({ method: "GET", url: `/v1/social/posts/${randomUUID()}`, headers: { authorization: auth } });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
  });

  it("filters the list by status and workspaceId, and paginates with a cursor", async () => {
    const workspaceId = randomUUID();
    for (let i = 0; i < 3; i += 1) {
      await ctx.app.inject({
        method: "POST",
        url: "/v1/social/posts",
        headers: { authorization: auth, "idempotency-key": idempotencyKey() },
        payload: { workspaceId, channels: ["x"], content: { text: `Post ${i}` } },
      });
    }

    const firstPage = await ctx.app.inject({ method: "GET", url: `/v1/social/posts?workspaceId=${workspaceId}&limit=2`, headers: { authorization: auth } });
    expect(firstPage.statusCode).toBe(200);
    const firstBody = firstPage.json();
    expect(firstBody.items).toHaveLength(2);
    expect(typeof firstBody.nextCursor).toBe("string");

    const secondPage = await ctx.app.inject({
      method: "GET",
      url: `/v1/social/posts?workspaceId=${workspaceId}&limit=2&cursor=${firstBody.nextCursor}`,
      headers: { authorization: auth },
    });
    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json().items).toHaveLength(1);

    const statusFiltered = await ctx.app.inject({
      method: "GET",
      url: `/v1/social/posts?workspaceId=${workspaceId}&status=accepted`,
      headers: { authorization: auth },
    });
    expect(statusFiltered.json().items).toHaveLength(3);
  });
});

describe("POST /v1/social/posts/{postId}/cancel", () => {
  it("cancels a cancellable post", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { workspaceId: randomUUID(), channels: ["x"], content: { text: "Cancel target" } },
    });
    const postId = create.json().id as string;

    const cancel = await ctx.app.inject({
      method: "POST",
      url: `/v1/social/posts/${postId}/cancel`,
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
    });
    expect(cancel.statusCode).toBe(202);
    expect(cancel.json().status).toBe("cancelled");
  });

  it("rejects cancelling an already-cancelled post", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/social/posts",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { workspaceId: randomUUID(), channels: ["x"], content: { text: "Cancel twice" } },
    });
    const postId = create.json().id as string;

    await ctx.app.inject({ method: "POST", url: `/v1/social/posts/${postId}/cancel`, headers: { authorization: auth, "idempotency-key": idempotencyKey() } });
    const secondCancel = await ctx.app.inject({
      method: "POST",
      url: `/v1/social/posts/${postId}/cancel`,
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
    });
    expect(secondCancel.statusCode).toBe(409);
    expect(secondCancel.json().error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("returns 404 cancelling a post that does not exist", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: `/v1/social/posts/${randomUUID()}/cancel`,
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
    });
    expect(response.statusCode).toBe(404);
  });
});
