import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./support/app.js";
import { FakeRestrictedGateway, sendJson } from "./support/fake-restricted-gateway.js";

let gateway: FakeRestrictedGateway;
let ctx: TestContext;
let tenantId: string;
let auth: string;

beforeAll(async () => {
  gateway = new FakeRestrictedGateway(() => {
    throw new Error("handler not configured");
  });
  await gateway.start();
  ctx = await createTestContext({ restrictedGatewayBaseUrl: gateway.url });
  tenantId = await ctx.createTenant();
  auth = await ctx.authHeader(tenantId);
});

afterEach(() => {
  gateway.setHandler(() => {
    throw new Error("handler not configured");
  });
});

afterAll(async () => {
  await ctx.close();
  await gateway.stop();
});

function commandBody(overrides: Partial<{ commandId: string; operation: string }> = {}): Record<string, unknown> {
  return {
    commandId: overrides.commandId ?? randomUUID(),
    operation: overrides.operation ?? "postiz.post.publish",
    payload: { text: "hello" },
    requestedAt: new Date().toISOString(),
  };
}

describe("POST /v1/connectors/{connectorKey}/commands", () => {
  it("dispatches a real HTTP request to the restricted gateway and returns its receipt", async () => {
    let received: { headers: Record<string, unknown>; body: unknown } | undefined;
    gateway.setHandler((request, response) => {
      received = request;
      sendJson(response, 202, { commandId: (request.body as { commandId: string }).commandId, status: "completed", providerReference: "provider-abc" });
    });

    const command = commandBody();
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/connectors/postiz/commands",
      headers: { authorization: auth, "idempotency-key": `cmd-${randomUUID()}`, "x-correlation-id": "correlation-00000001" },
      payload: command,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      commandId: command.commandId,
      status: "completed",
      result: { providerReference: "provider-abc" },
    });
    expect(received?.headers["x-codestra-tenant-id"]).toBe(tenantId);
    expect(received?.headers["authorization"]).toBe("Bearer test-service-token");
    expect(received?.headers["idempotency-key"]).toBeDefined();
  });

  it("replays without dispatching a second HTTP request for the same Idempotency-Key", async () => {
    let calls = 0;
    gateway.setHandler((request, response) => {
      calls += 1;
      sendJson(response, 202, { commandId: (request.body as { commandId: string }).commandId, status: "completed" });
    });

    const command = commandBody();
    const key = `cmd-${randomUUID()}`;
    const first = await ctx.app.inject({
      method: "POST",
      url: "/v1/connectors/postiz/commands",
      headers: { authorization: auth, "idempotency-key": key, "x-correlation-id": "correlation-00000002" },
      payload: command,
    });
    const second = await ctx.app.inject({
      method: "POST",
      url: "/v1/connectors/postiz/commands",
      headers: { authorization: auth, "idempotency-key": key, "x-correlation-id": "correlation-00000003" },
      payload: command,
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(second.json().replayed).toBe(true);
    expect(calls).toBe(1);
  });

  it("returns a 409 indeterminate error when the gateway connection resets after dispatch, and blocks blind retry", async () => {
    gateway.setHandler((_request, response) => {
      response.destroy(); // simulate a connection reset mid-response
    });

    const command = commandBody();
    const key = `cmd-${randomUUID()}`;
    const first = await ctx.app.inject({
      method: "POST",
      url: "/v1/connectors/postiz/commands",
      headers: { authorization: auth, "idempotency-key": key, "x-correlation-id": "correlation-00000004" },
      payload: command,
    });
    expect(first.statusCode).toBe(409);
    expect(first.json().error.code).toBe("IDEMPOTENCY_OUTCOME_INDETERMINATE");

    const second = await ctx.app.inject({
      method: "POST",
      url: "/v1/connectors/postiz/commands",
      headers: { authorization: auth, "idempotency-key": key, "x-correlation-id": "correlation-00000005" },
      payload: command,
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("IDEMPOTENCY_OUTCOME_INDETERMINATE");
  });

  it("rejects a request missing the Idempotency-Key header", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/connectors/postiz/commands",
      headers: { authorization: auth, "x-correlation-id": "correlation-00000006" },
      payload: commandBody(),
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects an invalid connectorKey", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/connectors/NOT_VALID/commands",
      headers: { authorization: auth, "idempotency-key": `cmd-${randomUUID()}` },
      payload: commandBody(),
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("POST /v1/connectors/{connectorKey}/reconciliation", () => {
  it("reads a reconciliation page from the restricted gateway without mutating anything", async () => {
    gateway.setHandler((_request, response) => {
      sendJson(response, 200, { items: [{ externalId: "1" }], hasMore: false });
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/connectors/postiz/reconciliation",
      headers: { authorization: auth, "x-correlation-id": "correlation-00000007" },
      payload: { limit: 10 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [{ externalId: "1" }], hasMore: false });
  });
});
