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
