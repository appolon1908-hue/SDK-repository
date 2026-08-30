import { describe, expect, it } from "vitest";
import { IntakeFormRegistry } from "../src/index.js";
import { INDUSTRY_FORM_PRESETS } from "../src/presets.js";

describe("reviewed industry presets", () => {
  it("registers all presets without sensitive public fields", () => {
    const registry = new IntakeFormRegistry(INDUSTRY_FORM_PRESETS);
    expect(registry.list().length).toBe(11);
    expect(registry.list().every((definition) => definition.fields.every((field) => !field.sensitive))).toBe(true);
  });

  it("keeps preset identities unique", () => {
    const ids = INDUSTRY_FORM_PRESETS.map((definition) => `${definition.id}@${definition.version}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("requires privacy consent on every reviewed v1 preset", () => {
    expect(INDUSTRY_FORM_PRESETS.every((definition) => definition.consents.some((consent) => consent.key === "privacy" && consent.required))).toBe(true);
  });
});
