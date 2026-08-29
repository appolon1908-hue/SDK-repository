import type { ICredentialType, INodeProperties } from "n8n-workflow";

export class CodestraInternalWebhook implements ICredentialType {
  name = "codestraInternalWebhook";
  displayName = "Codestra Internal Webhook";
  documentationUrl = "https://github.com/appolon1908-hue/SDK-repository";

  properties: INodeProperties[] = [
    {
      displayName: "Expected Tenant ID",
      name: "expectedTenantId",
      type: "string",
      default: "",
      required: true,
    },
    {
      displayName: "Webhook Signing Secrets",
      name: "webhookSecrets",
      type: "string",
      typeOptions: { password: true, rows: 4 },
      default: "",
      required: true,
    },
    {
      displayName: "Allowed Event Types",
      name: "allowedEventTypes",
      type: "string",
      typeOptions: { rows: 3 },
      default: "codestra.social.post.status.v1\ncodestra.webhook.delivery.status.v1\ncall_disposition_updated\nsms_received",
      required: true,
    },
    {
      displayName: "Allowed Source Prefixes",
      name: "allowedSourcePrefixes",
      type: "string",
      typeOptions: { rows: 3 },
      default: "urn:codestra:\n/codestra/",
      required: true,
    },
    {
      displayName: "Replay Guard Base URL",
      name: "replayGuardBaseUrl",
      type: "string",
      default: "https://api.codestra.co/internal/",
      required: true,
    },
    {
      displayName: "Replay Guard Access Token",
      name: "replayGuardAccessToken",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
    },
    {
      displayName: "Signature Tolerance Seconds",
      name: "timestampToleranceSeconds",
      type: "number",
      default: 300,
      required: true,
    },
    {
      displayName: "Maximum Body Bytes",
      name: "maxBodyBytes",
      type: "number",
      default: 1048576,
      required: true,
    },
    {
      displayName: "Replay Guard Timeout Milliseconds",
      name: "requestTimeoutMs",
      type: "number",
      default: 5000,
      required: true,
    },
  ];
}
