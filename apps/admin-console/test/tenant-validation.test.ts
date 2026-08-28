import { describe, expect, it } from "vitest";
import { validateCreateTenantInput } from "../lib/tenant-validation.js";

describe("validateCreateTenantInput", () => {
  it("accepts a name and a valid plan", () => {
    const result = validateCreateTenantInput({ name: "Northwind Creative", plan: "growth" });
    expect(result.valid).toBe(true);
    expect(result.plan).toBe("growth");
  });

  it("rejects a blank name", () => {
    const result = validateCreateTenantInput({ name: "   ", plan: "starter" });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toMatch(/required/);
  });

  it("rejects a plan outside starter/growth/enterprise", () => {
    const result = validateCreateTenantInput({ name: "Acme", plan: "ultra" });
    expect(result.valid).toBe(false);
    expect(result.errors.plan).toMatch(/starter, growth, enterprise/);
  });
});
