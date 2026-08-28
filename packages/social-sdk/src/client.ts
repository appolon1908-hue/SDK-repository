import type {
  CodestraErrorBody,
  CreateSocialPostInput,
  SocialPost,
  UUID,
  WebhookDeliveryTest,
  WebhookSubscription,
  WebhookSubscriptionCreated,
  WebhookSubscriptionInput,
  WebhookSubscriptionList,
  WebhookSubscriptionSecretRotation,
} from "@codestra/contracts";
import {
  CodestraApiError,
  CodestraConfigurationError,
  CodestraSdkError,
  CodestraTimeoutError,
} from "./errors.js";

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface CodestraClientOptions {
  baseUrl: string;
  tenantId: string;
  getAccessToken: () => Promise<string> | string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  correlationIdFactory?: () => string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  correlationId?: string;
}

export interface MutationRequestOptions extends RequestOptions {
  idempotencyKey: string;
}

interface InternalRequestOptions extends RequestOptions {
  method: "DELETE" | "GET" | "POST";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}

export class CodestraClient {
  readonly social: {
    posts: {
      create: (input: CreateSocialPostInput, options: MutationRequestOptions) => Promise<SocialPost>;
      get: (postId: UUID, options?: RequestOptions) => Promise<SocialPost>;
    };
  };

  readonly webhooks: {
    subscriptions: {
      create: (
        input: WebhookSubscriptionInput,
        options: MutationRequestOptions,
      ) => Promise<WebhookSubscriptionCreated>;
      list: (options?: RequestOptions) => Promise<WebhookSubscriptionList>;
      get: (subscriptionId: UUID, options?: RequestOptions) => Promise<WebhookSubscription>;
      test: (subscriptionId: UUID, options: MutationRequestOptions) => Promise<WebhookDeliveryTest>;
      rotateSecret: (
        subscriptionId: UUID,
        options: MutationRequestOptions,
      ) => Promise<WebhookSubscriptionSecretRotation>;
      enable: (subscriptionId: UUID, options: MutationRequestOptions) => Promise<WebhookSubscription>;
      disable: (subscriptionId: UUID, options: MutationRequestOptions) => Promise<WebhookSubscription>;
      delete: (subscriptionId: UUID, options: MutationRequestOptions) => Promise<void>;
    };
  };

  private readonly baseUrl: URL;
  private readonly tenantId: string;
  private readonly getAccessToken: () => Promise<string> | string;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly correlationIdFactory: () => string;

  constructor(options: CodestraClientOptions) {
    this.baseUrl = validateBaseUrl(options.baseUrl);
    this.tenantId = requireHeaderValue(options.tenantId, "tenantId");
    this.getAccessToken = options.getAccessToken;
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.timeoutMs = requireNonNegativeInteger(options.timeoutMs ?? 10_000, "timeoutMs", false);
    this.maxRetries = requireNonNegativeInteger(options.maxRetries ?? 2, "maxRetries", true);
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.correlationIdFactory =
      options.correlationIdFactory ??
      (() => {
        if (!globalThis.crypto?.randomUUID) {
          throw new CodestraConfigurationError("A cryptographically secure randomUUID implementation is required.");
        }
        return globalThis.crypto.randomUUID();
      });

    if (typeof this.fetchImplementation !== "function") {
      throw new CodestraConfigurationError("A Fetch API implementation is required.");
    }

    this.social = {
      posts: {
        create: (input, requestOptions) =>
          this.request<SocialPost>({
            method: "POST",
            path: "/v1/social/posts",
            body: input,
            idempotencyKey: requireIdempotencyKey(requestOptions.idempotencyKey),
            ...copyRequestOptions(requestOptions),
          }),
        get: (postId, requestOptions) =>
          this.request<SocialPost>({
            method: "GET",
            path: `/v1/social/posts/${encodeURIComponent(requirePathSegment(postId, "postId"))}`,
            ...copyRequestOptions(requestOptions),
          }),
      },
    };

    this.webhooks = {
      subscriptions: {
        create: (input, requestOptions) =>
          this.request<WebhookSubscriptionCreated>({
            method: "POST",
            path: "/v1/webhook-subscriptions",
            body: input,
            idempotencyKey: requireIdempotencyKey(requestOptions.idempotencyKey),
            ...copyRequestOptions(requestOptions),
          }),
        list: (requestOptions) =>
          this.request<WebhookSubscriptionList>({
            method: "GET",
            path: "/v1/webhook-subscriptions",
            ...copyRequestOptions(requestOptions),
          }),
        get: (subscriptionId, requestOptions) =>
          this.request<WebhookSubscription>({
            method: "GET",
            path: webhookSubscriptionPath(subscriptionId),
            ...copyRequestOptions(requestOptions),
          }),
        test: (subscriptionId, requestOptions) =>
          this.request<WebhookDeliveryTest>({
            method: "POST",
            path: `${webhookSubscriptionPath(subscriptionId)}/test`,
            idempotencyKey: requireIdempotencyKey(requestOptions.idempotencyKey),
            ...copyRequestOptions(requestOptions),
          }),
        rotateSecret: (subscriptionId, requestOptions) =>
          this.request<WebhookSubscriptionSecretRotation>({
            method: "POST",
            path: `${webhookSubscriptionPath(subscriptionId)}/rotate-secret`,
            idempotencyKey: requireIdempotencyKey(requestOptions.idempotencyKey),
            ...copyRequestOptions(requestOptions),
          }),
        enable: (subscriptionId, requestOptions) =>
          this.request<WebhookSubscription>({
            method: "POST",
            path: `${webhookSubscriptionPath(subscriptionId)}/enable`,
            idempotencyKey: requireIdempotencyKey(requestOptions.idempotencyKey),
            ...copyRequestOptions(requestOptions),
          }),
        disable: (subscriptionId, requestOptions) =>
          this.request<WebhookSubscription>({
            method: "POST",
            path: `${webhookSubscriptionPath(subscriptionId)}/disable`,
            idempotencyKey: requireIdempotencyKey(requestOptions.idempotencyKey),
            ...copyRequestOptions(requestOptions),
          }),
        delete: (subscriptionId, requestOptions) =>
          this.request<void>({
            method: "DELETE",
            path: webhookSubscriptionPath(subscriptionId),
            idempotencyKey: requireIdempotencyKey(requestOptions.idempotencyKey),
            ...copyRequestOptions(requestOptions),
          }),
      },
    };
  }

  private async request<T>(options: InternalRequestOptions): Promise<T> {
    const correlationId = requireHeaderValue(
      options.correlationId ?? this.correlationIdFactory(),
      "correlationId",
    );
    const token = requireHeaderValue(await this.getAccessToken(), "access token");
    const url = new URL(options.path.replace(/^\/+/, ""), ensureTrailingSlash(this.baseUrl));
    const canRetry = SAFE_METHODS.has(options.method) || options.idempotencyKey !== undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const timeout = createRequestSignal(options.signal, this.timeoutMs);
      const headers = new Headers({
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "x-codestra-tenant-id": this.tenantId,
        "x-correlation-id": correlationId,
      });

      if (options.body !== undefined) headers.set("content-type", "application/json");
      if (options.idempotencyKey !== undefined) {
        headers.set("idempotency-key", requireIdempotencyKey(options.idempotencyKey));
      }

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
        if (response.ok) return await parseSuccess<T>(response);

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
              : new CodestraSdkError("Codestra request was aborted.", "REQUEST_ABORTED");
          }
          throw new CodestraTimeoutError(this.timeoutMs);
        }

        if (error instanceof CodestraApiError) {
          if (!canRetry || attempt >= this.maxRetries || !error.retryable) throw error;
        } else if (!canRetry || attempt >= this.maxRetries) {
          throw new CodestraSdkError("Codestra request failed before a response was received.", "NETWORK_ERROR", {
            cause: error,
          });
        }

        lastError = error;
        await this.sleep(computeRetryDelay(null, attempt));
      } finally {
        timeout.cleanup();
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new CodestraSdkError("Codestra request failed.", "UNKNOWN_REQUEST_ERROR");
  }
}

function copyRequestOptions(options: RequestOptions | undefined): RequestOptions {
  const copied: RequestOptions = {};
  if (options?.signal !== undefined) copied.signal = options.signal;
  if (options?.correlationId !== undefined) copied.correlationId = options.correlationId;
  return copied;
}

function validateBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CodestraConfigurationError("baseUrl must be an absolute URL.");
  }

  const isLocalDevelopment = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalDevelopment)) {
    throw new CodestraConfigurationError("baseUrl must use HTTPS except for loopback development.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new CodestraConfigurationError("baseUrl must not contain credentials, query parameters, or fragments.");
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
    throw new CodestraConfigurationError(`${name} must be a non-empty single-line value.`);
  }
  return trimmed;
}

function requirePathSegment(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized || normalized === "." || normalized === "..") {
    throw new CodestraConfigurationError(`${name} must be a non-empty identifier.`);
  }
  return normalized;
}

function requireIdempotencyKey(value: string): string {
  const key = requireHeaderValue(value, "idempotencyKey");
  if (key.length < 16 || key.length > 128) {
    throw new CodestraConfigurationError("idempotencyKey must contain between 16 and 128 characters.");
  }
  return key;
}

function webhookSubscriptionPath(subscriptionId: UUID): string {
  return `/v1/webhook-subscriptions/${encodeURIComponent(requirePathSegment(subscriptionId, "subscriptionId"))}`;
}

function requireNonNegativeInteger(value: number, name: string, allowZero: boolean): number {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new CodestraConfigurationError(`${name} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
  return value;
}

function createRequestSignal(externalSignal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  const timer = setTimeout(() => controller.abort(new CodestraTimeoutError(timeoutMs)), timeoutMs);
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
    throw new CodestraSdkError("Codestra returned a successful non-JSON response.", "INVALID_RESPONSE");
  }
  return (await response.json()) as T;
}

async function parseApiError(response: Response, fallbackRequestId: string): Promise<CodestraApiError> {
  let body: Partial<CodestraErrorBody> | undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      body = (await response.json()) as Partial<CodestraErrorBody>;
    } catch {
      body = undefined;
    }
  }

  const requestId = body?.error?.requestId ?? response.headers.get("x-request-id") ?? fallbackRequestId;
  return new CodestraApiError({
    status: response.status,
    code: body?.error?.code ?? `HTTP_${response.status}`,
    message: body?.error?.message ?? `Codestra request failed with HTTP ${response.status}.`,
    requestId,
    retryable: body?.error?.retryable ?? RETRYABLE_STATUS_CODES.has(response.status),
    ...(body?.error?.details !== undefined ? { details: body.error.details } : {}),
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
