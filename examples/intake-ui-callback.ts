import { buildCallbackUiModel, mountIntakeUi } from "@codestra/intake-ui";
import { createIntakeClient } from "@codestra/intake-sdk";

const client = createIntakeClient();
const root = document.querySelector<HTMLElement>("#callback");
if (!root) throw new Error("Missing callback root");

mountIntakeUi(root, buildCallbackUiModel(), {
  async onSubmit(values) {
    return client.submitLead({
      tenantId: "tenant-from-server-rendered-config",
      siteId: "site-from-server-rendered-config",
      source: "form",
      formId: "campaign_callback@1.0.0",
      name: typeof values.name === "string" ? values.name : undefined,
      phone: String(values.phone ?? ""),
      fields: {
        preferredCallbackTime: values.preferredTime,
        language: values.language,
        reason: values.reason,
      },
      consent: { privacyPolicyVersion: "v1" },
    });
  },
});
