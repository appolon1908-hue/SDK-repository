import type { IDataObject } from "n8n-workflow";

export type InternalEventHeaders = Readonly<Record<string, string | readonly string[] | undefined>>;
export type InternalCredentialData = Readonly<Record<string, unknown>>;

export interface CodestraCanonicalEvent {
  specversion: "1.0";
  id: string;
  tenantid: string;
  source: string;
  type: "codestra.social.post.status.v1" | "codestra.webhook.delivery.status.v1";
  subject?: string;
  time: string;
  datacontenttype: "application/json";
  dataschema?: string;
  data: IDataObject;
}

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

export class InternalEventBoundaryError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, code: string, options: { status?: number; retryable?: boolean; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "InternalEventBoundaryError";
    this.code = code;
    this.status = options.status ?? 400;
    this.retryable = options.retryable ?? false;
  }
}
