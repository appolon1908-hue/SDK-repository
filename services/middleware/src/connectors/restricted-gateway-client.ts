import type { JsonObject } from "@codestra/contracts";
import type { Env } from "../env.js";

export interface RestrictedGatewayCommandReceipt {
  commandId: string;
  status: "accepted" | "completed" | "rejected";
  providerReference?: string;
  data?: JsonObject;
  replayed?: boolean;
}

export interface RestrictedGatewayRequestContext {
  tenantId: string;
  correlationId: string;
  idempotencyKey?: string;
}

/**
 * Outbound HTTP client for the private restricted-gateway contract
 * (contracts/openapi/codestra-restricted-gateway.openapi.yaml). No such
 * gateway ships in this repository — RESTRICTED_GATEWAY_BASE_URL must point
 * at a real product-local deployment in production (see
 * services/middleware/README.md). This client implements the request shape
 * for real; it is exercised in tests against a local stand-in HTTP server.
 */
export class RestrictedGatewayClient {
  constructor(private readonly env: Env, private readonly fetchImpl: typeof fetch = fetch) {}

  async executeCommand(
    connectorKey: string,
    context: RestrictedGatewayRequestContext,
    command: { commandId: string; operation: string; payload: JsonObject; requestedAt: string; expectedVersion?: number },
  ): Promise<RestrictedGatewayCommandReceipt> {
    const response = await this.request(`/internal/v1/codestra/commands`, {
      method: "POST",
      context,
      body: command,
    });
    if (response.status !== 202) {
      throw new Error(`Restricted gateway returned unexpected status ${response.status} for command execution.`);
    }
    return (await response.json()) as RestrictedGatewayCommandReceipt;
  }

  async reconcileCommand(
    connectorKey: string,
    commandId: string,
    context: RestrictedGatewayRequestContext,
    body: { operation: string; requestedAt: string },
  ): Promise<RestrictedGatewayCommandReceipt | undefined> {
    const response = await this.request(`/internal/v1/codestra/commands/${commandId}/reconciliation`, {
      method: "POST",
      context,
      body,
    });
    if (response.status !== 200) {
      throw new Error(`Restricted gateway returned unexpected status ${response.status} for command reconciliation.`);
    }
    const payload = (await response.json()) as { result: RestrictedGatewayCommandReceipt | null };
    return payload.result ?? undefined;
  }

  async reconcile(
    context: RestrictedGatewayRequestContext,
    body: { cursor?: string; limit?: number },
  ): Promise<{ items: readonly JsonObject[]; hasMore: boolean; nextCursor?: string }> {
    const response = await this.request(`/internal/v1/codestra/reconciliation`, { method: "POST", context, body });
    if (response.status !== 200) {
      throw new Error(`Restricted gateway returned unexpected status ${response.status} for reconciliation.`);
    }
    return (await response.json()) as { items: readonly JsonObject[]; hasMore: boolean; nextCursor?: string };
  }

  private async request(
    path: string,
    options: { method: string; context: RestrictedGatewayRequestContext; body?: JsonObject },
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-codestra-tenant-id": options.context.tenantId,
      "x-correlation-id": options.context.correlationId,
      "x-codestra-workload-id": this.env.RESTRICTED_GATEWAY_WORKLOAD_ID,
      authorization: `Bearer ${this.env.RESTRICTED_GATEWAY_SERVICE_TOKEN}`,
    };
    if (options.context.idempotencyKey) headers["idempotency-key"] = options.context.idempotencyKey;

    return this.fetchImpl(new URL(path, this.env.RESTRICTED_GATEWAY_BASE_URL), {
      method: options.method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(this.env.RESTRICTED_GATEWAY_TIMEOUT_MS),
      redirect: "manual",
    });
  }
}
