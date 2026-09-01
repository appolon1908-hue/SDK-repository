import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ConnectorPolicyError, ConnectorRunner, InMemoryConnectorIdempotencyStore, type ConnectorContext } from "@codestra/connector-kit";
import { OdooAdapter, TelnexaAdapter, VicidialAdapter } from "../src/index.js";
import { FakeRestrictedGateway, sendJson } from "./support/fake-restricted-gateway.js";

/**
 * OdooAdapter, TelnexaAdapter, and VicidialAdapter have no logic of their
 * own -- each is just a manifest (operation names, `requiredCapabilities`,
 * webhook event types) handed to the shared RestrictedGatewayAdapter base
 * class. That manifest data is not decorative: ConnectorRunner.execute()
 * reads requiredCapabilities directly and rejects a command outright if
 * the caller's context is missing any of them (see connector-kit's
 * requireCapabilities -- this is the same "second real check" pattern as
 * every other fail-closed boundary touched this session). A typo in one
 * of these three files' requiredCapabilities arrays -- a wrong string, a
 * missing entry -- would either wrongly block a legitimate command or,
 * worse, wrongly let one through, and nothing before this file dispatched
 * a real command through any of these three adapters' actual manifests to
 * prove the declared capability actually gates real behavior.
 */

const runner = new ConnectorRunner({ idempotencyStore: new InMemoryConnectorIdempotencyStore() });

let gateway: FakeRestrictedGateway;

beforeAll(async () => {
  gateway = new FakeRestrictedGateway(() => {
    throw new Error("handler not configured");
  });
  await gateway.start();
});

afterEach(() => {
  gateway.setHandler(() => {
    throw new Error("handler not configured");
  });
});

afterAll(async () => {
  await gateway.stop();
});

function contextWith(capabilities: Record<string, boolean>): ConnectorContext {
  return {
    tenantId: "2b78b66e-40d9-4dd0-884b-d5cbd3773d04",
    correlationId: "correlation-manifest-0001",
    actor: { type: "service", subjectId: "middleware" },
    capabilities,
  };
}

function commandFor(operation: string): { commandId: string; operation: string; payload: Record<string, unknown>; requestedAt: string; idempotencyKey: string } {
  return {
    commandId: randomUUID(),
    operation,
    payload: { note: "manifest-conformance" },
    requestedAt: "2026-09-01T00:00:00Z",
    idempotencyKey: `idem-${randomUUID()}`,
  };
}

describe("Odoo/Telnexa/VICIdial manifests actually gate real dispatch", () => {
  it("OdooAdapter's real crm.write requirement blocks crm.contact.upsert without it, and allows it with it", async () => {
    const adapter = new OdooAdapter({
      baseUrl: gateway.url,
      tokenProvider: () => "secret-token",
      enabled: true,
      enabledOperations: ["crm.contact.upsert"],
    });
    const command = commandFor("crm.contact.upsert");

    await expect(runner.execute(adapter, contextWith({}), command)).rejects.toMatchObject({
      code: "CAPABILITY_DISABLED",
      details: { capability: "crm.write" },
    });

    let received: { body: unknown } | undefined;
    gateway.setHandler((request, response) => {
      received = request;
      sendJson(response, 200, { commandId: command.commandId, status: "accepted" });
    });
    await expect(runner.execute(adapter, contextWith({ "crm.write": true }), command)).resolves.toMatchObject({
      status: "accepted",
    });
    expect(received?.body).toMatchObject({ operation: "crm.contact.upsert" });
  });

  it("TelnexaAdapter's real sms.write + sms.live_delivery requirement blocks sms.send with only one granted", async () => {
    const adapter = new TelnexaAdapter({
      baseUrl: gateway.url,
      tokenProvider: () => "secret-token",
      enabled: true,
      enabledOperations: ["sms.send"],
    });
    const command = commandFor("sms.send");

    await expect(runner.execute(adapter, contextWith({ "sms.write": true }), command)).rejects.toMatchObject({
      code: "CAPABILITY_DISABLED",
      details: { capability: "sms.live_delivery" },
    });

    let received: { body: unknown } | undefined;
    gateway.setHandler((request, response) => {
      received = request;
      sendJson(response, 200, { commandId: command.commandId, status: "accepted" });
    });
    await expect(
      runner.execute(adapter, contextWith({ "sms.write": true, "sms.live_delivery": true }), command),
    ).resolves.toMatchObject({ status: "accepted" });
    expect(received?.body).toMatchObject({ operation: "sms.send" });
  });

  it("VicidialAdapter's real telephony.write + telephony.live_dialing requirement blocks telephony.call.request with only one granted", async () => {
    const adapter = new VicidialAdapter({
      baseUrl: gateway.url,
      tokenProvider: () => "secret-token",
      enabled: true,
      enabledOperations: ["telephony.call.request"],
    });
    const command = commandFor("telephony.call.request");

    await expect(
      runner.execute(adapter, contextWith({ "telephony.live_dialing": true }), command),
    ).rejects.toMatchObject({
      code: "CAPABILITY_DISABLED",
      details: { capability: "telephony.write" },
    });

    let received: { body: unknown } | undefined;
    gateway.setHandler((request, response) => {
      received = request;
      sendJson(response, 200, { commandId: command.commandId, status: "accepted" });
    });
    await expect(
      runner.execute(adapter, contextWith({ "telephony.write": true, "telephony.live_dialing": true }), command),
    ).resolves.toMatchObject({ status: "accepted" });
    expect(received?.body).toMatchObject({ operation: "telephony.call.request" });
  });

  it("VicidialAdapter's callback-schedule capability is scoped separately from the call-request capability", async () => {
    // telephony.callback.schedule requires only telephony.callback.write --
    // proving the manifest doesn't accidentally over-scope every operation
    // to the same capability set as telephony.call.request.
    const adapter = new VicidialAdapter({
      baseUrl: gateway.url,
      tokenProvider: () => "secret-token",
      enabled: true,
      enabledOperations: ["telephony.callback.schedule"],
    });
    const command = commandFor("telephony.callback.schedule");

    await expect(
      runner.execute(adapter, contextWith({ "telephony.write": true, "telephony.live_dialing": true }), command),
    ).rejects.toMatchObject({
      code: "CAPABILITY_DISABLED",
      details: { capability: "telephony.callback.write" },
    });

    gateway.setHandler((_request, response) => {
      sendJson(response, 200, { commandId: command.commandId, status: "accepted" });
    });
    await expect(
      runner.execute(adapter, contextWith({ "telephony.callback.write": true }), command),
    ).resolves.toMatchObject({ status: "accepted" });
  });

  it("rejects an operation the manifest does not declare, for all three adapters (real ConnectorPolicyError, not a silent pass-through)", async () => {
    const adapters = [
      new OdooAdapter({ baseUrl: gateway.url, tokenProvider: () => "t", enabled: true, enabledOperations: [] }),
      new TelnexaAdapter({ baseUrl: gateway.url, tokenProvider: () => "t", enabled: true, enabledOperations: [] }),
      new VicidialAdapter({ baseUrl: gateway.url, tokenProvider: () => "t", enabled: true, enabledOperations: [] }),
    ];
    for (const adapter of adapters) {
      await expect(runner.execute(adapter, contextWith({}), commandFor("not.a.real.operation"))).rejects.toBeInstanceOf(
        ConnectorPolicyError,
      );
    }
  });
});
