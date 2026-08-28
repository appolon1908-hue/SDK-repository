import { RestrictedGatewayAdapter, createManifest, type RestrictedGatewayAdapterConfig } from "./base.js";

export class OdooAdapter extends RestrictedGatewayAdapter {
  constructor(config: RestrictedGatewayAdapterConfig) {
    super(
      createManifest({
        key: "odoo",
        displayName: "Odoo Business System",
        operations: [
          { name: "crm.contact.upsert", mutates: true, requiredCapabilities: ["crm.write"] },
          { name: "crm.lead.upsert", mutates: true, requiredCapabilities: ["crm.write"] },
          { name: "crm.activity.create", mutates: true, requiredCapabilities: ["crm.write"] },
        ],
        webhookEventTypes: ["odoo.record.changed.v1"],
      }),
      config,
    );
  }
}
