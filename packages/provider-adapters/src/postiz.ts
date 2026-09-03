import { RestrictedGatewayAdapter, createManifest, type RestrictedGatewayAdapterConfig } from "./base.js";

export class PostizAdapter extends RestrictedGatewayAdapter {
  constructor(config: RestrictedGatewayAdapterConfig) {
    super(
      createManifest({
        key: "postiz",
        displayName: "Postiz Social Publishing",
        operations: [
          {
            name: "social.post.create",
            mutates: true,
            requiredCapabilities: ["social.write", "social.external_delivery"],
          },
          {
            name: "social.post.cancel",
            mutates: true,
            requiredCapabilities: ["social.write"],
          },
        ],
        webhookEventTypes: ["postiz.post.status.v1"],
      }),
      config,
    );
  }
}
