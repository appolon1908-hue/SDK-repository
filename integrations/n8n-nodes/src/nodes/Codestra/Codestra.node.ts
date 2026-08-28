import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IRequestOptions,
} from "n8n-workflow";

export class Codestra implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Codestra",
    name: "codestra",
    group: ["transform"],
    version: 1,
    description: "Call tenant-scoped Codestra Middleware APIs",
    defaults: { name: "Codestra" },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [{ name: "codestraApi", required: true }],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        default: "createSocialPost",
        options: [
          { name: "Create Social Post", value: "createSocialPost" },
          { name: "Get Social Post", value: "getSocialPost" },
          { name: "Create Webhook Subscription", value: "createWebhookSubscription" },
          { name: "List Webhook Subscriptions", value: "listWebhookSubscriptions" },
          { name: "Get Webhook Subscription", value: "getWebhookSubscription" },
          { name: "Test Webhook Subscription", value: "testWebhookSubscription" },
          { name: "Rotate Webhook Secret", value: "rotateWebhookSubscriptionSecret" },
          { name: "Enable Webhook Subscription", value: "enableWebhookSubscription" },
          { name: "Disable Webhook Subscription", value: "disableWebhookSubscription" },
          { name: "Delete Webhook Subscription", value: "deleteWebhookSubscription" },
        ],
      },
      {
        displayName: "Workspace ID",
        name: "workspaceId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { operation: ["createSocialPost"] } },
      },
      {
        displayName: "Channels",
        name: "channels",
        type: "string",
        default: "linkedin",
        required: true,
        description: "Comma-separated canonical channel names.",
        displayOptions: { show: { operation: ["createSocialPost"] } },
      },
      {
        displayName: "Text",
        name: "text",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { operation: ["createSocialPost"] } },
      },
      {
        displayName: "Publish At",
        name: "publishAt",
        type: "dateTime",
        default: "",
        displayOptions: { show: { operation: ["createSocialPost"] } },
      },
      {
        displayName: "Post ID",
        name: "postId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { operation: ["getSocialPost"] } },
      },
      {
        displayName: "Endpoint URL",
        name: "endpointUrl",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { operation: ["createWebhookSubscription"] } },
      },
      {
        displayName: "Webhook Subscription ID",
        name: "subscriptionId",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: {
            operation: [
              "getWebhookSubscription",
              "testWebhookSubscription",
              "rotateWebhookSubscriptionSecret",
              "enableWebhookSubscription",
              "disableWebhookSubscription",
              "deleteWebhookSubscription",
            ],
          },
        },
      },
      {
        displayName: "Event Types",
        name: "eventTypes",
        type: "string",
        default: "codestra.social.post.status.v1",
        required: true,
        displayOptions: { show: { operation: ["createWebhookSubscription"] } },
      },
      {
        displayName: "Idempotency Key",
        name: "idempotencyKey",
        type: "string",
        default: "={{$execution.id}}-{{$itemIndex}}",
        required: true,
        displayOptions: { hide: { operation: ["getSocialPost", "listWebhookSubscriptions", "getWebhookSubscription"] } },
      },
      {
        displayName: "Correlation ID",
        name: "correlationId",
        type: "string",
        default: "={{$execution.id}}",
        required: true,
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = await this.getCredentials("codestraApi");
    const baseUrl = normalizeBaseUrl(requireString(credentials.baseUrl, "baseUrl"));
    const output: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const operation = requireString(this.getNodeParameter("operation", itemIndex), "operation");
      const correlationId = requireHeaderValue(
        this.getNodeParameter("correlationId", itemIndex),
        "correlationId",
      );
      const headers: Record<string, string> = {
        accept: "application/json",
        "cache-control": "no-store",
        "x-correlation-id": correlationId,
      };
      const request: IRequestOptions = {
        method: "GET",
        url: baseUrl,
        headers,
        json: true,
        timeout: 15_000,
        returnFullResponse: false,
      };

      if (operation === "createSocialPost") {
        request.method = "POST";
        request.url = `${baseUrl}/v1/social/posts`;
        headers["idempotency-key"] = requireIdempotencyKey(
          this.getNodeParameter("idempotencyKey", itemIndex),
        );
        const publishAt = optionalString(this.getNodeParameter("publishAt", itemIndex, ""));
        const body: IDataObject = {
          workspaceId: requireString(this.getNodeParameter("workspaceId", itemIndex), "workspaceId"),
          channels: commaSeparated(this.getNodeParameter("channels", itemIndex), "channels"),
          content: { text: requireString(this.getNodeParameter("text", itemIndex), "text") },
        };
        if (publishAt !== undefined) body.publishAt = publishAt;
        request.body = body;
      } else if (operation === "getSocialPost") {
        const postId = requireString(this.getNodeParameter("postId", itemIndex), "postId");
        request.url = `${baseUrl}/v1/social/posts/${encodeURIComponent(postId)}`;
      } else if (operation === "createWebhookSubscription") {
        request.method = "POST";
        request.url = `${baseUrl}/v1/webhook-subscriptions`;
        headers["idempotency-key"] = requireIdempotencyKey(
          this.getNodeParameter("idempotencyKey", itemIndex),
        );
        request.body = {
          endpointUrl: requireHttpsUrl(this.getNodeParameter("endpointUrl", itemIndex)),
          eventTypes: commaSeparated(this.getNodeParameter("eventTypes", itemIndex), "eventTypes"),
        };
      } else if (operation === "listWebhookSubscriptions") {
        request.url = `${baseUrl}/v1/webhook-subscriptions`;
      } else if (operation === "getWebhookSubscription") {
        request.url = `${baseUrl}/v1/webhook-subscriptions/${encodeURIComponent(requireString(this.getNodeParameter("subscriptionId", itemIndex), "subscriptionId"))}`;
      } else if (operation === "testWebhookSubscription") {
        request.method = "POST";
        request.url = `${baseUrl}/v1/webhook-subscriptions/${encodeURIComponent(requireString(this.getNodeParameter("subscriptionId", itemIndex), "subscriptionId"))}/test`;
        headers["idempotency-key"] = requireIdempotencyKey(this.getNodeParameter("idempotencyKey", itemIndex));
      } else if (operation === "rotateWebhookSubscriptionSecret") {
        request.method = "POST";
        request.url = `${baseUrl}/v1/webhook-subscriptions/${encodeURIComponent(requireString(this.getNodeParameter("subscriptionId", itemIndex), "subscriptionId"))}/rotate-secret`;
        headers["idempotency-key"] = requireIdempotencyKey(this.getNodeParameter("idempotencyKey", itemIndex));
      } else if (operation === "enableWebhookSubscription") {
        request.method = "POST";
        request.url = `${baseUrl}/v1/webhook-subscriptions/${encodeURIComponent(requireString(this.getNodeParameter("subscriptionId", itemIndex), "subscriptionId"))}/enable`;
        headers["idempotency-key"] = requireIdempotencyKey(this.getNodeParameter("idempotencyKey", itemIndex));
      } else if (operation === "disableWebhookSubscription") {
        request.method = "POST";
        request.url = `${baseUrl}/v1/webhook-subscriptions/${encodeURIComponent(requireString(this.getNodeParameter("subscriptionId", itemIndex), "subscriptionId"))}/disable`;
        headers["idempotency-key"] = requireIdempotencyKey(this.getNodeParameter("idempotencyKey", itemIndex));
      } else if (operation === "deleteWebhookSubscription") {
        request.method = "DELETE";
        request.url = `${baseUrl}/v1/webhook-subscriptions/${encodeURIComponent(requireString(this.getNodeParameter("subscriptionId", itemIndex), "subscriptionId"))}`;
        headers["idempotency-key"] = requireIdempotencyKey(this.getNodeParameter("idempotencyKey", itemIndex));
      } else {
        throw new Error(`Unsupported Codestra operation: ${operation}`);
      }

      const result = await this.helpers.httpRequestWithAuthentication.call(this, "codestraApi", request);
      output.push({ json: toDataObject(result), pairedItem: { item: itemIndex } });
    }

    return [output];
  }
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Codestra Base URL must use HTTPS except on loopback development hosts.");
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("Codestra Base URL is invalid.");
  return url.toString().replace(/\/$/u, "");
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function requireHeaderValue(value: unknown, name: string): string {
  const normalized = requireString(value, name);
  if (/[\r\n]/u.test(normalized)) throw new Error(`${name} must be a single-line value.`);
  return normalized;
}

function requireIdempotencyKey(value: unknown): string {
  const key = requireHeaderValue(value, "idempotencyKey");
  if (key.length < 16 || key.length > 128) throw new Error("idempotencyKey must contain 16 to 128 characters.");
  return key;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function commaSeparated(value: unknown, name: string): string[] {
  const values = requireString(value, name)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length === 0) throw new Error(`${name} must contain at least one value.`);
  return [...new Set(values)];
}

function requireHttpsUrl(value: unknown): string {
  const url = new URL(requireString(value, "endpointUrl"));
  if (url.protocol !== "https:") throw new Error("endpointUrl must use HTTPS.");
  return url.toString();
}

function toDataObject(value: unknown): IDataObject {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as IDataObject;
  return { data: value };
}
