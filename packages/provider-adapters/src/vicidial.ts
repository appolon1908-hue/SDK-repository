import { RestrictedGatewayAdapter, createManifest, type RestrictedGatewayAdapterConfig } from "./base.js";

export class VicidialAdapter extends RestrictedGatewayAdapter {
  constructor(config: RestrictedGatewayAdapterConfig) {
    super(
      createManifest({
        key: "vicidial",
        displayName: "VICIdial Telephony",
        operations: [
          {
            name: "telephony.call.request",
            mutates: true,
            requiredCapabilities: ["telephony.write", "telephony.live_dialing"],
          },
          {
            name: "telephony.callback.schedule",
            mutates: true,
            requiredCapabilities: ["telephony.callback.write"],
          },
          { name: "telephony.call.cancel", mutates: true, requiredCapabilities: ["telephony.write"] },
        ],
        webhookEventTypes: ["vicidial.call.status.v1", "vicidial.call.disposition.v1"],
      }),
      config,
    );
  }
}
