import { describe, expect, it } from "vitest";
import { IntakeSurveyRegistry, SurveyValidationException, buildSurveySubmission, calculateNps, validateSurvey } from "../src/index.js";
import { SURVEY_PRESETS } from "../src/presets.js";

describe("intake survey", () => {
  it("loads reviewed presets by version", () => {
    const registry = new IntakeSurveyRegistry(SURVEY_PRESETS);
    expect(registry.get("customer_nps").version).toBe("1.0.0");
  });

  it("validates branching questions only when visible", () => {
    const definition = new IntakeSurveyRegistry(SURVEY_PRESETS).get("post_call_quality");
    expect(validateSurvey(definition, { resolved: "yes", agentRating: 5 }).valid).toBe(true);
    expect(validateSurvey(definition, { resolved: "no", agentRating: 4 }).valid).toBe(true);
  });

  it("rejects prohibited public survey fields", () => {
    const definition = new IntakeSurveyRegistry(SURVEY_PRESETS).get("nonprofit_impact");
    const result = validateSurvey(definition, { helpfulness: 5, ssn: "000-00-0000" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.code === "prohibited_field")).toBe(true);
  });

  it("does not attach contact identity to anonymous responses", () => {
    const definition = new IntakeSurveyRegistry(SURVEY_PRESETS).get("customer_csat");
    const submission = buildSurveySubmission(definition, { tenantId: "tenant-a", siteId: "site-a", anonymous: true, contactId: "contact-secret", leadId: "lead-secret" }, { satisfaction: 5 });
    expect(submission.anonymous).toBe(true);
    expect(submission.contactId).toBeUndefined();
    expect(submission.leadId).toBeUndefined();
  });

  it("blocks anonymous responses when definition does not allow them", () => {
    const definition = new IntakeSurveyRegistry(SURVEY_PRESETS).get("post_call_quality");
    expect(() => buildSurveySubmission(definition, { tenantId: "tenant-a", siteId: "site-a", anonymous: true }, { resolved: "yes", agentRating: 5 })).toThrow(SurveyValidationException);
  });

  it("calculates NPS", () => {
    expect(calculateNps([10, 9, 8, 5])).toEqual({ score: 25, promoters: 2, passives: 1, detractors: 1 });
  });
});
