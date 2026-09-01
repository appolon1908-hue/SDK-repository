import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ConnectorPolicyError,
  ConnectorRunner,
  InMemoryConnectorIdempotencyStore,
  type ConnectorContext,
  type CodestraConnector,
} from "@codestra/connector-kit";
import { OdooAdapter, TelnexaAdapter, VicidialAdapter } from "../src/index.js";
import type { RestrictedGatewayAdapterConfig } from "../src/base.js";
import { FakeRestrictedGateway, sendJson } from "./support/fake-restricted-gateway.js";

/**
 * OdooAdapter, TelnexaAdapter, and VicidialAdapter have no logic of their
 * own -- each is just a manifest (operation names, `requiredCapabilities`,
 * webhook event types) handed to the shared RestrictedGatewayAdapter base
 * class. That manifest data is not decorative: ConnectorRunner.execute()
 * reads requiredCapabilities directly and rejects a command outright if
 * the caller's context is missing any of them.
 *
 * Table-driven over every mutating operation these three adapters declare
 * (not just one per adapter -- a first version of this file left
 * crm.lead.upsert, crm.activity.create, sms.cancel, and
 * telephony.call.cancel completely untested, so a manifest regression on
 * any of them would have passed silently), and for every operation with
 * more than one required capability, each capability is withheld on its
 * own in turn (a first version granted every-capability-but-one for a
 * fixed capability, so weakening the *other* required capability on
 * sms.send or telephony.call.request would still have passed).
 */

interface OperationCase {
  adapterName: string;
  makeAdapter: (config: RestrictedGatewayAdapterConfig) => CodestraConnector;
  operation: string;
  requiredCapabilities: readonly string[];
}

const cases: OperationCase[] = [
  { adapterName: "Odoo", makeAdapter: (config) => new OdooAdapter(config), operation: "crm.contact.upsert", requiredCapabilities: ["crm.write"] },
  { adapterName: "Odoo", makeAdapter: (config) => new OdooAdapter(config), operation: "crm.lead.upsert", requiredCapabilities: ["crm.write"] },
  { adapterName: "Odoo", makeAdapter: (config) => new OdooAdapter(config), operation: "crm.activity.create", requiredCapabilities: ["crm.write"] },
  {
    adapterName: "Telnexa",
    makeAdapter: (config) => new TelnexaAdapter(config),
    operation: "sms.send",
    requiredCapabilities: ["sms.write", "sms.live_delivery"],
  },
  { adapterName: "Telnexa", makeAdapter: (config) => new TelnexaAdapter(config), operation: "sms.cancel", requiredCapabilities: ["sms.write"] },
  {
    adapterName: "VICIdial",
    makeAdapter: (config) => new VicidialAdapter(config),
    operation: "telephony.call.request",
    requiredCapabilities: ["telephony.write", "telephony.live_dialing"],
  },
  {
    adapterName: "VICIdial",
    makeAdapter: (config) => new VicidialAdapter(config),
    operation: "telephony.callback.schedule",
    requiredCapabilities: ["telephony.callback.write"],
  },
  {
    adapterName: "VICIdial",
    makeAdapter: (config) => new VicidialAdapter(config),
    operation: "telephony.call.cancel",
    requiredCapabilities: ["telephony.write"],
  },
];

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

function commandFor(operation: string) {
  return {
    commandId: randomUUID(),
    operation,
    payload: { note: "manifest-conformance" },
    requestedAt: "2026-09-01T00:00:00Z",
    idempotencyKey: `idem-${randomUUID()}`,
  };
}

function grantAll(capabilities: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(capabilities.map((capability) => [capability, true]));
}

describe.each(cases)("$adapterName manifest for $operation", ({ makeAdapter, operation, requiredCapabilities }) => {
  it("succeeds against a real server once every required capability is granted", async () => {
    const adapter = makeAdapter({
      baseUrl: gateway.url,
      tokenProvider: () => "secret-token",
      enabled: true,
      enabledOperations: [operation],
    });
    const command = commandFor(operation);
    let received: { body: unknown } | undefined;
    gateway.setHandler((request, response) => {
      received = request;
      sendJson(response, 200, { commandId: command.commandId, status: "accepted" });
    });

    await expect(runner.execute(adapter, contextWith(grantAll(requiredCapabilities)), command)).resolves.toMatchObject({
      status: "accepted",
    });
    expect(received?.body).toMatchObject({ operation });
  });

  it.each(requiredCapabilities.map((capability) => ({ capability })))(
    "rejects when only $capability is withheld, even with every other required capability granted",
    async ({ capability }) => {
      const adapter = makeAdapter({
        baseUrl: gateway.url,
        tokenProvider: () => "secret-token",
        enabled: true,
        enabledOperations: [operation],
      });
      const granted = grantAll(requiredCapabilities);
      delete granted[capability];

      await expect(runner.execute(adapter, contextWith(granted), commandFor(operation))).rejects.toMatchObject({
        code: "CAPABILITY_DISABLED",
        details: { capability },
      });
    },
  );
});

describe("manifest declarations reject undeclared operations", () => {
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
