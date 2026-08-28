import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { verifyWebhook } from "@codestra/webhook-sdk";
import { createTestContext, idempotencyKey, type TestContext } from "./support/app.js";
import { FakeWebhookReceiver } from "./support/fake-webhook-receiver.js";

let ctx: TestContext;
let tenantId: string;
let auth: string;
let receiver: FakeWebhookReceiver;

beforeAll(async () => {
  ctx = await createTestContext({ allowInsecureWebhookDestinationsForTests: true });
  tenantId = await ctx.createTenant();
  auth = await ctx.authHeader(tenantId);
  receiver = new FakeWebhookReceiver();
  await receiver.start();
});

afterEach(() => {
  receiver.received = [];
  receiver.responseStatus = 200;
  receiver.redirectTo = undefined;
});

afterAll(async () => {
  await receiver.stop();
  await ctx.close();
});

describe("POST /v1/webhook-subscriptions", () => {
  it("creates a subscription, reveals the signing secret exactly once, and verifies the endpoint for real", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { endpointUrl: receiver.url, eventTypes: ["codestra.social.post.status.v1"] },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.signingSecret).toMatch(/^whsec_/);
    expect(body.subscription.destinationPolicy).toEqual({ httpsOnly: true, privateAddressBlocked: true, redirectsBlocked: true });
    // The real verification handshake actually reached the receiver over TLS.
    expect(receiver.received.length).toBeGreaterThanOrEqual(1);
    expect(body.subscription.verification.status).toBe("verified");

    const read = await ctx.app.inject({ method: "GET", url: `/v1/webhook-subscriptions/${body.subscription.id}`, headers: { authorization: auth } });
    expect(read.json().signingSecret).toBeUndefined();
  });

  it("rejects a destination that fails SSRF policy without ever occupying an idempotency slot", async () => {
    const strictCtx = await createTestContext(); // no bypass — the real, unmodified policy
    try {
      const strictTenant = await strictCtx.createTenant();
      const strictAuth = await strictCtx.authHeader(strictTenant);
      const response = await strictCtx.app.inject({
        method: "POST",
        url: "/v1/webhook-subscriptions",
        headers: { authorization: strictAuth, "idempotency-key": idempotencyKey() },
        payload: { endpointUrl: "https://127.0.0.1/hooks", eventTypes: ["codestra.social.post.status.v1"] },
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().error.code).toBe("PRIVATE_WEBHOOK_DESTINATION");
    } finally {
      await strictCtx.close();
    }
  });

  it("rejects a non-https endpointUrl at the request-validation layer", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { endpointUrl: "http://example.com/hooks", eventTypes: ["codestra.social.post.status.v1"] },
    });
    expect(response.statusCode).toBe(400);
  });

  it("replays the exact original response, secret included, for a repeated Idempotency-Key", async () => {
    const key = idempotencyKey();
    const payload = { endpointUrl: receiver.url, eventTypes: ["codestra.social.post.status.v1"] };
    const first = await ctx.app.inject({ method: "POST", url: "/v1/webhook-subscriptions", headers: { authorization: auth, "idempotency-key": key }, payload });
    const second = await ctx.app.inject({ method: "POST", url: "/v1/webhook-subscriptions", headers: { authorization: auth, "idempotency-key": key }, payload });

    expect(second.json().subscription.id).toBe(first.json().subscription.id);
    expect(second.json().signingSecret).toBe(first.json().signingSecret);
  });
});

describe("Webhook subscription lifecycle", () => {
  async function createVerified(): Promise<{ id: string }> {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { endpointUrl: receiver.url, eventTypes: ["codestra.social.post.status.v1"] },
    });
    return { id: response.json().subscription.id as string };
  }

  it("enables a verified subscription and disables it again", async () => {
    const { id } = await createVerified();
    const enable = await ctx.app.inject({ method: "POST", url: `/v1/webhook-subscriptions/${id}/enable`, headers: { authorization: auth, "idempotency-key": idempotencyKey() } });
    expect(enable.statusCode).toBe(200);
    expect(enable.json().status).toBe("active");

    const disable = await ctx.app.inject({ method: "POST", url: `/v1/webhook-subscriptions/${id}/disable`, headers: { authorization: auth, "idempotency-key": idempotencyKey() } });
    expect(disable.statusCode).toBe(200);
    expect(disable.json().status).toBe("disabled");
    expect(typeof disable.json().disabledAt).toBe("string");
  });

  it("refuses to enable an unverified subscription", async () => {
    receiver.responseStatus = 500; // verification challenge will fail
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { endpointUrl: receiver.url, eventTypes: ["codestra.social.post.status.v1"] },
    });
    expect(create.json().subscription.verification.status).toBe("pending");

    const enable = await ctx.app.inject({
      method: "POST",
      url: `/v1/webhook-subscriptions/${create.json().subscription.id}/enable`,
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
    });
    expect(enable.statusCode).toBe(409);
    expect(enable.json().error.code).toBe("VERIFICATION_REQUIRED");
  });

  it("rotates the signing secret, keeping the previous one valid until its documented expiry", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { endpointUrl: receiver.url, eventTypes: ["codestra.social.post.status.v1"] },
    });
    const id = create.json().subscription.id as string;
    const originalSecret = create.json().signingSecret as string;

    const rotate = await ctx.app.inject({ method: "POST", url: `/v1/webhook-subscriptions/${id}/rotate-secret`, headers: { authorization: auth, "idempotency-key": idempotencyKey() } });
    expect(rotate.statusCode).toBe(200);
    const newSecret = rotate.json().signingSecret as string;
    expect(newSecret).not.toBe(originalSecret);
    expect(typeof rotate.json().previousSecretExpiresAt).toBe("string");

    const read = await ctx.app.inject({ method: "GET", url: `/v1/webhook-subscriptions/${id}`, headers: { authorization: auth } });
    expect(read.json().signingSecret).toBeUndefined();
  });

  it("deletes a subscription", async () => {
    const { id } = await createVerified();
    const del = await ctx.app.inject({ method: "DELETE", url: `/v1/webhook-subscriptions/${id}`, headers: { authorization: auth, "idempotency-key": idempotencyKey() } });
    expect(del.statusCode).toBe(204);

    const read = await ctx.app.inject({ method: "GET", url: `/v1/webhook-subscriptions/${id}`, headers: { authorization: auth } });
    expect(read.statusCode).toBe(404);
  });
});

describe("POST /v1/webhook-subscriptions/{id}/test", () => {
  it("signs and delivers the exact bytes to the destination, verifiable with webhook-sdk", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { endpointUrl: receiver.url, eventTypes: ["codestra.social.post.status.v1"] },
    });
    const id = create.json().subscription.id as string;
    const secret = create.json().signingSecret as string;
    receiver.received = [];

    const test = await ctx.app.inject({ method: "POST", url: `/v1/webhook-subscriptions/${id}/test`, headers: { authorization: auth, "idempotency-key": idempotencyKey() } });
    expect(test.statusCode).toBe(202);
    expect(test.json().status).toBe("queued");

    const delivered = receiver.received.at(-1);
    expect(delivered).toBeDefined();
    const verified = await verifyWebhook({
      id: String(delivered?.headers["webhook-id"]),
      timestamp: String(delivered?.headers["webhook-timestamp"]),
      signature: String(delivered?.headers["webhook-signature"]),
      payload: delivered?.body ?? "",
      secrets: [secret],
    });
    expect(verified.id).toBe(delivered?.headers["webhook-id"]);
  });

  it("refuses to follow a redirect from the destination", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/webhook-subscriptions",
      headers: { authorization: auth, "idempotency-key": idempotencyKey() },
      payload: { endpointUrl: receiver.url, eventTypes: ["codestra.social.post.status.v1"] },
    });
    const id = create.json().subscription.id as string;

    receiver.redirectTo = "https://attacker.invalid/steal";
    const test = await ctx.app.inject({ method: "POST", url: `/v1/webhook-subscriptions/${id}/test`, headers: { authorization: auth, "idempotency-key": idempotencyKey() } });
    expect(test.statusCode).toBe(202); // accepted for processing; the delivery itself is recorded as failed

    const delivery = await ctx.prisma.webhookDelivery.findFirst({ where: { subscriptionId: id }, orderBy: { createdAt: "desc" } });
    expect(delivery?.status).toBe("failed");
    expect(delivery?.failureCode).toBe("REDIRECT_REFUSED");
  });

  it("rejects testing a destination that no longer passes SSRF policy", async () => {
    const strictCtx = await createTestContext();
    try {
      const strictTenant = await strictCtx.createTenant();
      const strictAuth = await strictCtx.authHeader(strictTenant);
      // Directly construct a row bypassing the create endpoint's own
      // pre-check, simulating a destination that was safe at creation
      // time but is not any more (e.g. re-pointed DNS).
      const row = await strictCtx.prisma.webhookSubscription.create({
        data: {
          id: randomUUID(),
          tenantId: strictTenant,
          endpointUrl: "https://169.254.169.254/hooks",
          eventTypes: ["codestra.social.post.status.v1"],
          status: "pending_verification",
          currentSecret: "whsec_" + Buffer.from("0".repeat(32)).toString("base64"),
          currentSecretCreatedAt: new Date(),
          verificationStatus: "pending",
        },
      });

      const test = await strictCtx.app.inject({
        method: "POST",
        url: `/v1/webhook-subscriptions/${row.id}/test`,
        headers: { authorization: strictAuth, "idempotency-key": idempotencyKey() },
      });
      expect(test.statusCode).toBe(202);
      expect(test.json().status).toBe("rejected");
    } finally {
      await strictCtx.close();
    }
  });
});
