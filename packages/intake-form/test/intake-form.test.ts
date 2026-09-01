import { describe, expect, it } from "vitest";
import { FormValidationException, IntakeFormRegistry, buildIntakeSubmission, validateForm } from "../src/index.js";
import { INDUSTRY_FORM_PRESETS } from "../src/presets.js";

const registry = new IntakeFormRegistry(INDUSTRY_FORM_PRESETS);

describe("industry intake form registry", () => {
  it("loads presets across industries", () => {
    expect(registry.list().length).toBeGreaterThanOrEqual(10);
    expect(registry.list("transportation_logistics")[0]?.id).toBe("freight_quote");
    expect(registry.list("medical_transportation")[0]?.id).toBe("medical_transport_request");
  });

  it("validates required and option fields", () => {
    const definition = registry.get("freight_quote");
    const result = validateForm(definition, { name: "Ralph", origin: "Miami" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.field === "destination")).toBe(true);
  });

  it("blocks prohibited public-intake fields", () => {
    const definition = registry.get("financial_consultation");
    const result = validateForm(definition, {
      name: "Test",
      serviceInterest: "credit_repair",
      ssn: "000-00-0000",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: "ssn", code: "prohibited_field" }));
  });

  it("builds a Middleware-compatible industry submission", () => {
    const definition = registry.get("freight_quote");
    const submission = buildIntakeSubmission(definition, {
      tenantId: "tenant-logistics",
      siteId: "site-001",
      campaignId: "campaign-freight",
      source: "landing_page",
      attribution: { campaign: "summer-freight" },
    }, {
      name: "Shipping Co",
      email: "ops@example.com",
      origin: "Miami, FL",
      destination: "Boston, MA",
      equipmentType: "dry_van",
      privacyConsent: true,
    });

    expect(submission.formId).toBe("freight_quote@1.0.0");
    expect(submission.fields.origin).toBe("Miami, FL");
    expect(submission.metadata.intakeIndustry).toBe("transportation_logistics");
    expect(submission.tenantId).toBe("tenant-logistics");
  });

  it("requires privacy consent where configured", () => {
    const definition = registry.get("software_project");
    expect(() => buildIntakeSubmission(definition, { tenantId: "t1", siteId: "s1" }, {
      name: "Client",
      projectType: "website",
    })).toThrow(FormValidationException);
  });

  it("rejects public schemas that mark a field sensitive", () => {
    expect(() => new IntakeFormRegistry([{
      id: "unsafe",
      version: "1.0.0",
      industry: "general",
      formType: "contact",
      title: "Unsafe",
      fields: [{ key: "secret", label: "Secret", type: "text", sensitive: true }],
      consents: [],
    }])).toThrow(/Sensitive fields require a protected workflow/);
  });
});
