import { IntakeFormRegistry, buildIntakeSubmission } from "../src/index.js";
import { INDUSTRY_FORM_PRESETS } from "../src/presets.js";

const registry = new IntakeFormRegistry(INDUSTRY_FORM_PRESETS);

export function buildSoftwareProjectLead(values: Record<string, unknown>) {
  return buildIntakeSubmission(
    registry.get("software_project", "1.0.0"),
    {
      tenantId: "tenant-from-server-config",
      siteId: "software-site",
      campaignId: "software-sales",
      source: "form",
    },
    values,
  );
}
