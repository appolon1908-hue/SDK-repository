import { createHash } from "node:crypto";
import {
  canonicalizeJson,
  type ConnectorCommandResult,
  type ConnectorIdempotencyStore,
} from "@codestra/connector-kit";
import type { JsonObject } from "@codestra/contracts";
import { CodestraError, conflict } from "../errors.js";

export interface IdempotentMutationTtls {
  acquiredTtlSeconds: number;
  dispatchTtlSeconds: number;
  completedTtlSeconds: number;
}

const DEFAULT_TTLS: IdempotentMutationTtls = {
  acquiredTtlSeconds: 60,
  dispatchTtlSeconds: 300,
  completedTtlSeconds: 86_400,
};

export interface MutationOutcome<T> {
  status: number;
  body: T;
}

/**
 * Runs one mutating public-API operation exactly once per
 * (tenant, operation, Idempotency-Key) tuple, backed by the same durable
 * state machine `@codestra/connector-kit`'s `ConnectorIdempotencyStore`
 * defines and `PrismaIdempotencyStore` implements — begin (dedupe on
 * tenant + idempotency key + request hash) -> dispatched -> completed, with
 * an unexpected failure after dispatch retained as `indeterminate` rather
 * than silently released.
 *
 * A deliberate 4xx `CodestraError` thrown by `work` is treated as a
 * definite, cacheable outcome (replaying the key returns the same
 * rejection). Anything else thrown after dispatch is retained as
 * indeterminate: Middleware cannot tell whether the mutation partially
 * applied, so a blind retry is refused until the record is reconciled.
 */
export async function runIdempotentMutation<T extends JsonObject>(
  store: ConnectorIdempotencyStore,
  params: { tenantId: string; namespace: string; operation: string; idempotencyKey: string; payload: JsonObject },
  work: () => Promise<MutationOutcome<T>>,
  ttls: IdempotentMutationTtls = DEFAULT_TTLS,
): Promise<{ outcome: MutationOutcome<T>; replayed: boolean }> {
  const scope = `${params.tenantId}:${params.namespace}:${params.operation}:${params.idempotencyKey}`;
  // Deterministic, not randomUUID(): the store's begin() (mirroring
  // InMemoryConnectorIdempotencyStore in @codestra/connector-kit) treats
  // commandId as part of the caller's identity for the command and rejects
  // a mismatch as request_mismatch. The enterprise connector API gets that
  // stability for free because its caller supplies commandId once and
  // reuses it on retry. The public Idempotency-Key API has no client-
  // supplied commandId, so every replay of the identical key+payload must
  // derive the identical commandId here too, or every replay looks like a
  // different command and is wrongly rejected as a mismatch instead of
  // replayed.
  const commandId = deterministicCommandId(scope);
  const requestHash = sha256Hex(
    canonicalizeJson({ tenantId: params.tenantId, operation: params.operation, payload: params.payload }),
  );

  const begin = await store.begin({ scope, requestHash, commandId, acquiredTtlSeconds: ttls.acquiredTtlSeconds });

  if (begin.state === "completed") {
    const cached = begin.result as unknown as ConnectorCommandResult & { data: { statusCode: number; body: T } };
    if (cached.status === "rejected") {
      throw errorFromCachedRejection(cached.data.statusCode, cached.data.body);
    }
    return { outcome: { status: cached.data.statusCode, body: cached.data.body }, replayed: true };
  }
  if (begin.state === "request_mismatch") {
    throw conflict(
      "IDEMPOTENCY_REQUEST_MISMATCH",
      "This Idempotency-Key was already used with a different request body.",
      { details: { scope } },
    );
  }
  if (begin.state === "in_progress") {
    throw conflict("IDEMPOTENCY_IN_PROGRESS", "An identical request is already being processed.", {
      retryable: true,
      details: { scope },
    });
  }
  if (begin.state === "indeterminate") {
    throw conflict(
      "IDEMPOTENCY_OUTCOME_INDETERMINATE",
      "A previous request with this Idempotency-Key has an unresolved outcome and must be reconciled before retrying.",
      { details: { scope } },
    );
  }

  const lease = begin.lease;

  try {
    await store.markDispatched(lease, ttls.dispatchTtlSeconds);
  } catch (error) {
    await store.releaseBeforeDispatch(lease).catch(() => undefined);
    throw new CodestraError(500, "IDEMPOTENCY_DISPATCH_PERSISTENCE_FAILED", "The idempotency ledger could not be updated; the request was not processed.", {
      retryable: true,
    });
  }

  let outcome: MutationOutcome<T>;
  try {
    outcome = await work();
  } catch (error) {
    if (error instanceof CodestraError && error.status >= 400 && error.status < 500) {
      // Definite, certain rejection — never touched external state beyond
      // this transaction, safe to cache and replay.
      await store
        .complete(
          lease,
          {
            commandId,
            status: "rejected",
            data: { statusCode: error.status, body: error.toBody(commandId) },
          } as unknown as ConnectorCommandResult,
          ttls.completedTtlSeconds,
        )
        .catch(() => undefined);
      throw error;
    }
    await store
      .markIndeterminate(
        lease,
        {
          code: error instanceof CodestraError ? error.code : "MUTATION_FAILED",
          message: error instanceof Error ? error.message : "Mutation failed for an unknown reason.",
          occurredAt: new Date().toISOString(),
          retryable: true,
        },
        ttls.dispatchTtlSeconds,
      )
      .catch(() => undefined);
    throw error;
  }

  await store.complete(
    lease,
    { commandId, status: "completed", data: { statusCode: outcome.status, body: outcome.body } } as unknown as ConnectorCommandResult,
    ttls.completedTtlSeconds,
  );
  return { outcome, replayed: false };
}

function errorFromCachedRejection(statusCode: number, body: JsonObject): CodestraError {
  const errorBody = (body as { error?: { code?: string; message?: string; retryable?: boolean; details?: JsonObject } }).error;
  return new CodestraError(statusCode, errorBody?.code ?? "REQUEST_REJECTED", errorBody?.message ?? "The request was rejected.", {
    retryable: errorBody?.retryable ?? false,
    ...(errorBody?.details === undefined ? {} : { details: errorBody.details }),
  });
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** UUID v5-shaped, derived deterministically from `scope` so every replay of the same (tenant, operation, Idempotency-Key) computes the identical commandId. */
function deterministicCommandId(scope: string): string {
  const digest = createHash("sha256").update(scope).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
