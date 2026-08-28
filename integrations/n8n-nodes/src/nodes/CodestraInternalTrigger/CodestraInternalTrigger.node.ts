import type {
  IDataObject,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from "n8n-workflow";

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
    credentials: [{ name: "codestraApi", required: true }],
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
    const credentials = await this.getCredentials("codestraApi");
    const expected = requireToken(credentials.internalWebhookToken);
    const headers = this.getHeaderData();
    const suppliedHeader = headers["x-codestra-n8n-token"];
    const supplied = Array.isArray(suppliedHeader) ? suppliedHeader[0] : suppliedHeader;
    if (typeof supplied !== "string" || !constantTimeStringEqual(expected, supplied)) {
      return {
        webhookResponse: { status: 401, body: { error: "unauthorized" } },
        workflowData: [[]],
      };
    }

    const body = this.getBodyData();
    validateCanonicalEvent(body);
    return {
      webhookResponse: { status: 202, body: { accepted: true } },
      workflowData: [this.helpers.returnJsonArray([body])],
    };
  }
}

function requireToken(value: unknown): string {
  if (typeof value !== "string" || value.length < 32 || /[\r\n]/u.test(value)) {
    throw new Error("The internal Codestra trigger token must contain at least 32 single-line characters.");
  }
  return value;
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index % leftBytes.length] ?? 0) ^ (rightBytes[index % rightBytes.length] ?? 0);
  }
  return difference === 0;
}

function validateCanonicalEvent(value: IDataObject): void {
  for (const key of ["specversion", "id", "source", "type", "time", "data"]) {
    if (!(key in value)) throw new Error(`Canonical event is missing ${key}.`);
  }
  if (value.specversion !== "1.0") throw new Error("Only CloudEvents 1.0 are accepted.");
}
