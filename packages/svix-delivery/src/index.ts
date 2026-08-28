import type { CloudEvent, JsonObject, UUID } from "@codestra/contracts";

export interface SvixMessageInput {
  eventType: string;
  eventId: string;
  payload: JsonObject;
  payloadRetentionPeriod?: number;
}

export interface SvixMessageResponse {
  id: string;
  eventId?: string;
}

export interface SvixClientLike {
  message: {
    create(
      applicationId: string,
      message: SvixMessageInput,
      options: { idempotencyKey: string },
    ): Promise<SvixMessageResponse>;
  };
}

export interface SvixApplicationResolver {
  resolveApplicationId(tenantId: UUID): Promise<string>;
}

export interface SvixDeliveryServiceOptions {
  enabled?: boolean;
  client: SvixClientLike;
  applicationResolver: SvixApplicationResolver;
  payloadRetentionPeriodDays?: number;
}

export interface SvixDeliveryCommand {
  tenantId: UUID;
  idempotencyKey: string;
  event: CloudEvent<JsonObject>;
}

export interface SvixDeliveryReceipt {
  provider: "svix";
  messageId: string;
  eventId: string;
  applicationId: string;
}

export class SvixDeliveryError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable = false, options?: ErrorOptions) {
    super(message, options);
    this.name = "SvixDeliveryError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class SvixDeliveryService {
  private readonly enabled: boolean;
  private readonly client: SvixClientLike;
  private readonly applicationResolver: SvixApplicationResolver;
  private readonly payloadRetentionPeriodDays: number;

  constructor(options: SvixDeliveryServiceOptions) {
    this.enabled = options.enabled ?? false;
    this.client = options.client;
    this.applicationResolver = options.applicationResolver;
    this.payloadRetentionPeriodDays = integerBetween(
      options.payloadRetentionPeriodDays ?? 14,
      1,
      90,
      "payloadRetentionPeriodDays",
    );
  }

  async deliver(command: SvixDeliveryCommand): Promise<SvixDeliveryReceipt> {
    if (!this.enabled) {
      throw new SvixDeliveryError("Svix delivery is disabled.", "SVIX_DELIVERY_DISABLED");
    }
    const tenantId = requireSingleLine(command.tenantId, "tenantId");
    const idempotencyKey = requireIdempotencyKey(command.idempotencyKey);
    validateCloudEvent(command.event);
    const applicationId = requireSingleLine(
      await this.applicationResolver.resolveApplicationId(tenantId),
      "applicationId",
    );

    try {
      const response = await this.client.message.create(
        applicationId,
        {
          eventType: command.event.type,
          eventId: command.event.id,
          payload: command.event as unknown as JsonObject,
          payloadRetentionPeriod: this.payloadRetentionPeriodDays,
        },
        { idempotencyKey },
      );
      return {
        provider: "svix",
        messageId: requireSingleLine(response.id, "messageId"),
        eventId: command.event.id,
        applicationId,
      };
    } catch (error) {
      if (error instanceof SvixDeliveryError) throw error;
      throw new SvixDeliveryError(
        "Svix did not accept the canonical event.",
        "SVIX_HANDOFF_FAILED",
        true,
        { cause: error },
      );
    }
  }
}

function validateCloudEvent(event: CloudEvent<JsonObject>): void {
  if (event.specversion !== "1.0") {
    throw new SvixDeliveryError("Only CloudEvents 1.0 are supported.", "INVALID_CLOUD_EVENT");
  }
  requireSingleLine(event.id, "event.id");
  requireSingleLine(event.type, "event.type");
  requireSingleLine(event.source, "event.source");
  if (!Number.isFinite(Date.parse(event.time))) {
    throw new SvixDeliveryError("event.time must be an ISO date-time.", "INVALID_CLOUD_EVENT");
  }
}

function requireIdempotencyKey(value: string): string {
  const normalized = requireSingleLine(value, "idempotencyKey");
  if (normalized.length < 16 || normalized.length > 128) {
    throw new SvixDeliveryError(
      "idempotencyKey must contain between 16 and 128 characters.",
      "INVALID_IDEMPOTENCY_KEY",
    );
  }
  return normalized;
}

function requireSingleLine(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized || /[\r\n]/u.test(normalized)) {
    throw new SvixDeliveryError(`${name} must be a non-empty single-line value.`, "INVALID_DELIVERY_COMMAND");
  }
  return normalized;
}

function integerBetween(value: number, minimum: number, maximum: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}
