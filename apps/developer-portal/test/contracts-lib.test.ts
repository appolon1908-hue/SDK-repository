import { describe, expect, it } from "vitest";
import { listKnownEventTypes, loadEventCatalogue } from "../lib/contracts.js";

// Parses the real contracts/asyncapi/codestra-events.asyncapi.yaml file --
// this is an integration test against the actual checked-in contract, not a
// fixture, so it fails if the event catalogue page would fail to render.
describe("loadEventCatalogue", () => {
  it("parses both real channels from the AsyncAPI catalogue", () => {
    const channels = loadEventCatalogue();
    expect(channels.map((channel) => channel.address).sort()).toEqual(
      ["codestra.social.post.status.v1", "codestra.webhook.delivery.status.v1"].sort(),
    );
  });

  it("resolves the externally-referenced JSON Schema for the social post status message", () => {
    const channels = loadEventCatalogue();
    const social = channels.find((channel) => channel.address === "codestra.social.post.status.v1");
    expect(social).toBeDefined();
    const message = social!.messages[0];
    expect(message).toBeDefined();
    expect(message!.cloudEventType).toBe("codestra.social.post.status.v1");
    const fieldNames = message!.fields.map((field) => field.name);
    expect(fieldNames).toEqual(expect.arrayContaining(["postId", "tenantId", "status", "deliveries", "occurredAt"]));
    expect(message!.fields.find((field) => field.name === "postId")?.required).toBe(true);
  });

  it("resolves the inline schema for the webhook delivery status message", () => {
    const channels = loadEventCatalogue();
    const delivery = channels.find((channel) => channel.address === "codestra.webhook.delivery.status.v1");
    const message = delivery?.messages[0];
    expect(message?.fields.map((field) => field.name)).toEqual(
      expect.arrayContaining(["deliveryId", "endpointId", "status", "occurredAt"]),
    );
  });
});

describe("listKnownEventTypes", () => {
  it("returns the CloudEvent type constants used by the webhook subscription form", () => {
    expect(listKnownEventTypes().sort()).toEqual(
      ["codestra.social.post.status.v1", "codestra.webhook.delivery.status.v1"].sort(),
    );
  });
});
