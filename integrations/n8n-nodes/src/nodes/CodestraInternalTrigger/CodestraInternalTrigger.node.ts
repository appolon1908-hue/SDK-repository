import type {
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from "n8n-workflow";
import { acceptSignedInternalEvent, InternalEventBoundaryError } from "../../internal-event-boundary.js";

export class CodestraInternalTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Codestra Internal Event Trigger",
    name: "codestraInternalTrigger",
    group: ["trigger"],
    version: 1,
    description: "Receive normalized events from Codestra Middleware on a private, restricted route",
    defaults: { name: "Codestra Internal Event Trigger" },
    inputs: [],
    outputs: ["main"],
    credentials: [{ name: "codestraInternalWebhook", required: true }],
    webhooks: [
      {
        name: "default",
        httpMethod: "POST",
        responseMode: "onReceived",
        path: "codestra-internal-events",
      },
    ],
    properties: [],
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const rawBody = typeof this.getRawBodyData === "function" ? await this.getRawBodyData() : undefined;
    if (rawBody === undefined) {
      return {
        webhookResponse: { status: 400, body: { error: "raw_body_unavailable" } },
        workflowData: [[]],
      };
    }
    try {
      const accepted = await acceptSignedInternalEvent({
        headers: this.getHeaderData(),
        rawBody,
        credentials: await this.getCredentials("codestraInternalWebhook"),
      });
      return {
        webhookResponse: { status: 202, body: { accepted: true, deliveryId: accepted.delivery.deliveryId } },
        workflowData: [this.helpers.returnJsonArray([{ event: accepted.event, delivery: accepted.delivery }])],
      };
    } catch (error) {
      if (error instanceof InternalEventBoundaryError) {
        return {
          webhookResponse: { status: error.status, body: { error: error.code, retryable: error.retryable } },
          workflowData: [[]],
        };
      }
      throw error;
    }
  }
}
