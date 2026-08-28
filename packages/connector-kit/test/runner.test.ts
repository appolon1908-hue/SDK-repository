import { describe, expect, it, vi } from "vitest";
import type { CodestraConnector, ConnectorContext } from "../src/index.js";
import {
  ConnectorPolicyError,
  ConnectorRunner,
  InMemoryConnectorIdempotencyStore,
} from "../src/index.js";

const context: ConnectorContext = {
  tenantId: "c3f2057a-7631-4906-8dfd-99b9e159978b",
  correlationId: "correlation-0001",
  actor: { type: "service", subjectId: "middleware" },
  capabilities: { "social.write": true },
};

function connector(execute = vi.fn().mockResolvedValue({ commandId: "cmd-000000000001", status: "completed" })) {
  return {
    manifest: () => ({
      key: "postiz",
      displayName: "Postiz",
      version: "0.1.0",
      operations: [{ name: "social.post.create", mutates: true, requiredCapabilities: ["social.write"] }],
      webhookEventTypes: [],
    }),
    testConnection: vi.fn(),
    execute,
    ingestWebhook: vi.fn(),
    reconcile: vi.fn(),
  } satisfies CodestraConnector;
}

const command = {
  commandId: "cmd-000000000001",
  operation: "social.post.create",
  payload: { text: "Hello" },
  requestedAt: "2026-08-27T00:00:00Z",
  idempotencyKey: "idempotency-key-0001",
};

describe("ConnectorRunner", () => {
  it("replays a completed idempotent command without calling the provider twice", async () => {
    const adapter = connector();
    const runner = new ConnectorRunner({ idempotencyStore: new InMemoryConnectorIdempotencyStore() });
    const first = await runner.execute(adapter, context, command);
    const second = await runner.execute(adapter, context, command);
    expect(first.replayed).toBeUndefined();
    expect(second.replayed).toBe(true);
    expect(adapter.execute).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a required capability is disabled", async () => {
    const runner = new ConnectorRunner({ idempotencyStore: new InMemoryConnectorIdempotencyStore() });
    await expect(
      runner.execute(connector(), { ...context, capabilities: { "social.write": false } }, command),
    ).rejects.toBeInstanceOf(ConnectorPolicyError);
  });
});
