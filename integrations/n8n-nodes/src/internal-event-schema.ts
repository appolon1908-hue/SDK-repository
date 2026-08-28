import type {
  CodestraCanonicalEvent,
  SocialPostStatusEventData,
  WebhookDeliveryStatusEventData,
} from "./internal-event-contracts.js";
import type { CodestraInternalWebhookConfig } from "./internal-event-model.js";
import { InternalEventBoundaryError } from "./internal-event-model.js";
import {
  rejectUnknownKeys,
  requireAbsoluteUri,
  requireArray,
  requireBoundedHeader,
  requireDateTime,
  requireEnum,
  requireObject,
  requireString,
  requireUuid,
  integerBetween,
} from "./internal-event-primitives.js";

const decoder = new TextDecoder("utf-8", { fatal: true });
const SOCIAL_STATUSES = new Set([
  "accepted", "scheduled", "publishing", "published", "partially_published", "failed", "cancelled",
]);
const SOCIAL_CHANNELS = new Set(["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"]);
const WEBHOOK_DELIVERY_STATUSES = new Set(["queued", "attempting", "delivered", "failed", "dead_lettered"]);
const EVENT_KEYS = new Set([
  "specversion", "id", "tenantid", "source", "type", "subject", "time", "datacontenttype", "dataschema", "data",
]);

export function parseAndValidateCanonicalEvent(
  rawBody: Uint8Array,
  config: CodestraInternalWebhookConfig,
  tenantId: string,
): CodestraCanonicalEvent {
  let source: string;
  try {
    source = decoder.decode(rawBody);
  } catch (error) {
    throw new InternalEventBoundaryError("The signed event body is not valid UTF-8.", "INVALID_EVENT_ENCODING", {
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new InternalEventBoundaryError("The signed event body is not valid JSON.", "INVALID_EVENT_JSON", {
      cause: error,
    });
  }

  const event = requireObject(parsed, "event");
  rejectUnknownKeys(event, EVENT_KEYS, "event");
  if (event.specversion !== "1.0") {
    throw new InternalEventBoundaryError("Only CloudEvents 1.0 are accepted.", "INVALID_EVENT_SPECVERSION");
  }
  const eventId = requireUuid(event.id, "event.id");
  const eventTenantId = requireUuid(event.tenantid, "event.tenantid");
  const eventSource = requireBoundedHeader(event.source, "event.source", 1, 512);
  const eventType = requireBoundedHeader(event.type, "event.type", 1, 200);
  const eventTime = requireDateTime(event.time, "event.time");
  if (event.datacontenttype !== "application/json") {
    throw new InternalEventBoundaryError(
      "event.datacontenttype must be application/json.",
      "INVALID_EVENT_CONTENT_TYPE",
    );
  }
  if (eventTenantId !== tenantId) {
    throw new InternalEventBoundaryError(
      "The signed event tenant does not match the authenticated tenant header.",
      "EVENT_TENANT_MISMATCH",
      { status: 403 },
    );
  }
  if (!config.allowedEventTypes.has(eventType)) {
    throw new InternalEventBoundaryError("The event type is not allowlisted for this workflow.", "EVENT_TYPE_NOT_ALLOWED", {
      status: 403,
    });
  }
  if (!config.allowedSourcePrefixes.some((prefix) => eventSource.startsWith(prefix))) {
    throw new InternalEventBoundaryError("The event source is not allowlisted for this workflow.", "EVENT_SOURCE_NOT_ALLOWED", {
      status: 403,
    });
  }

  const base = {
    specversion: "1.0" as const,
    id: eventId,
    tenantid: eventTenantId,
    source: eventSource,
    type: eventType,
    time: eventTime,
    datacontenttype: "application/json" as const,
    ...(event.subject === undefined
      ? {}
      : { subject: requireBoundedHeader(event.subject, "event.subject", 1, 512) }),
    ...(event.dataschema === undefined
      ? {}
      : { dataschema: requireAbsoluteUri(event.dataschema, "event.dataschema") }),
  };

  if (eventType === "codestra.social.post.status.v1") {
    const data = validateSocialPostStatusData(event.data, tenantId);
    return { ...base, type: eventType, data };
  }
  if (eventType === "codestra.webhook.delivery.status.v1") {
    const data = validateWebhookDeliveryStatusData(event.data);
    return { ...base, type: eventType, data };
  }
  throw new InternalEventBoundaryError("No validator exists for the allowlisted event type.", "EVENT_SCHEMA_NOT_SUPPORTED", {
    status: 422,
  });
}

function validateSocialPostStatusData(value: unknown, tenantId: string): SocialPostStatusEventData {
  const data = requireObject(value, "event.data");
  rejectUnknownKeys(
    data,
    new Set(["postId", "tenantId", "previousStatus", "status", "deliveries", "occurredAt"]),
    "event.data",
  );
  const dataTenantId = requireUuid(data.tenantId, "event.data.tenantId");
  if (dataTenantId !== tenantId) {
    throw new InternalEventBoundaryError(
      "The social event data tenant does not match the signed event tenant.",
      "EVENT_TENANT_MISMATCH",
      { status: 403 },
    );
  }
  const status = requireEnum(data.status, SOCIAL_STATUSES, "event.data.status");
  const deliveries = requireArray(data.deliveries, "event.data.deliveries").map((entry, index) => {
    const delivery = requireObject(entry, `event.data.deliveries[${index}]`);
    rejectUnknownKeys(
      delivery,
      new Set(["channel", "status", "externalId", "failureCode", "failureMessage"]),
      `event.data.deliveries[${index}]`,
    );
    return {
      channel: requireEnum(delivery.channel, SOCIAL_CHANNELS, `event.data.deliveries[${index}].channel`) as SocialPostStatusEventData["deliveries"][number]["channel"],
      status: requireEnum(delivery.status, SOCIAL_STATUSES, `event.data.deliveries[${index}].status`) as SocialPostStatusEventData["deliveries"][number]["status"],
      ...(delivery.externalId === undefined
        ? {}
        : { externalId: requireBoundedHeader(delivery.externalId, "externalId", 1, 500) }),
      ...(delivery.failureCode === undefined
        ? {}
        : { failureCode: requireBoundedHeader(delivery.failureCode, "failureCode", 1, 200) }),
      ...(delivery.failureMessage === undefined
        ? {}
        : { failureMessage: requireString(delivery.failureMessage, "failureMessage", 2_000) }),
    };
  });

  return {
    postId: requireUuid(data.postId, "event.data.postId"),
    tenantId: dataTenantId,
    ...(data.previousStatus === undefined
      ? {}
      : { previousStatus: requireEnum(data.previousStatus, SOCIAL_STATUSES, "event.data.previousStatus") as SocialPostStatusEventData["status"] }),
    status: status as SocialPostStatusEventData["status"],
    deliveries,
    occurredAt: requireDateTime(data.occurredAt, "event.data.occurredAt"),
  };
}

function validateWebhookDeliveryStatusData(value: unknown): WebhookDeliveryStatusEventData {
  const data = requireObject(value, "event.data");
  rejectUnknownKeys(
    data,
    new Set(["deliveryId", "endpointId", "status", "attempt", "occurredAt"]),
    "event.data",
  );
  return {
    deliveryId: requireUuid(data.deliveryId, "event.data.deliveryId"),
    endpointId: requireUuid(data.endpointId, "event.data.endpointId"),
    status: requireEnum(
      data.status,
      WEBHOOK_DELIVERY_STATUSES,
      "event.data.status",
    ) as WebhookDeliveryStatusEventData["status"],
    ...(data.attempt === undefined
      ? {}
      : { attempt: integerBetween(data.attempt, 0, 1_000_000, "event.data.attempt") }),
    occurredAt: requireDateTime(data.occurredAt, "event.data.occurredAt"),
  };
}
