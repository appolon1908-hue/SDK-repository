import { RestrictedGatewayAdapter, createManifest, type RestrictedGatewayAdapterConfig } from "./base.js";

export class TelnexaAdapter extends RestrictedGatewayAdapter {
  constructor(config: RestrictedGatewayAdapterConfig) {
    super(
      createManifest({
        key: "telnexa",
        displayName: "Telnexa SMS",
        operations: [
          {
            name: "sms.send",
            mutates: true,
            requiredCapabilities: ["sms.write", "sms.live_delivery"],
          },
          { name: "sms.cancel", mutates: true, requiredCapabilities: ["sms.write"] },
        ],
        webhookEventTypes: ["telnexa.delivery.status.v1", "telnexa.inbound.message.v1"],
      }),
      config,
    );
  }
}
