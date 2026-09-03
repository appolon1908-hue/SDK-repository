import { beforeEach, describe, expect, it } from "vitest";
import { createMockCodestraApiClient, resetMockStore } from "../src/mock-client.js";

describe("createMockCodestraApiClient", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("creates and then lists a social post", async () => {
    const client = createMockCodestraApiClient();
    const created = await client.social.posts.create(
      {
        workspaceId: "204ddc3a-3a33-445f-bfc5-0bb15167b624",
        channels: ["facebook"],
        content: { text: "Hello from a test." },
      },
      { idempotencyKey: "test-idempotency-key-0001" },
    );

    expect(created.status).toBe("accepted");

    const list = await client.social.posts.list();
    expect(list.items.some((post) => post.id === created.id)).toBe(true);
  });

  it("cancels a social post", async () => {
    const client = createMockCodestraApiClient();
    const { items } = await client.social.posts.list();
    const target = items[0];
    expect(target).toBeDefined();
    const cancelled = await client.social.posts.cancel(target!.id, { idempotencyKey: "test-idempotency-key-0002" });
    expect(cancelled.status).toBe("cancelled");
  });

  it("creates a webhook subscription with a one-time signing secret, then rotates it", async () => {
    const client = createMockCodestraApiClient();
    const created = await client.webhooks.subscriptions.create(
      { endpointUrl: "https://example-tenant.test/hooks/codestra", eventTypes: ["codestra.social.post.status.v1"] },
      { idempotencyKey: "test-idempotency-key-0003" },
    );
    expect(created.subscription.status).toBe("pending_verification");
    expect(created.signingSecret.startsWith("whsec_")).toBe(true);

    const rotated = await client.webhooks.subscriptions.rotateSecret(created.subscription.id, {
      idempotencyKey: "test-idempotency-key-0004",
    });
    expect(rotated.signingSecret).not.toBe(created.signingSecret);
    expect(rotated.subscription.id).toBe(created.subscription.id);
  });

  it("enables and disables a webhook subscription", async () => {
    const client = createMockCodestraApiClient();
    const { items } = await client.webhooks.subscriptions.list();
    const target = items.find((item) => item.status !== "active");
    expect(target).toBeDefined();

    const enabled = await client.webhooks.subscriptions.enable(target!.id, { idempotencyKey: "test-idempotency-key-0005" });
    expect(enabled.status).toBe("active");

    const disabled = await client.webhooks.subscriptions.disable(target!.id, { idempotencyKey: "test-idempotency-key-0006" });
    expect(disabled.status).toBe("disabled");
    expect(disabled.disabledAt).toBeDefined();
  });

  it("deletes a webhook subscription and 404s on the next read", async () => {
    const client = createMockCodestraApiClient();
    const { items } = await client.webhooks.subscriptions.list();
    const target = items[0];
    expect(target).toBeDefined();

    await client.webhooks.subscriptions.delete(target!.id, { idempotencyKey: "test-idempotency-key-0007" });
    await expect(client.webhooks.subscriptions.get(target!.id)).rejects.toThrow();
  });
});
