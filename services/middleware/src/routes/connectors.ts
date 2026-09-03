import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ConnectorIndeterminateError,
  ConnectorPolicyError,
  ConnectorRunner,
  type ConnectorCommand,
  type ConnectorContext,
} from "@codestra/connector-kit";
import type { JsonObject } from "@codestra/contracts";
import { RestrictedGatewayConnector } from "../connectors/restricted-gateway-connector.js";
import { badRequest, CodestraError } from "../errors.js";
import type { AppDeps } from "../app-deps.js";

const CONNECTOR_KEY_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u;

const ConnectorCommandRequest = z
  .object({
    commandId: z.string().uuid(),
    operation: z.string().min(1).max(100),
    payload: z.record(z.string(), z.unknown()),
    requestedAt: z.string().datetime({ offset: true }),
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

const ReconciliationRequest = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict()
  .optional();

/**
 * Implements contracts/openapi/codestra-enterprise.openapi.yaml by driving
 * `@codestra/connector-kit`'s `ConnectorRunner` — the exact class whose
 * durable-idempotency contract packages/connector-kit/test/runner.test.ts
 * specifies — against `PrismaIdempotencyStore` and an outbound
 * `RestrictedGatewayConnector`. The state machine is connector-kit's; only
 * the store and the provider dispatch are server-specific.
 */
export function registerConnectorRoutes(app: FastifyInstance, deps: AppDeps): void {
  const runner = new ConnectorRunner({ idempotencyStore: deps.idempotencyStore });

  app.post<{ Params: { connectorKey: string } }>("/v1/connectors/:connectorKey/commands", async (request, reply) => {
    const tenantId = await deps.authenticate(request);
    const { connectorKey } = request.params;
    if (!CONNECTOR_KEY_PATTERN.test(connectorKey)) throw badRequest("connectorKey must match ^[a-z][a-z0-9-]{1,63}$.");

    const correlationId = requireCorrelationId(request.headers["x-correlation-id"]);
    const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
    const parsed = ConnectorCommandRequest.safeParse(request.body);
    if (!parsed.success) throw badRequest("Invalid connector command request body.", { issues: parsed.error.issues as never });

    const connector = new RestrictedGatewayConnector(connectorKey, parsed.data.operation, deps.restrictedGatewayClient);
    const context: ConnectorContext = {
      tenantId,
      correlationId,
      actor: { type: "service", subjectId: "codestra-middleware" },
      capabilities: {},
    };

    const command: ConnectorCommand = {
      commandId: parsed.data.commandId,
      operation: parsed.data.operation,
      payload: parsed.data.payload as JsonObject,
      requestedAt: parsed.data.requestedAt,
      idempotencyKey,
      ...(parsed.data.expectedVersion === undefined ? {} : { expectedVersion: parsed.data.expectedVersion }),
    };

    try {
      const result = await runner.execute(connector, context, command);
      reply.code(202);
      // CommandReceipt (contracts/openapi/codestra-enterprise.openapi.yaml)
      // has no dedicated providerReference field, only a generic `result`
      // object — fold it in alongside any provider data rather than
      // dropping it.
      const resultBody =
        result.providerReference === undefined && result.data === undefined
          ? undefined
          : { ...(result.data ?? {}), ...(result.providerReference === undefined ? {} : { providerReference: result.providerReference }) };
      return {
        commandId: result.commandId,
        status: result.status,
        acceptedAt: new Date().toISOString(),
        ...(result.replayed !== undefined ? { replayed: result.replayed } : {}),
        ...(resultBody === undefined ? {} : { result: resultBody }),
      };
    } catch (error) {
      throw toHttpError(error);
    }
  });

  app.post<{ Params: { connectorKey: string } }>("/v1/connectors/:connectorKey/reconciliation", async (request) => {
    const tenantId = await deps.authenticate(request);
    const { connectorKey } = request.params;
    if (!CONNECTOR_KEY_PATTERN.test(connectorKey)) throw badRequest("connectorKey must match ^[a-z][a-z0-9-]{1,63}$.");
    const correlationId = requireCorrelationId(request.headers["x-correlation-id"]);
    const parsed = ReconciliationRequest.safeParse(request.body ?? {});
    if (!parsed.success) throw badRequest("Invalid reconciliation request body.", { issues: parsed.error.issues as never });

    const connector = new RestrictedGatewayConnector(connectorKey, "reconciliation.read", deps.restrictedGatewayClient);
    const context: ConnectorContext = {
      tenantId,
      correlationId,
      actor: { type: "service", subjectId: "codestra-middleware" },
      capabilities: {},
    };

    try {
      return await connector.reconcile(context, parsed.data?.cursor);
    } catch (error) {
      throw toHttpError(error);
    }
  });
}

function toHttpError(error: unknown): CodestraError {
  if (error instanceof ConnectorIndeterminateError) {
    return new CodestraError(409, error.code, error.message, {
      retryable: error.retryable,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
  }
  if (error instanceof ConnectorPolicyError) {
    return new CodestraError(403, error.code, error.message, {
      retryable: false,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
  }
  if (error instanceof CodestraError) return error;
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string; retryable?: boolean; details?: JsonObject };
    if (withCode.code) {
      return new CodestraError(409, withCode.code, withCode.message, {
        retryable: withCode.retryable ?? false,
        ...(withCode.details === undefined ? {} : { details: withCode.details }),
      });
    }
  }
  return new CodestraError(500, "CONNECTOR_COMMAND_FAILED", "The connector command failed unexpectedly.", { retryable: true });
}

function requireCorrelationId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || id.length < 8 || id.length > 128) return randomUUID();
  return id;
}

function requireIdempotencyKey(value: string | string[] | undefined): string {
  const key = Array.isArray(value) ? value[0] : value;
  if (!key || key.length < 16 || key.length > 128) {
    throw new CodestraError(400, "IDEMPOTENCY_KEY_REQUIRED", "An Idempotency-Key header between 16 and 128 characters is required.", {
      retryable: false,
    });
  }
  return key;
}
