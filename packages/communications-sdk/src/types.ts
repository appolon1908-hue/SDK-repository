import type { ISODateTime, JsonObject, UUID } from "@codestra/contracts";
export type {
  CommunicationDomain,
  CommunicationMessage,
  CommunicationMessageEvent,
  CommunicationMessageList,
  CommunicationPreference,
  CommunicationProviderHealth,
  CommunicationReputationReport,
  CommunicationSenderIdentity,
  CommunicationSuppression,
  CommunicationTemplate,
  CommunicationUsageReport,
  CreateCommunicationMessageInput,
} from "@codestra/contracts";

export type CommunicationChannel = "email" | "sms" | "voice";

export type CommunicationOperationState =
  | "persisted"
  | "queued"
  | "dispatching"
  | "accepted"
  | "readback_pending"
  | "completed"
  | "failed"
  | "reconciliation_required"
  | "dead_lettered";

export interface CodestraCommunicationsClientOptions {
  baseUrl: string;
  tenantId: string;
  requestedBy: string;
  getAccessToken: () => Promise<string> | string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  commandIdFactory?: () => string;
  correlationIdFactory?: () => string;
}

export interface CommunicationsRequestOptions {
  signal?: AbortSignal;
  correlationId?: string;
}

export interface CommunicationsMutationOptions extends CommunicationsRequestOptions {
  idempotencyKey: string;
  commandId?: UUID;
}

export interface CommunicationsListOptions extends CommunicationsRequestOptions {
  cursor?: string;
  limit?: number;
  channel?: CommunicationChannel;
  status?: string;
}

export interface CommunicationsDateRangeOptions extends CommunicationsRequestOptions {
  from?: ISODateTime;
  to?: ISODateTime;
}

export interface TemplateWriteInput {
  channel: CommunicationChannel;
  name: string;
  locale?: string;
  content: JsonObject;
  variables?: string[];
  metadata?: JsonObject;
}

export interface TemplateRenderInput {
  variables?: JsonObject;
  locale?: string;
}

export interface SenderIdentityWriteInput {
  channel: CommunicationChannel;
  address: string;
  displayName?: string;
  domainId?: UUID;
  metadata?: JsonObject;
}

export interface DomainCreateInput {
  domain: string;
  metadata?: JsonObject;
}

export interface SuppressionUpsertInput {
  channel: CommunicationChannel;
  subject: string;
  reason: "hard_bounce" | "complaint" | "unsubscribe" | "sms_opt_out" | "policy" | "manual";
  scope?: "tenant" | "global";
  source?: string;
  metadata?: JsonObject;
}

export interface PreferenceUpsertInput {
  subject: string;
  channel: CommunicationChannel;
  topic?: string;
  consent: "granted" | "denied" | "unknown";
  source?: string;
  metadata?: JsonObject;
}

export interface CommandOperation {
  command_id: UUID;
  tenant_id: string;
  command_type: string;
  command_version: "1.0";
  target: string;
  requested_by: string;
  correlation_id: string;
  idempotency_key: string;
  capability: string;
  state: CommunicationOperationState;
  provider_operation_id?: string | null;
  last_error?: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  duplicate: boolean;
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailContent {
  text?: string;
  html?: string;
}

export interface EmailTemplateReference {
  templateId: string;
  version?: string;
  locale?: string;
  variables?: JsonObject;
}

export interface SendEmailInput {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  content?: EmailContent;
  template?: EmailTemplateReference;
  metadata?: JsonObject;
  scheduledAt?: ISODateTime;
}

export interface SendEmailBatchInput {
  messages: SendEmailInput[];
  metadata?: JsonObject;
}

export interface SmsRecipient {
  phoneNumber: string;
}

export interface SendSmsInput {
  from?: string;
  to: SmsRecipient;
  body: string;
  mediaUrls?: string[];
  metadata?: JsonObject;
  scheduledAt?: ISODateTime;
}

export interface SendSmsBatchInput {
  messages: SendSmsInput[];
  metadata?: JsonObject;
}

export interface VoiceCallInput {
  from?: string;
  to: string;
  campaignId?: string;
  scriptId?: string;
  metadata?: JsonObject;
  scheduledAt?: ISODateTime;
}

export interface VoiceTransferInput {
  callId: string;
  destination: string;
  metadata?: JsonObject;
}

export interface CancelCommunicationInput {
  messageId?: string;
  operationId?: UUID;
  reason?: string;
}

export interface CommandEnvelope {
  command_id: UUID;
  command_type: string;
  command_version: "1.0";
  target: string;
  tenant_id: string;
  requested_by: string;
  correlation_id: string;
  idempotency_key: string;
  capability: string;
  payload: JsonObject;
}
