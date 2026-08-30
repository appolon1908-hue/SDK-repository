import { IntakeFormRegistry, buildIntakeSubmission } from "../src/index.js";
import { INDUSTRY_FORM_PRESETS } from "../src/presets.js";

const registry = new IntakeFormRegistry(INDUSTRY_FORM_PRESETS);
const definition = registry.get("freight_quote", "1.0.0");

export function buildFreightLead(values: Record<string, unknown>) {
  return buildIntakeSubmission(
    definition,
    {
      tenantId: "tenant-from-server-config",
      siteId: "freight-landing-site",
      campaignId: "freight-sales",
      source: "landing_page",
    },
    values,
  );
}
