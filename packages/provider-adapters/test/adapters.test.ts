import { describe, expect, it, vi } from "vitest";
import type { ConnectorContext } from "@codestra/connector-kit";
import { KlyrowAdapter, PostizAdapter } from "../src/index.js";

const context: ConnectorContext = {
  tenantId: "2b78b66e-40d9-4dd0-884b-d5cbd3773d04",
  correlationId: "correlation-0001",
  actor: { type: "service", subjectId: "middleware" },
  capabilities: { "social.write": true, "social.external_delivery": true },
};

const command = {
  commandId: "4fab632d-0a69-4d28-8eb1-982bc92cf613",
  operation: "social.post.create",
  payload: { text: "Hello" },
  requestedAt: "2026-08-27T00:00:00Z",
  idempotencyKey: "idempotency-key-0001",
};

describe("provider adapters", () => {
  it("does not perform network activity when the adapter is disabled", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const adapter = new PostizAdapter({
      baseUrl: "https://postiz.internal",
      tokenProvider: () => "secret-token",
      fetch: fetchMock,
    });
    await expect(adapter.execute(context, command)).rejects.toMatchObject({ code: "CONNECTOR_DISABLED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires each provider operation to be explicitly enabled", async () => {
    const adapter = new PostizAdapter({
      baseUrl: "https://postiz.internal",
      tokenProvider: () => "secret-token",
      enabled: true,
      enabledOperations: [],
      fetch: vi.fn<typeof fetch>(),
    });
    await expect(adapter.execute(context, command)).rejects.toMatchObject({ code: "PROVIDER_OPERATION_DISABLED" });
  });

  it("keeps live email delivery disabled unless email.send is allowlisted", async () => {
    const adapter = new KlyrowAdapter({
      baseUrl: "https://klyrow.internal",
      tokenProvider: () => "secret-token",
      enabled: true,
      enabledOperations: ["email.suppression.upsert"],
      fetch: vi.fn<typeof fetch>(),
    });
    await expect(
      adapter.execute(
        { ...context, capabilities: { "email.write": true, "email.live_delivery": true } },
        { ...command, operation: "email.send" },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_OPERATION_DISABLED" });
  });
});
