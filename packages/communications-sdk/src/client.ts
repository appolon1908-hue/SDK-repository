import type { CodestraErrorBody, JsonObject, UUID } from "@codestra/contracts";
import {
  CodestraCommunicationsApiError,
  CodestraCommunicationsConfigurationError,
  CodestraCommunicationsError,
  CodestraCommunicationsTimeoutError,
} from "./errors.js";
import type {
  CancelCommunicationInput,
  CodestraCommunicationsClientOptions,
  CommandEnvelope,
  CommandOperation,
  CommunicationsDateRangeOptions,
  CommunicationsListOptions,
  CommunicationsMutationOptions,
  CommunicationsRequestOptions,
  CreateCommunicationMessageInput,
  DomainCreateInput,
  PreferenceUpsertInput,
  SendEmailBatchInput,
  SendEmailInput,
  SendSmsBatchInput,
  SendSmsInput,
  SenderIdentityWriteInput,
  SuppressionUpsertInput,
  TemplateRenderInput,
  TemplateWriteInput,
  VoiceCallInput,
  VoiceTransferInput,
} from "./types.js";
import {
  parseCommandOperation,
  validateCancelCommunicationInput,
  validateSendEmailBatchInput,
  validateSendEmailInput,
  validateSendSmsBatchInput,
  validateSendSmsInput,
  validateVoiceCallInput,
  validateVoiceTransferInput,
  parseJsonObject,
} from "./validation.js";

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

interface CommandDefinition<TInput> {
  commandType: string;
  target: string;
  capability: string;
  validate: (input: TInput) => TInput;
}

interface SubmitCommandOptions<TInput> extends CommunicationsMutationOptions {
  definition: CommandDefinition<TInput>;
  input: TInput;
}

interface InternalRequestOptions extends CommunicationsRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  validate?: (value: unknown) => unknown;
}

export class CodestraCommunicationsClient {
  readonly email: {
    send: (input: SendEmailInput, options: CommunicationsMutationOptions) => Promise<CommandOperation>;
    sendBatch: (input: SendEmailBatchInput, options: CommunicationsMutationOptions) => Promise<CommandOperation>;
    get: (commandId: UUID, options?: CommunicationsRequestOptions) => Promise<CommandOperation>;
    cancel: (input: CancelCommunicationInput, options: CommunicationsMutationOptions) => Promise<CommandOperation>;
  };

  readonly sms: {
    send: (input: SendSmsInput, options: CommunicationsMutationOptions) => Promise<CommandOperation>;
    sendBatch: (input: SendSmsBatchInput, options: CommunicationsMutationOptions) => Promise<CommandOperation>;
    get: (commandId: UUID, options?: CommunicationsRequestOptions) => Promise<CommandOperation>;
    cancel: (input: CancelCommunicationInput, options: CommunicationsMutationOptions) => Promise<CommandOperation>;
  };

  readonly voice: {
    call: (input: VoiceCallInput, options: CommunicationsMutationOptions) => Promise<CommandOperation>;
    get: (commandId: UUID, options?: CommunicationsRequestOptions) => Promise<CommandOperation>;
    cancel: (input: CancelCommunicationInput, options: CommunicationsMutationOptions) => Promise<CommandOperation>;
    transfer: (input: VoiceTransferInput, options: CommunicationsMutationOptions) => Promise<CommandOperation>;
  };

  readonly operations: {
    get: (commandId: UUID, options?: CommunicationsRequestOptions) => Promise<CommandOperation>;
  };

  readonly messages: {
    list: (options?: CommunicationsListOptions) => Promise<JsonObject>;
    create: (input: CreateCommunicationMessageInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
    get: (messageId: UUID, options?: CommunicationsRequestOptions) => Promise<JsonObject>;
    events: (messageId: UUID, options?: CommunicationsListOptions) => Promise<JsonObject>;
    cancel: (messageId: UUID, input: CancelCommunicationInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
  };

  readonly templates: {
    list: (options?: CommunicationsListOptions) => Promise<JsonObject>;
    create: (input: TemplateWriteInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
    get: (templateId: UUID, options?: CommunicationsRequestOptions) => Promise<JsonObject>;
    update: (templateId: UUID, input: TemplateWriteInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
    archive: (templateId: UUID, options?: CommunicationsMutationOptions) => Promise<void>;
    render: (templateId: UUID, input: TemplateRenderInput, options?: CommunicationsRequestOptions) => Promise<JsonObject>;
  };

  readonly senderIdentities: {
    list: (options?: CommunicationsListOptions) => Promise<JsonObject>;
    create: (input: SenderIdentityWriteInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
    get: (senderIdentityId: UUID, options?: CommunicationsRequestOptions) => Promise<JsonObject>;
    update: (senderIdentityId: UUID, input: SenderIdentityWriteInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
  };

  readonly domains: {
    list: (options?: CommunicationsRequestOptions) => Promise<JsonObject>;
    create: (input: DomainCreateInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
    get: (domainId: UUID, options?: CommunicationsRequestOptions) => Promise<JsonObject>;
    verify: (domainId: UUID, options: CommunicationsMutationOptions) => Promise<JsonObject>;
  };

  readonly suppressions: {
    list: (options?: CommunicationsListOptions) => Promise<JsonObject>;
    upsert: (input: SuppressionUpsertInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
    delete: (suppressionId: UUID, options?: CommunicationsMutationOptions) => Promise<void>;
  };

  readonly preferences: {
    list: (options?: CommunicationsListOptions) => Promise<JsonObject>;
    upsert: (input: PreferenceUpsertInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
  };

  readonly providerHealth: {
    get: (options?: CommunicationsRequestOptions) => Promise<JsonObject>;
  };

  readonly usage: {
    get: (options?: CommunicationsDateRangeOptions) => Promise<JsonObject>;
  };

  readonly reputation: {
    get: (options?: CommunicationsRequestOptions) => Promise<JsonObject>;
  };

  private readonly baseUrl: URL;
  private readonly tenantId: string;
  private readonly requestedBy: string;
  private readonly getAccessToken: () => Promise<string> | string;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly commandIdFactory: () => string;
  private readonly correlationIdFactory: () => string;

  constructor(options: CodestraCommunicationsClientOptions) {
    this.baseUrl = validateBaseUrl(options.baseUrl);
    this.tenantId = requireHeaderValue(options.tenantId, "tenantId");
    this.requestedBy = requireHeaderValue(options.requestedBy, "requestedBy");
    this.getAccessToken = options.getAccessToken;
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.timeoutMs = requireNonNegativeInteger(options.timeoutMs ?? 10_000, "timeoutMs", false);
    this.maxRetries = requireNonNegativeInteger(options.maxRetries ?? 2, "maxRetries", true);
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.commandIdFactory = options.commandIdFactory ?? randomUuidFactory("commandIdFactory");
    this.correlationIdFactory = options.correlationIdFactory ?? randomUuidFactory("correlationIdFactory");

    if (typeof this.fetchImplementation !== "function") {
      throw new CodestraCommunicationsConfigurationError("A Fetch API implementation is required.");
    }

    this.operations = {
      get: (commandId, requestOptions) => this.getOperation(commandId, requestOptions),
    };

    this.messages = {
      list: (requestOptions) => this.getResource("/v1/communications/messages", requestOptions),
      create: (input, requestOptions) =>
        this.mutateResource("POST", "/v1/communications/messages", input, requestOptions),
      get: (messageId, requestOptions) =>
        this.getResource(`/v1/communications/messages/${encodeURIComponent(requireHeaderValue(messageId, "messageId"))}`, requestOptions),
      events: (messageId, requestOptions) =>
        this.getResource(`/v1/communications/messages/${encodeURIComponent(requireHeaderValue(messageId, "messageId"))}/events`, requestOptions),
      cancel: (messageId, input, requestOptions) =>
        this.mutateResource(
          "POST",
          `/v1/communications/messages/${encodeURIComponent(requireHeaderValue(messageId, "messageId"))}/cancel`,
          input,
          requestOptions,
        ),
    };

    this.templates = {
      list: (requestOptions) => this.getResource("/v1/communications/templates", requestOptions),
      create: (input, requestOptions) => this.mutateResource("POST", "/v1/communications/templates", input, requestOptions),
      get: (templateId, requestOptions) =>
        this.getResource(`/v1/communications/templates/${encodeURIComponent(requireUuid(templateId, "templateId"))}`, requestOptions),
      update: (templateId, input, requestOptions) =>
        this.mutateResource("PUT", `/v1/communications/templates/${encodeURIComponent(requireUuid(templateId, "templateId"))}`, input, requestOptions),
      archive: (templateId, requestOptions = { idempotencyKey: `archive:${templateId}` }) =>
        this.deleteResource(`/v1/communications/templates/${encodeURIComponent(requireUuid(templateId, "templateId"))}`, requestOptions),
      render: (templateId, input, requestOptions) =>
        this.request<JsonObject>({
          method: "POST",
          path: `/v1/communications/templates/${encodeURIComponent(requireUuid(templateId, "templateId"))}/render`,
          body: stripUndefined(input),
          validate: parseJsonObject,
          ...copyRequestOptions(requestOptions),
        }),
    };

    this.senderIdentities = {
      list: (requestOptions) => this.getResource("/v1/communications/sender-identities", requestOptions),
      create: (input, requestOptions) => this.mutateResource("POST", "/v1/communications/sender-identities", input, requestOptions),
      get: (senderIdentityId, requestOptions) =>
        this.getResource(`/v1/communications/sender-identities/${encodeURIComponent(requireUuid(senderIdentityId, "senderIdentityId"))}`, requestOptions),
      update: (senderIdentityId, input, requestOptions) =>
        this.mutateResource(
          "PUT",
          `/v1/communications/sender-identities/${encodeURIComponent(requireUuid(senderIdentityId, "senderIdentityId"))}`,
          input,
          requestOptions,
        ),
    };

    this.domains = {
      list: (requestOptions) => this.getResource("/v1/communications/domains", requestOptions),
      create: (input, requestOptions) => this.mutateResource("POST", "/v1/communications/domains", input, requestOptions),
      get: (domainId, requestOptions) =>
        this.getResource(`/v1/communications/domains/${encodeURIComponent(requireUuid(domainId, "domainId"))}`, requestOptions),
      verify: (domainId, requestOptions) =>
        this.mutateResource("POST", `/v1/communications/domains/${encodeURIComponent(requireUuid(domainId, "domainId"))}/verify`, {}, requestOptions),
    };

    this.suppressions = {
      list: (requestOptions) => this.getResource("/v1/communications/suppressions", requestOptions),
      upsert: (input, requestOptions) => this.mutateResource("POST", "/v1/communications/suppressions", input, requestOptions),
      delete: (suppressionId, requestOptions = { idempotencyKey: `delete:${suppressionId}` }) =>
        this.deleteResource(`/v1/communications/suppressions/${encodeURIComponent(requireUuid(suppressionId, "suppressionId"))}`, requestOptions),
    };

    this.preferences = {
      list: (requestOptions) => this.getResource("/v1/communications/preferences", requestOptions),
      upsert: (input, requestOptions) => this.mutateResource("POST", "/v1/communications/preferences", input, requestOptions),
    };

    this.providerHealth = {
      get: (requestOptions) => this.getResource("/v1/communications/provider-health", requestOptions),
    };

    this.usage = {
      get: (requestOptions) => this.getResource("/v1/communications/usage", requestOptions),
    };

    this.reputation = {
      get: (requestOptions) => this.getResource("/v1/communications/reputation", requestOptions),
    };

    this.email = {
      send: (input, requestOptions) =>
        this.submitCommand({
          input,
          definition: {
            commandType: "email.message.send.v1",
            target: "klyrow-email",
            capability: "EMAIL_DELIVERY",
            validate: validateSendEmailInput,
          },
          ...requestOptions,
        }),
      sendBatch: (input, requestOptions) =>
        this.submitCommand({
          input,
          definition: {
            commandType: "email.message.send_batch.v1",
            target: "klyrow-email",
            capability: "EMAIL_DELIVERY",
            validate: validateSendEmailBatchInput,
          },
          ...requestOptions,
        }),
      get: (commandId, requestOptions) => this.getOperation(commandId, requestOptions),
      cancel: (input, requestOptions) =>
        this.submitCommand({
          input,
          definition: {
            commandType: "email.message.cancel.v1",
            target: "klyrow-email",
            capability: "EMAIL_DELIVERY",
            validate: validateCancelCommunicationInput,
          },
          ...requestOptions,
        }),
    };

    this.sms = {
      send: (input, requestOptions) =>
        this.submitCommand({
          input,
          definition: {
            commandType: "sms.message.send.v1",
            target: "telnexa-sms",
            capability: "SMS_DELIVERY",
            validate: validateSendSmsInput,
          },
          ...requestOptions,
        }),
      sendBatch: (input, requestOptions) =>
        this.submitCommand({
          input,
          definition: {
            commandType: "sms.message.send_batch.v1",
            target: "telnexa-sms",
            capability: "SMS_DELIVERY",
            validate: validateSendSmsBatchInput,
          },
          ...requestOptions,
        }),
      get: (commandId, requestOptions) => this.getOperation(commandId, requestOptions),
      cancel: (input, requestOptions) =>
        this.submitCommand({
          input,
          definition: {
            commandType: "sms.message.cancel.v1",
            target: "telnexa-sms",
            capability: "SMS_DELIVERY",
            validate: validateCancelCommunicationInput,
          },
          ...requestOptions,
        }),
    };

    this.voice = {
      call: (input, requestOptions) =>
        this.submitCommand({
          input,
          definition: {
            commandType: "telephony.call.start.v1",
            target: "vicidial-restricted",
            capability: "PRODUCTION_DIALING",
            validate: validateVoiceCallInput,
          },
          ...requestOptions,
        }),
      get: (commandId, requestOptions) => this.getOperation(commandId, requestOptions),
      cancel: (input, requestOptions) =>
        this.submitCommand({
          input,
          definition: {
            commandType: "telephony.call.cancel.v1",
            target: "vicidial-restricted",
            capability: "PRODUCTION_DIALING",
            validate: validateCancelCommunicationInput,
          },
          ...requestOptions,
        }),
      transfer: (input, requestOptions) =>
        this.submitCommand({
          input,
          definition: {
            commandType: "telephony.call.transfer.v1",
            target: "vicidial-restricted",
            capability: "PRODUCTION_DIALING",
            validate: validateVoiceTransferInput,
          },
          ...requestOptions,
        }),
    };
  }

  private async submitCommand<TInput>(options: SubmitCommandOptions<TInput>): Promise<CommandOperation> {
    const correlationId = requireHeaderValue(options.correlationId ?? this.correlationIdFactory(), "correlationId");
    const idempotencyKey = requireIdempotencyKey(options.idempotencyKey);
    const commandId = requireUuid(options.commandId ?? this.commandIdFactory(), "commandId");
    const payload = stripUndefined(options.definition.validate(options.input)) as JsonObject;
    const envelope: CommandEnvelope = {
      command_id: commandId,
      command_type: options.definition.commandType,
      command_version: "1.0",
      target: options.definition.target,
      tenant_id: this.tenantId,
      requested_by: this.requestedBy,
      correlation_id: correlationId,
      idempotency_key: idempotencyKey,
      capability: options.definition.capability,
      payload,
    };

    return this.request<CommandOperation>({
      method: "POST",
      path: "/v1/commands",
      body: envelope,
      idempotencyKey,
      correlationId,
      validate: parseCommandOperation,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  }

  private async getOperation(commandId: UUID, options?: CommunicationsRequestOptions): Promise<CommandOperation> {
    return this.request<CommandOperation>({
      method: "GET",
      path: `/v1/operations/${encodeURIComponent(requireUuid(commandId, "commandId"))}`,
      validate: parseCommandOperation,
      ...copyRequestOptions(options),
    });
  }

  private async getResource(path: string, options?: CommunicationsListOptions | CommunicationsDateRangeOptions): Promise<JsonObject> {
    return this.request<JsonObject>({
      method: "GET",
      path: appendQuery(path, options),
      validate: parseJsonObject,
      ...copyRequestOptions(options),
    });
  }

  private async mutateResource(
    method: "POST" | "PUT",
    path: string,
    body: unknown,
    options: CommunicationsMutationOptions,
  ): Promise<JsonObject> {
    return this.request<JsonObject>({
      method,
      path,
      body: stripUndefined(body),
      idempotencyKey: options.idempotencyKey,
      validate: parseJsonObject,
      ...copyRequestOptions(options),
    });
  }

  private async deleteResource(path: string, options: CommunicationsMutationOptions): Promise<void> {
    return this.request<void>({
      method: "DELETE",
      path,
      idempotencyKey: options.idempotencyKey,
      ...copyRequestOptions(options),
    });
  }

  private async request<T>(options: InternalRequestOptions): Promise<T> {
    const correlationId = requireHeaderValue(options.correlationId ?? this.correlationIdFactory(), "correlationId");
    const token = requireHeaderValue(await this.getAccessToken(), "access token");
    const url = new URL(options.path.replace(/^\/+/, ""), ensureTrailingSlash(this.baseUrl));
    const canRetry = SAFE_METHODS.has(options.method) || options.idempotencyKey !== undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const timeout = createRequestSignal(options.signal, this.timeoutMs);
      const headers = new Headers({
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": this.tenantId,
        "X-Correlation-ID": correlationId,
      });

      if (options.body !== undefined) headers.set("Content-Type", "application/json");
      if (options.idempotencyKey !== undefined) headers.set("Idempotency-Key", requireIdempotencyKey(options.idempotencyKey));

      const requestInit: RequestInit = {
        method: options.method,
        headers,
        signal: timeout.signal,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
      };
      if (options.body !== undefined) requestInit.body = JSON.stringify(options.body);

      try {
        const response = await this.fetchImplementation(url, requestInit);
        if (response.ok) return parseValidatedSuccess<T>(await parseSuccess(response), options.validate);

        const apiError = await parseApiError(response, correlationId);
        lastError = apiError;
        if (!canRetry || attempt >= this.maxRetries || !RETRYABLE_STATUS_CODES.has(response.status)) {
          throw apiError;
        }

        await this.sleep(computeRetryDelay(response.headers.get("retry-after"), attempt));
      } catch (error) {
        if (timeout.signal.aborted) {
          if (options.signal?.aborted) {
            throw options.signal.reason instanceof Error
              ? options.signal.reason
              : new CodestraCommunicationsError("Codestra communications request was aborted.", "REQUEST_ABORTED");
          }
          throw new CodestraCommunicationsTimeoutError(this.timeoutMs);
        }

        if (error instanceof CodestraCommunicationsApiError) {
          if (!canRetry || attempt >= this.maxRetries || !error.retryable) throw error;
        } else if (error instanceof CodestraCommunicationsError) {
          throw error;
        } else if (!canRetry || attempt >= this.maxRetries) {
          throw new CodestraCommunicationsError(
            "Codestra communications request failed before a response was received.",
            "NETWORK_ERROR",
            { cause: error },
          );
        }

        lastError = error;
        await this.sleep(computeRetryDelay(null, attempt));
      } finally {
        timeout.cleanup();
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new CodestraCommunicationsError("Codestra communications request failed.", "UNKNOWN_REQUEST_ERROR");
  }
}

function copyRequestOptions(options: CommunicationsRequestOptions | undefined): CommunicationsRequestOptions {
  const copied: CommunicationsRequestOptions = {};
  if (options?.signal !== undefined) copied.signal = options.signal;
  if (options?.correlationId !== undefined) copied.correlationId = options.correlationId;
  return copied;
}

function validateBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CodestraCommunicationsConfigurationError("baseUrl must be an absolute URL.");
  }

  const isLocalDevelopment = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalDevelopment)) {
    throw new CodestraCommunicationsConfigurationError("baseUrl must use HTTPS except for loopback development.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new CodestraCommunicationsConfigurationError("baseUrl must not contain credentials, query parameters, or fragments.");
  }
  return url;
}

function ensureTrailingSlash(url: URL): URL {
  const copy = new URL(url);
  if (!copy.pathname.endsWith("/")) copy.pathname += "/";
  return copy;
}

function appendQuery(path: string, options: CommunicationsListOptions | CommunicationsDateRangeOptions | undefined): string {
  if (options === undefined) return path;
  const query = new URLSearchParams();
  for (const key of ["cursor", "limit", "channel", "status", "from", "to"] as const) {
    const value = options[key as keyof typeof options];
    if (value !== undefined) query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

function requireHeaderValue(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/u.test(trimmed)) {
    throw new CodestraCommunicationsConfigurationError(`${name} must be a non-empty single-line value.`);
  }
  return trimmed;
}

function requireIdempotencyKey(value: string): string {
  const key = requireHeaderValue(value, "idempotencyKey");
  if (key.length < 8 || key.length > 180) {
    throw new CodestraCommunicationsConfigurationError("idempotencyKey must contain between 8 and 180 characters.");
  }
  return key;
}

function requireUuid(value: string, name: string): UUID {
  const normalized = requireHeaderValue(value, name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(normalized)) {
    throw new CodestraCommunicationsConfigurationError(`${name} must be a UUID.`);
  }
  return normalized;
}

function requireNonNegativeInteger(value: number, name: string, allowZero: boolean): number {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new CodestraCommunicationsConfigurationError(`${name} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
  return value;
}

function randomUuidFactory(name: string): () => string {
  return () => {
    if (!globalThis.crypto?.randomUUID) {
      throw new CodestraCommunicationsConfigurationError(`A cryptographically secure randomUUID implementation is required for ${name}.`);
    }
    return globalThis.crypto.randomUUID();
  };
}

function createRequestSignal(externalSignal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  const timer = setTimeout(() => controller.abort(new CodestraCommunicationsTimeoutError(timeoutMs)), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    },
  };
}

async function parseSuccess<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new CodestraCommunicationsError("Codestra communications returned a successful non-JSON response.", "INVALID_RESPONSE");
  }
  return (await response.json()) as T;
}

function parseValidatedSuccess<T>(value: unknown, validate: ((value: unknown) => unknown) | undefined): T {
  return (validate === undefined ? value : validate(value)) as T;
}

async function parseApiError(response: Response, fallbackRequestId: string): Promise<CodestraCommunicationsApiError> {
  let body: Partial<CodestraErrorBody> | { error?: { correlation_id?: string; details?: JsonObject; retryable?: boolean; code?: string; message?: string } } | undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      body = (await response.json()) as typeof body;
    } catch {
      body = undefined;
    }
  }

  const error = body?.error;
  const requestId =
    error && "requestId" in error && typeof error.requestId === "string"
      ? error.requestId
      : error && "correlation_id" in error && typeof error.correlation_id === "string"
        ? error.correlation_id
        : response.headers.get("x-request-id") ?? response.headers.get("x-correlation-id") ?? fallbackRequestId;

  return new CodestraCommunicationsApiError({
    status: response.status,
    code: error?.code ?? `HTTP_${response.status}`,
    message: error?.message ?? `Codestra communications request failed with HTTP ${response.status}.`,
    requestId,
    retryable: error?.retryable ?? RETRYABLE_STATUS_CODES.has(response.status),
    ...(error?.details !== undefined ? { details: error.details } : {}),
  });
}

function computeRetryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 30_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 30_000);
  }
  const exponential = Math.min(250 * 2 ** attempt, 4_000);
  const jitter = Math.floor(Math.random() * Math.max(1, exponential / 4));
  return exponential + jitter;
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (typeof value !== "object" || value === null) return value;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) output[key] = stripUndefined(item);
  }
  return output;
}
