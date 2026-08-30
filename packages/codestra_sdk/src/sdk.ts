import { CodestraCommunicationsClient } from "@codestra/communications-sdk";
import type {
  CodestraCommunicationsClientOptions,
  CommunicationsMutationOptions,
} from "@codestra/communications-sdk";
import { CodestraClient as CodestraSocialClient } from "@codestra/social-sdk";
import type {
  CreateCommunicationMessageInput,
  CreateSocialPostInput,
  JsonObject,
  ListSocialPostsInput,
  OperationsDashboardAuthGatewayStatus,
  OperationsDashboardCanaryStatusList,
  OperationsDashboardMessageLifecycleStatus,
  OperationsDashboardOverview,
  OperationsDashboardProviderStatusList,
  OperationsDashboardQueueStatus,
  OperationsDashboardReleaseGateStatus,
  OperationsDashboardRouteStatusList,
  OperationsDashboardTenantActivityStatus,
  OperationsDashboardWebhookDeliveryStatus,
  SocialPost,
  SocialPostList,
  UUID,
} from "@codestra/contracts";
import type {
  CrmLeadListOptions,
  GenerateAiInput,
  MarketingCampaignListOptions,
  TriggerWorkflowInput,
} from "./types.js";

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface CodestraSdkOptions {
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

export interface CodestraRequestOptions {
  signal?: AbortSignal;
  correlationId?: string;
}

export interface CodestraMutationOptions extends CodestraRequestOptions {
  idempotencyKey: string;
}

interface InternalRequestOptions extends CodestraRequestOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}

export class CodestraSdkError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "CodestraSdkError";
    this.code = code;
  }
}

export class CodestraSdkConfigurationError extends CodestraSdkError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
    this.name = "CodestraSdkConfigurationError";
  }
}

export class CodestraSdkHttpError extends CodestraSdkError {
  readonly status: number;
  readonly requestId: string;
  readonly retryable: boolean;

  constructor(input: { status: number; code: string; message: string; requestId: string; retryable: boolean }) {
    super(input.message, input.code);
    this.name = "CodestraSdkHttpError";
    this.status = input.status;
    this.requestId = input.requestId;
    this.retryable = input.retryable;
  }
}

export class CodestraSdk {
  readonly auth: {
    session: {
      get: (options?: CodestraRequestOptions) => Promise<JsonObject>;
    };
  };

  readonly marketing: {
    campaigns: {
      list: (options?: MarketingCampaignListOptions) => Promise<JsonObject>;
      get: (campaignId: UUID, options?: CodestraRequestOptions) => Promise<JsonObject>;
    };
  };

  readonly ai: {
    generate: (input: GenerateAiInput, options: CodestraMutationOptions) => Promise<JsonObject>;
  };

  readonly communication: CodestraCommunicationsClient & {
    messages: CodestraCommunicationsClient["messages"] & {
      send: (input: CreateCommunicationMessageInput, options: CommunicationsMutationOptions) => Promise<JsonObject>;
    };
  };

  readonly social: {
    posts: {
      schedule: (input: CreateSocialPostInput, options: CodestraMutationOptions) => Promise<SocialPost>;
      create: (input: CreateSocialPostInput, options: CodestraMutationOptions) => Promise<SocialPost>;
      list: (input?: ListSocialPostsInput, options?: CodestraRequestOptions) => Promise<SocialPostList>;
      get: (postId: UUID, options?: CodestraRequestOptions) => Promise<SocialPost>;
      cancel: (postId: UUID, options: CodestraMutationOptions) => Promise<SocialPost>;
    };
  };

  readonly crm: {
    leads: {
      list: (options?: CrmLeadListOptions) => Promise<JsonObject>;
      get: (leadId: UUID, options?: CodestraRequestOptions) => Promise<JsonObject>;
    };
  };

  readonly workflow: {
    runs: {
      trigger: (input: TriggerWorkflowInput, options: CodestraMutationOptions) => Promise<JsonObject>;
      get: (runId: UUID, options?: CodestraRequestOptions) => Promise<JsonObject>;
    };
  };

  readonly operationsDashboard: {
    overview: (options?: CodestraRequestOptions) => Promise<OperationsDashboardOverview>;
    authGateway: (options?: CodestraRequestOptions) => Promise<OperationsDashboardAuthGatewayStatus>;
    routes: (options?: CodestraRequestOptions) => Promise<OperationsDashboardRouteStatusList>;
    providers: (options?: CodestraRequestOptions) => Promise<OperationsDashboardProviderStatusList>;
    messageLifecycle: (options?: CodestraRequestOptions) => Promise<OperationsDashboardMessageLifecycleStatus>;
    webhooks: (options?: CodestraRequestOptions) => Promise<OperationsDashboardWebhookDeliveryStatus>;
    tenant: (tenantId: string, options?: CodestraRequestOptions) => Promise<OperationsDashboardTenantActivityStatus>;
    queues: (options?: CodestraRequestOptions) => Promise<OperationsDashboardQueueStatus>;
    releaseGates: (options?: CodestraRequestOptions) => Promise<OperationsDashboardReleaseGateStatus>;
    canaries: (options?: CodestraRequestOptions) => Promise<OperationsDashboardCanaryStatusList>;
  };

  readonly events: {
    webhooks: CodestraSocialClient["webhooks"];
  };

  readonly common: {
    tenantId: string;
    requestedBy: string;
  };

  private readonly baseUrl: URL;
  private readonly tenantId: string;
  private readonly requestedBy: string;
  private readonly getAccessToken: () => Promise<string> | string;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly correlationIdFactory: () => string;

  constructor(options: CodestraSdkOptions) {
    this.baseUrl = validateBaseUrl(options.baseUrl);
    this.tenantId = requireHeaderValue(options.tenantId, "tenantId");
    this.requestedBy = requireHeaderValue(options.requestedBy, "requestedBy");
    this.getAccessToken = options.getAccessToken;
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.timeoutMs = requireNonNegativeInteger(options.timeoutMs ?? 10_000, "timeoutMs", false);
    this.maxRetries = requireNonNegativeInteger(options.maxRetries ?? 2, "maxRetries", true);
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.correlationIdFactory =
      options.correlationIdFactory ??
      (() => {
        if (!globalThis.crypto?.randomUUID) {
          throw new CodestraSdkConfigurationError("A cryptographically secure randomUUID implementation is required.");
        }
        return globalThis.crypto.randomUUID();
      });

    if (typeof this.fetchImplementation !== "function") {
      throw new CodestraSdkConfigurationError("A Fetch API implementation is required.");
    }

    const socialClient = new CodestraSocialClient({
      baseUrl: this.baseUrl.toString(),
      tenantId: this.tenantId,
      getAccessToken: this.getAccessToken,
      fetch: this.fetchImplementation,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      sleep: this.sleep,
      correlationIdFactory: this.correlationIdFactory,
    });

    const communicationClient = new CodestraCommunicationsClient({
      baseUrl: this.baseUrl.toString(),
      tenantId: this.tenantId,
      requestedBy: this.requestedBy,
      getAccessToken: this.getAccessToken,
      fetch: this.fetchImplementation,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      sleep: this.sleep,
      ...(options.commandIdFactory ? { commandIdFactory: options.commandIdFactory } : {}),
      correlationIdFactory: this.correlationIdFactory,
    } satisfies CodestraCommunicationsClientOptions);

    this.auth = {
      session: {
        get: (requestOptions) => this.request({ method: "GET", path: "/v1/auth/session", ...copyRequestOptions(requestOptions) }),
      },
    };

    this.marketing = {
      campaigns: {
        list: (requestOptions) => this.request({ method: "GET", path: withQuery("/v1/marketing/campaigns", requestOptions), ...copyRequestOptions(requestOptions) }),
        get: (campaignId, requestOptions) =>
          this.request({ method: "GET", path: `/v1/marketing/campaigns/${encodeURIComponent(requirePathSegment(campaignId, "campaignId"))}`, ...copyRequestOptions(requestOptions) }),
      },
    };

    this.ai = {
      generate: (input, requestOptions) =>
        this.request({
          method: "POST",
          path: "/v1/ai/generate",
          body: stripUndefined(input),
          idempotencyKey: requireIdempotencyKey(requestOptions.idempotencyKey),
          ...copyRequestOptions(requestOptions),
        }),
    };

    const communication = communicationClient as CodestraSdk["communication"];
    Object.defineProperty(communication, "messages", {
      value: {
        ...communicationClient.messages,
        send: (input: CreateCommunicationMessageInput, requestOptions: CommunicationsMutationOptions) =>
          communicationClient.messages.create(input, requestOptions) as Promise<JsonObject>,
      },
    });
    this.communication = communication;

    this.social = {
      posts: {
        schedule: (input, requestOptions) => socialClient.social.posts.create(input, requestOptions),
        create: (input, requestOptions) => socialClient.social.posts.create(input, requestOptions),
        list: (input, requestOptions) => socialClient.social.posts.list(input, requestOptions),
        get: (postId, requestOptions) => socialClient.social.posts.get(postId, requestOptions),
        cancel: (postId, requestOptions) => socialClient.social.posts.cancel(postId, requestOptions),
      },
    };

    this.crm = {
      leads: {
        list: (requestOptions) => this.request({ method: "GET", path: withQuery("/v1/crm/leads", requestOptions), ...copyRequestOptions(requestOptions) }),
        get: (leadId, requestOptions) =>
          this.request({ method: "GET", path: `/v1/crm/leads/${encodeURIComponent(requirePathSegment(leadId, "leadId"))}`, ...copyRequestOptions(requestOptions) }),
      },
    };

    this.workflow = {
      runs: {
        trigger: (input, requestOptions) =>
          this.request({
            method: "POST",
            path: "/v1/workflow/runs",
            body: stripUndefined(input),
            idempotencyKey: requireIdempotencyKey(requestOptions.idempotencyKey),
            ...copyRequestOptions(requestOptions),
          }),
        get: (runId, requestOptions) =>
          this.request({ method: "GET", path: `/v1/workflow/runs/${encodeURIComponent(requirePathSegment(runId, "runId"))}`, ...copyRequestOptions(requestOptions) }),
      },
    };

    this.operationsDashboard = {
      overview: (requestOptions) =>
        this.request<OperationsDashboardOverview>({ method: "GET", path: "/v1/operations-dashboard/overview", ...copyRequestOptions(requestOptions) }),
      authGateway: (requestOptions) =>
        this.request<OperationsDashboardAuthGatewayStatus>({ method: "GET", path: "/v1/operations-dashboard/auth-gateway", ...copyRequestOptions(requestOptions) }),
      routes: (requestOptions) =>
        this.request<OperationsDashboardRouteStatusList>({ method: "GET", path: "/v1/operations-dashboard/routes", ...copyRequestOptions(requestOptions) }),
      providers: (requestOptions) =>
        this.request<OperationsDashboardProviderStatusList>({ method: "GET", path: "/v1/operations-dashboard/providers", ...copyRequestOptions(requestOptions) }),
      messageLifecycle: (requestOptions) =>
        this.request<OperationsDashboardMessageLifecycleStatus>({ method: "GET", path: "/v1/operations-dashboard/messages/lifecycle", ...copyRequestOptions(requestOptions) }),
      webhooks: (requestOptions) =>
        this.request<OperationsDashboardWebhookDeliveryStatus>({ method: "GET", path: "/v1/operations-dashboard/webhooks", ...copyRequestOptions(requestOptions) }),
      tenant: (tenantId, requestOptions) =>
        this.request<OperationsDashboardTenantActivityStatus>({ method: "GET", path: `/v1/operations-dashboard/tenants/${encodeURIComponent(requirePathSegment(tenantId, "tenantId"))}`, ...copyRequestOptions(requestOptions) }),
      queues: (requestOptions) =>
        this.request<OperationsDashboardQueueStatus>({ method: "GET", path: "/v1/operations-dashboard/queues", ...copyRequestOptions(requestOptions) }),
      releaseGates: (requestOptions) =>
        this.request<OperationsDashboardReleaseGateStatus>({ method: "GET", path: "/v1/operations-dashboard/release-gates", ...copyRequestOptions(requestOptions) }),
      canaries: (requestOptions) =>
        this.request<OperationsDashboardCanaryStatusList>({ method: "GET", path: "/v1/operations-dashboard/canaries", ...copyRequestOptions(requestOptions) }),
    };

    this.events = {
      webhooks: socialClient.webhooks,
    };

    this.common = {
      tenantId: this.tenantId,
      requestedBy: this.requestedBy,
    };
  }

  private async request<T = JsonObject>(options: InternalRequestOptions): Promise<T> {
    const correlationId = requireHeaderValue(options.correlationId ?? this.correlationIdFactory(), "correlationId");
    const token = requireHeaderValue(await this.getAccessToken(), "access token");
    const url = new URL(options.path.replace(/^\/+/, ""), ensureTrailingSlash(this.baseUrl));
    const headers = new Headers({
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "x-tenant-id": this.tenantId,
      "x-codestra-tenant-id": this.tenantId,
      "x-correlation-id": correlationId,
    });
    if (options.idempotencyKey !== undefined) headers.set("idempotency-key", requireIdempotencyKey(options.idempotencyKey));
    if (options.body !== undefined) headers.set("content-type", "application/json");

    const requestInit: RequestInit = {
      method: options.method,
      headers,
      signal: options.signal ?? AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    };
    if (options.body !== undefined) requestInit.body = JSON.stringify(options.body);

    const response = await this.fetchImplementation(url, requestInit);

    if (response.ok) {
      if (response.status === 204) return {} as T;
      return (await response.json()) as T;
    }

    throw await parseHttpError(response, correlationId);
  }
}

export function createCodestraSdk(options: CodestraSdkOptions): CodestraSdk {
  return new CodestraSdk(options);
}

function copyRequestOptions(options: CodestraRequestOptions | undefined): CodestraRequestOptions {
  const copied: CodestraRequestOptions = {};
  if (options?.signal !== undefined) copied.signal = options.signal;
  if (options?.correlationId !== undefined) copied.correlationId = options.correlationId;
  return copied;
}

function validateBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CodestraSdkConfigurationError("baseUrl must be an absolute URL.");
  }

  const isLocalDevelopment = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalDevelopment)) {
    throw new CodestraSdkConfigurationError("baseUrl must use HTTPS except for loopback development.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new CodestraSdkConfigurationError("baseUrl must not contain credentials, query parameters, or fragments.");
  }
  return url;
}

function ensureTrailingSlash(url: URL): URL {
  const copy = new URL(url);
  if (!copy.pathname.endsWith("/")) copy.pathname += "/";
  return copy;
}

function requireHeaderValue(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/u.test(trimmed)) {
    throw new CodestraSdkConfigurationError(`${name} must be a non-empty single-line value.`);
  }
  return trimmed;
}

function requirePathSegment(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized || normalized === "." || normalized === "..") {
    throw new CodestraSdkConfigurationError(`${name} must be a non-empty identifier.`);
  }
  return normalized;
}

function requireIdempotencyKey(value: string): string {
  const key = requireHeaderValue(value, "idempotencyKey");
  if (key.length < 16 || key.length > 128) {
    throw new CodestraSdkConfigurationError("idempotencyKey must contain between 16 and 128 characters.");
  }
  return key;
}

function requireNonNegativeInteger(value: number, name: string, allowZero: boolean): number {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new CodestraSdkConfigurationError(`${name} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
  return value;
}

function withQuery(path: string, query: object | undefined): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (["signal", "correlationId"].includes(key) || value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

async function parseHttpError(response: Response, fallbackRequestId: string): Promise<CodestraSdkHttpError> {
  let body: { error?: { code?: string; message?: string; requestId?: string; retryable?: boolean } } | undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      body = (await response.json()) as typeof body;
    } catch {
      body = undefined;
    }
  }

  return new CodestraSdkHttpError({
    status: response.status,
    code: body?.error?.code ?? `HTTP_${response.status}`,
    message: body?.error?.message ?? `Codestra request failed with HTTP ${response.status}.`,
    requestId: body?.error?.requestId ?? response.headers.get("x-request-id") ?? fallbackRequestId,
    retryable: body?.error?.retryable ?? RETRYABLE_STATUS_CODES.has(response.status),
  });
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
