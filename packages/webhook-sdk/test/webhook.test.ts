import { describe, expect, it } from "vitest";
import {
  InMemoryReplayStore,
  WebhookVerificationError,
  signWebhook,
  verifyAndClaimWebhook,
  verifyWebhook,
} from "../src/index.js";

const secret = `whsec_${btoa("0123456789abcdef0123456789abcdef")}`;
const nowMilliseconds = 1_800_000_000_000;
const timestamp = Math.floor(nowMilliseconds / 1_000);

describe("webhook verification", () => {
  it("verifies a raw payload and identifies the rotated secret", async () => {
    const payload = JSON.stringify({ id: "post-1" });
    const headers = await signWebhook({ id: "evt_1", timestamp, payload, secret });
    const result = await verifyWebhook({
      id: headers["webhook-id"],
      timestamp: headers["webhook-timestamp"],
      signature: headers["webhook-signature"],
      payload,
      secrets: [`whsec_${btoa("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")}`, secret],
      now: () => nowMilliseconds,
    });
    expect(result.matchedSecretIndex).toBe(1);
  });

  it("rejects payload tampering", async () => {
    const headers = await signWebhook({ id: "evt_2", timestamp, payload: "original", secret });
    await expect(
      verifyWebhook({
        id: headers["webhook-id"],
        timestamp: headers["webhook-timestamp"],
        signature: headers["webhook-signature"],
        payload: "changed",
        secrets: [secret],
        now: () => nowMilliseconds,
      }),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("claims an event exactly once", async () => {
    const headers = await signWebhook({ id: "evt_3", timestamp, payload: "payload", secret });
    const store = new InMemoryReplayStore(() => timestamp);
    const input = {
      id: headers["webhook-id"],
      timestamp: headers["webhook-timestamp"],
      signature: headers["webhook-signature"],
      payload: "payload",
      secrets: [secret],
      now: () => nowMilliseconds,
    };
    await verifyAndClaimWebhook(input, store);
    await expect(verifyAndClaimWebhook(input, store)).rejects.toBeInstanceOf(WebhookVerificationError);
  });
});
