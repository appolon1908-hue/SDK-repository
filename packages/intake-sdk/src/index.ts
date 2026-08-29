export type IntakeSource = "form" | "landing_page" | "chat" | "voice" | "api" | "other";

export interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  referrer?: string;
  landingPage?: string;
}

export interface LeadSubmission {
  tenantId: string;
  siteId: string;
  /** Stable client-side occurrence time used to make exact retries semantic duplicates. */
  submittedAt?: string;
  source: IntakeSource;
  formId?: string;
  campaignId?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  conversationId?: string;
  transcript?: string;
  consent?: {
    marketing?: boolean;
    sms?: boolean;
    email?: boolean;
    privacyPolicyVersion?: string;
  };
  attribution?: Attribution;
  fields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface IntakeReceipt {
  eventId: string;
  correlationId: string;
  duplicate: boolean;
  status: "accepted" | "duplicate";
}

export interface IntakeClientOptions {
  /**
   * Browser usage should normally point to a same-origin BFF route such as
   * /api/codestra/intake. Do not embed Middleware bearer tokens in a browser.
   */
  endpoint?: string;
  bearerToken?: string;
  fetchImpl?: typeof fetch;
}

export class CodestraIntakeClient {
  private readonly endpoint: string;
  private readonly bearerToken?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: IntakeClientOptions = {}) {
    this.endpoint = options.endpoint ?? "/api/codestra/intake";
    this.bearerToken = options.bearerToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async submitLead(
    submission: LeadSubmission,
    options: { idempotencyKey?: string; correlationId?: string } = {},
  ): Promise<IntakeReceipt> {
    const idempotencyKey = options.idempotencyKey ?? randomId("lead");
    const correlationId = options.correlationId ?? randomId("corr");
    const prepared: LeadSubmission & { submittedAt: string } = {
      ...submission,
      submittedAt: submission.submittedAt ?? new Date().toISOString(),
    };
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Tenant-ID": prepared.tenantId,
      "Idempotency-Key": idempotencyKey,
      "X-Correlation-ID": correlationId,
    });

    if (this.bearerToken) headers.set("Authorization", `Bearer ${this.bearerToken}`);

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(prepared),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Codestra intake failed (${response.status}): ${body.slice(0, 500)}`);
    }

    return (await response.json()) as IntakeReceipt;
  }
}

export function createIntakeClient(options?: IntakeClientOptions): CodestraIntakeClient {
  return new CodestraIntakeClient(options);
}

function randomId(prefix: string): string {
  const value = globalThis.crypto?.randomUUID?.();
  if (value) return `${prefix}-${value}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
