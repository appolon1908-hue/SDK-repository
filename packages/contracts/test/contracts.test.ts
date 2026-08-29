import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION } from "../src/index.js";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

describe("contract package", () => {
  it("exposes a stable semantic version", () => {
    expect(CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("declares Middleware telephony and SMS events in AsyncAPI", () => {
    const asyncApi = parse(readFileSync(new URL("../../../contracts/asyncapi/codestra-events.asyncapi.yaml", import.meta.url), "utf8"));
    expect(asyncApi.channels.callDispositionUpdated.address).toBe("call_disposition_updated");
    expect(asyncApi.channels.smsReceived.address).toBe("sms_received");
    expect(asyncApi.components.messages.CallDispositionUpdated.name).toBe("call_disposition_updated");
    expect(asyncApi.components.messages.SmsReceived.name).toBe("sms_received");
  });
});
