import { describe, expect, it } from "vitest";
import {
  buildConnectorCommandFixtures,
  buildConnectorHealthFixtures,
  CONNECTOR_KEYS,
  deriveCommandOutcome,
} from "../src/fixtures/connector-commands.js";
import { buildWebhookDeliveryFixtures } from "../src/fixtures/webhook-deliveries.js";

describe("connector command fixtures", () => {
  it("covers every connector key from the social channel enum", () => {
    const health = buildConnectorHealthFixtures();
    for (const key of CONNECTOR_KEYS) {
      expect(health[key]).toBeDefined();
      expect(["healthy", "degraded", "unavailable", "disabled"]).toContain(health[key].status);
    }
  });

  it("derives the operator-facing outcome from connector-kit's idempotency states", () => {
    const records = buildConnectorCommandFixtures();
    const outcomes = new Set(records.map((record) => deriveCommandOutcome(record)));
    // The fixture set is written to exercise every derived outcome bucket.
    expect(outcomes).toEqual(new Set(["pending", "dispatched", "succeeded", "failed", "indeterminate"]));
  });

  it("maps a completed+rejected record to the failed outcome", () => {
    expect(deriveCommandOutcome({ idempotencyState: "completed", resultStatus: "rejected" })).toBe("failed");
  });

  it("maps a completed+completed record to the succeeded outcome", () => {
    expect(deriveCommandOutcome({ idempotencyState: "completed", resultStatus: "completed" })).toBe("succeeded");
  });

  it("maps an acquired record to the pending outcome", () => {
    expect(deriveCommandOutcome({ idempotencyState: "acquired" })).toBe("pending");
  });
});

describe("webhook delivery fixtures", () => {
  it("uses the AsyncAPI event catalogue's delivery status enum", () => {
    const events = buildWebhookDeliveryFixtures(["6f0a2b3c-1111-4222-8333-000000000001"]);
    const statuses = new Set(events.map((event) => event.status));
    for (const status of statuses) {
      expect(["queued", "attempting", "delivered", "failed", "dead_lettered"]).toContain(status);
    }
    expect(statuses.size).toBeGreaterThan(1);
  });
});
