import { describe, expect, it } from "vitest";
import { validateCreateSubscriptionInput } from "../app/(protected)/webhooks/validation.js";

describe("validateCreateSubscriptionInput", () => {
  it("accepts a valid https endpoint with at least one event type", () => {
    const result = validateCreateSubscriptionInput({
      endpointUrl: "https://example-tenant.test/hooks/codestra",
      eventTypes: ["codestra.social.post.status.v1"],
    });
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it("rejects a missing endpoint URL", () => {
    const result = validateCreateSubscriptionInput({ endpointUrl: "", eventTypes: ["codestra.social.post.status.v1"] });
    expect(result.valid).toBe(false);
    expect(result.errors.endpointUrl).toMatch(/required/);
  });

  it("rejects a non-https endpoint, matching the public contract's destination policy", () => {
    const result = validateCreateSubscriptionInput({
      endpointUrl: "http://example-tenant.test/hooks/codestra",
      eventTypes: ["codestra.social.post.status.v1"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.endpointUrl).toMatch(/https:\/\//);
  });

  it("rejects an empty event type selection", () => {
    const result = validateCreateSubscriptionInput({ endpointUrl: "https://example-tenant.test/hooks/codestra", eventTypes: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.eventTypes).toMatch(/at least one/);
  });
});
