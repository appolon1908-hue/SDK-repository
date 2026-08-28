import type { CodestraCanonicalEvent } from "./internal-event-contracts.js";

export type InternalEventHeaders = Readonly<Record<string, string | readonly string[] | undefined>>;
export type InternalCredentialData = Readonly<Record<string, unknown>>;

export interface CodestraInternalWebhookConfig {
  expectedTenantId: string;
  webhookSecrets: readonly string[];
  allowedEventTypes: ReadonlySet<string>;
  allowedSourcePrefixes: readonly string[];
  replayGuardBaseUrl: URL;
  replayGuardAccessToken: string;
  timestampToleranceSeconds: number;
  maxBodyBytes: number;
  requestTimeoutMs: number;
}

export interface ReplayClaimReceipt {
  claimId: string;
  deliveryId: string;
  status: "claimed";
  claimedAt: string;
  expiresAt: string;
}

export interface AcceptedInternalEvent {
  event: CodestraCanonicalEvent;
  delivery: {
    deliveryId: string;
    claimId: string;
    tenantId: string;
    correlationId: string;
    bodySha256: string;
    signatureTimestamp: number;
    claimedAt: string;
    expiresAt: string;
  };
}

export interface AcceptSignedInternalEventInput {
  headers: InternalEventHeaders;
  rawBody: string | Uint8Array;
  credentials: InternalCredentialData;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

export interface CompleteInternalEventInput {
  deliveryId: string;
  claimId: string;
  tenantId: string;
  correlationId: string;
  outcome: "completed" | "failed";
  credentials: InternalCredentialData;
  workflowExecutionId?: string;
  errorCode?: string;
  completedAt?: string;
  fetch?: typeof globalThis.fetch;
}

export interface InternalEventCompletionReceipt {
  deliveryId: string;
  claimId: string;
  status: "completed" | "failed";
  recordedAt: string;
  replayed?: boolean;
}

export class InternalEventBoundaryError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "InternalEventBoundaryError";
    this.code = code;
    this.status = options.status ?? 400;
    this.retryable = options.retryable ?? false;
  }
}
