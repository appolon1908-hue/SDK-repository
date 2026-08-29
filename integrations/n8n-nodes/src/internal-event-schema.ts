import type { CodestraCanonicalEvent, CodestraInternalWebhookConfig } from "./internal-event-model.js";
import { InternalEventBoundaryError } from "./internal-event-model.js";
import {
  integerBetween,
  rejectUnknownKeys,
  requireAbsoluteUri,
  requireArray,
  requireDateTime,
  requireEnum,
  requireObject,
  requireString,
  requireUuid,
} from "./internal-event-primitives.js";

const decoder = new TextDecoder("utf-8", { fatal: true });
const EVENT_KEYS = new Set(["specversion", "id", "tenantid", "source", "type", "subject", "time", "datacontenttype", "dataschema", "data"]);
const SOCIAL_STATUSES = new Set(["accepted", "scheduled", "publishing", "published", "partially_published", "failed", "cancelled"]);
const SOCIAL_CHANNELS = new Set(["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"]);
const WEBHOOK_DELIVERY_STATUSES = new Set(["queued", "attempting", "delivered", "failed", "dead_lettered"]);
const CALL_DISPOSITIONS = new Set([
  "answered",
  "no_answer",
  "busy",
  "voicemail",
  "dnc",
  "callback_requested",
  "sale_completed",
  "failed",
  "dropped",
  "not_interested",
  "unknown",
]);

export function parseAndValidateCanonicalEvent(
  rawBody: Uint8Array,
  config: CodestraInternalWebhookConfig,
  tenantId: string,
): CodestraCanonicalEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(rawBody));
  } catch (error) {
    throw new InternalEventBoundaryError("The signed event body must be valid UTF-8 JSON.", "INVALID_EVENT_BODY", { status: 400, cause: error });
  }

  const event = requireObject(parsed, "event");
  rejectUnknownKeys(event, EVENT_KEYS, "event");
  if (event.specversion !== "1.0") throw new InternalEventBoundaryError("Only CloudEvents 1.0 are accepted.", "INVALID_EVENT_SPECVERSION", { status: 422 });
  if (event.datacontenttype !== "application/json") {
    throw new InternalEventBoundaryError("event.datacontenttype must be application/json.", "INVALID_EVENT_CONTENT_TYPE", { status: 422 });
  }

  const eventTenantId = requireUuid(event.tenantid, "event.tenantid");
  const eventType = requireString(event.type, "event.type", 200);
  const eventSource = requireString(event.source, "event.source", 512);
  if (eventTenantId !== tenantId) {
    throw new InternalEventBoundaryError("The event tenant does not match the authenticated tenant.", "EVENT_TENANT_MISMATCH", { status: 403 });
  }
  if (!config.allowedEventTypes.has(eventType)) {
    throw new InternalEventBoundaryError("The event type is not allowlisted.", "EVENT_TYPE_NOT_ALLOWED", { status: 403 });
  }
  if (!config.allowedSourcePrefixes.some((prefix) => eventSource.startsWith(prefix))) {
    throw new InternalEventBoundaryError("The event source is not allowlisted.", "EVENT_SOURCE_NOT_ALLOWED", { status: 403 });
  }

  const base = {
    specversion: "1.0" as const,
    id: requireUuid(event.id, "event.id"),
    tenantid: eventTenantId,
    source: eventSource,
    time: requireDateTime(event.time, "event.time"),
    datacontenttype: "application/json" as const,
    ...(event.subject === undefined ? {} : { subject: requireString(event.subject, "event.subject", 512) }),
    ...(event.dataschema === undefined ? {} : { dataschema: requireAbsoluteUri(event.dataschema, "event.dataschema") }),
  };

  if (eventType === "codestra.social.post.status.v1") {
    return { ...base, type: eventType, data: validateSocialData(event.data, tenantId) };
  }
  if (eventType === "codestra.webhook.delivery.status.v1") {
    return { ...base, type: eventType, data: validateWebhookDeliveryData(event.data) };
  }
  if (eventType === "call_disposition_updated") {
    return { ...base, type: eventType, data: validateCallDispositionData(event.data) };
  }
  if (eventType === "sms_received") {
    return { ...base, type: eventType, data: validateSmsReceivedData(event.data) };
  }
  throw new InternalEventBoundaryError("No schema validator exists for the allowlisted event type.", "EVENT_SCHEMA_NOT_SUPPORTED", { status: 422 });
}

function validateSocialData(value: unknown, tenantId: string): Record<string, unknown> {
  const data = requireObject(value, "event.data");
  rejectUnknownKeys(data, new Set(["postId", "tenantId", "previousStatus", "status", "deliveries", "occurredAt"]), "event.data");
  if (requireUuid(data.tenantId, "event.data.tenantId") !== tenantId) {
    throw new InternalEventBoundaryError("The event data tenant does not match the signed event tenant.", "EVENT_TENANT_MISMATCH", { status: 403 });
  }
  return {
    postId: requireUuid(data.postId, "event.data.postId"),
    tenantId,
    ...(data.previousStatus === undefined ? {} : { previousStatus: requireEnum(data.previousStatus, SOCIAL_STATUSES, "event.data.previousStatus") }),
    status: requireEnum(data.status, SOCIAL_STATUSES, "event.data.status"),
    deliveries: requireArray(data.deliveries, "event.data.deliveries").map((entry, index) => validateDelivery(entry, index)),
    occurredAt: requireDateTime(data.occurredAt, "event.data.occurredAt"),
  };
}

function validateDelivery(value: unknown, index: number): Record<string, unknown> {
  const delivery = requireObject(value, `event.data.deliveries[${index}]`);
  rejectUnknownKeys(delivery, new Set(["channel", "status", "externalId", "failureCode", "failureMessage"]), `event.data.deliveries[${index}]`);
  return {
    channel: requireEnum(delivery.channel, SOCIAL_CHANNELS, `event.data.deliveries[${index}].channel`),
    status: requireEnum(delivery.status, SOCIAL_STATUSES, `event.data.deliveries[${index}].status`),
    ...(delivery.externalId === undefined ? {} : { externalId: requireString(delivery.externalId, `event.data.deliveries[${index}].externalId`, 500) }),
    ...(delivery.failureCode === undefined ? {} : { failureCode: requireString(delivery.failureCode, `event.data.deliveries[${index}].failureCode`, 200) }),
    ...(delivery.failureMessage === undefined ? {} : { failureMessage: requireString(delivery.failureMessage, `event.data.deliveries[${index}].failureMessage`, 2_000) }),
  };
}

function validateWebhookDeliveryData(value: unknown): Record<string, unknown> {
  const data = requireObject(value, "event.data");
  rejectUnknownKeys(data, new Set(["deliveryId", "endpointId", "status", "attempt", "occurredAt"]), "event.data");
  return {
    deliveryId: requireUuid(data.deliveryId, "event.data.deliveryId"),
    endpointId: requireUuid(data.endpointId, "event.data.endpointId"),
    status: requireEnum(data.status, WEBHOOK_DELIVERY_STATUSES, "event.data.status"),
    ...(data.attempt === undefined ? {} : { attempt: integerBetween(data.attempt, 0, 1_000_000, "event.data.attempt") }),
    occurredAt: requireDateTime(data.occurredAt, "event.data.occurredAt"),
  };
}

function validateCallDispositionData(value: unknown): Record<string, unknown> {
  const data = requireObject(value, "event.data");
  rejectUnknownKeys(
    data,
    new Set([
      "event_type",
      "correlation_id",
      "causation_id",
      "odoo_contact_id",
      "odoo_lead_id",
      "disposition",
      "phone_number",
      "duration_seconds",
      "campaign_id",
      "provider_call_id",
      "dry_run",
    ]),
    "event.data",
  );
  if (data.event_type !== "call_disposition_updated") {
    throw new InternalEventBoundaryError("event.data.event_type must match the event type.", "INVALID_EVENT_TYPE", { status: 422 });
  }
  return {
    event_type: "call_disposition_updated",
    correlation_id: requireUuid(data.correlation_id, "event.data.correlation_id"),
    causation_id: requireString(data.causation_id, "event.data.causation_id", 200),
    ...(data.odoo_contact_id === undefined ? {} : { odoo_contact_id: optionalNullableInteger(data.odoo_contact_id, "event.data.odoo_contact_id") }),
    ...(data.odoo_lead_id === undefined ? {} : { odoo_lead_id: optionalNullableInteger(data.odoo_lead_id, "event.data.odoo_lead_id") }),
    disposition: requireEnum(data.disposition, CALL_DISPOSITIONS, "event.data.disposition"),
    phone_number: requireE164(data.phone_number, "event.data.phone_number"),
    ...(data.duration_seconds === undefined ? {} : { duration_seconds: integerBetween(data.duration_seconds, 0, 86_400, "event.data.duration_seconds") }),
    ...(data.campaign_id === undefined ? {} : { campaign_id: optionalNullableString(data.campaign_id, "event.data.campaign_id", 200) }),
    provider_call_id: requireString(data.provider_call_id, "event.data.provider_call_id", 200),
    ...(data.dry_run === undefined ? {} : { dry_run: requireBoolean(data.dry_run, "event.data.dry_run") }),
  };
}

function validateSmsReceivedData(value: unknown): Record<string, unknown> {
  const data = requireObject(value, "event.data");
  rejectUnknownKeys(
    data,
    new Set([
      "event_type",
      "correlation_id",
      "causation_id",
      "odoo_contact_id",
      "odoo_message_id",
      "from_number",
      "body_preview",
      "provider_event_id",
      "dry_run",
    ]),
    "event.data",
  );
  if (data.event_type !== "sms_received") {
    throw new InternalEventBoundaryError("event.data.event_type must match the event type.", "INVALID_EVENT_TYPE", { status: 422 });
  }
  return {
    event_type: "sms_received",
    correlation_id: requireUuid(data.correlation_id, "event.data.correlation_id"),
    causation_id: requireString(data.causation_id, "event.data.causation_id", 200),
    ...(data.odoo_contact_id === undefined ? {} : { odoo_contact_id: optionalNullableInteger(data.odoo_contact_id, "event.data.odoo_contact_id") }),
    ...(data.odoo_message_id === undefined ? {} : { odoo_message_id: optionalNullableInteger(data.odoo_message_id, "event.data.odoo_message_id") }),
    from_number: requireE164(data.from_number, "event.data.from_number"),
    body_preview: requireString(data.body_preview, "event.data.body_preview", 120, true),
    provider_event_id: requireString(data.provider_event_id, "event.data.provider_event_id", 200),
    ...(data.dry_run === undefined ? {} : { dry_run: requireBoolean(data.dry_run, "event.data.dry_run") }),
  };
}

function optionalNullableInteger(value: unknown, path: string): number | null {
  if (value === null) return null;
  return integerBetween(value, 0, 2_147_483_647, path);
}

function optionalNullableString(value: unknown, path: string, max: number): string | null {
  if (value === null) return null;
  return requireString(value, path, max);
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new InternalEventBoundaryError(`${path} must be a boolean.`, "INVALID_BOOLEAN", { status: 422 });
  }
  return value;
}

function requireE164(value: unknown, path: string): string {
  const text = requireString(value, path, 32);
  if (!/^\+[1-9]\d{1,14}$/u.test(text)) {
    throw new InternalEventBoundaryError(`${path} must be an E.164 phone number.`, "INVALID_PHONE_NUMBER", { status: 422 });
  }
  return text;
}
