import {
  ConnectorPolicyError,
  type CodestraConnector,
  type ConnectorCommand,
  type ConnectorCommandResult,
  type ConnectorContext,
  type ConnectorHealth,
  type ConnectorManifest,
  type ConnectorWebhookInput,
  type NormalizedConnectorEvent,
  type ReconciliationResult,
} from "@codestra/connector-kit";
import type { RestrictedGatewayClient } from "./restricted-gateway-client.js";

/**
 * Adapts one outbound restricted-gateway command to connector-kit's
 * `CodestraConnector` interface so `ConnectorRunner` — the exact same class
 * whose durable-idempotency contract packages/connector-kit/test/runner.test.ts
 * specifies — can drive it server-side. Middleware does not maintain a
 * fixed per-connector operation catalogue (that lives with each
 * product-local gateway), so one instance is built per request, declaring
 * exactly the operation that request asked for as `mutates: true`.
 */
export class RestrictedGatewayConnector implements CodestraConnector {
  constructor(
    private readonly connectorKey: string,
    private readonly operation: string,
    private readonly client: RestrictedGatewayClient,
  ) {}

  manifest(): ConnectorManifest {
    return {
      key: this.connectorKey,
      displayName: this.connectorKey,
      version: "0.1.0",
      operations: [{ name: this.operation, mutates: true, requiredCapabilities: [] }],
      webhookEventTypes: [],
    };
  }

  async testConnection(): Promise<ConnectorHealth> {
    throw new ConnectorPolicyError(
      "Restricted gateway health is reported through GET /health/ready on the gateway itself, not through this connector.",
      "NOT_IMPLEMENTED",
    );
  }

  async execute(context: ConnectorContext, command: ConnectorCommand): Promise<ConnectorCommandResult> {
    const receipt = await this.client.executeCommand(
      this.connectorKey,
      {
        tenantId: context.tenantId,
        correlationId: context.correlationId,
        ...(command.idempotencyKey === undefined ? {} : { idempotencyKey: command.idempotencyKey }),
      },
      {
        commandId: command.commandId,
        operation: command.operation,
        payload: command.payload,
        requestedAt: command.requestedAt,
        ...(command.expectedVersion === undefined ? {} : { expectedVersion: command.expectedVersion }),
      },
    );
    return {
      commandId: receipt.commandId,
      status: receipt.status,
      ...(receipt.providerReference === undefined ? {} : { providerReference: receipt.providerReference }),
      ...(receipt.data === undefined ? {} : { data: receipt.data }),
    };
  }

  async reconcileCommand(context: ConnectorContext, command: ConnectorCommand): Promise<ConnectorCommandResult | undefined> {
    const receipt = await this.client.reconcileCommand(
      this.connectorKey,
      command.commandId,
      { tenantId: context.tenantId, correlationId: context.correlationId },
      { operation: command.operation, requestedAt: command.requestedAt },
    );
    if (!receipt) return undefined;
    return {
      commandId: receipt.commandId,
      status: receipt.status,
      ...(receipt.providerReference === undefined ? {} : { providerReference: receipt.providerReference }),
      ...(receipt.data === undefined ? {} : { data: receipt.data }),
    };
  }

  async ingestWebhook(_context: ConnectorContext, _input: ConnectorWebhookInput): Promise<readonly NormalizedConnectorEvent[]> {
    throw new ConnectorPolicyError(
      "Provider webhook ingestion happens at the product-local gateway, not through this connector.",
      "NOT_IMPLEMENTED",
    );
  }

  async reconcile(context: ConnectorContext, cursor?: string): Promise<ReconciliationResult> {
    const page = await this.client.reconcile(
      { tenantId: context.tenantId, correlationId: context.correlationId },
      { ...(cursor === undefined ? {} : { cursor }) },
    );
    return {
      items: page.items,
      hasMore: page.hasMore,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    };
  }
}
