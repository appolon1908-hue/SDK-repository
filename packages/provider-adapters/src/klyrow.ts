import { RestrictedGatewayAdapter, createManifest, type RestrictedGatewayAdapterConfig } from "./base.js";

export class KlyrowAdapter extends RestrictedGatewayAdapter {
  constructor(config: RestrictedGatewayAdapterConfig) {
    super(
      createManifest({
        key: "klyrow",
        displayName: "Klyrow Email",
        operations: [
          {
            name: "email.send",
            mutates: true,
            requiredCapabilities: ["email.write", "email.live_delivery"],
          },
          { name: "email.suppression.upsert", mutates: true, requiredCapabilities: ["email.compliance.write"] },
        ],
        webhookEventTypes: ["klyrow.delivery.status.v1", "klyrow.complaint.received.v1"],
      }),
      config,
    );
  }
}
