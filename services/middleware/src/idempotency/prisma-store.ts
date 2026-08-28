import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  ConnectorConflictError,
  ConnectorError,
  type ConnectorCommandResult,
  type ConnectorIdempotencyBeginInput,
  type ConnectorIdempotencyLease,
  type ConnectorIdempotencySnapshot,
  type ConnectorIdempotencyStore,
  type ConnectorIndeterminateOutcome,
  type IdempotencyBeginResult,
  type ResolveIndeterminateInput,
} from "@codestra/connector-kit";

/**
 * Postgres-backed, transactionally-locked implementation of
 * `ConnectorIdempotencyStore` (packages/connector-kit/src/index.ts). It
 * reproduces the exact same state machine `InMemoryConnectorIdempotencyStore`
 * models — acquired -> dispatched -> (completed | indeterminate), with
 * indeterminate records never aging out except through explicit
 * reconciliation — but durably, with atomicity provided by row-level locks
 * (`SELECT ... FOR UPDATE`) inside a single database transaction per
 * operation instead of an in-process `Map`.
 *
 * Used both for the enterprise connector-command endpoint and, with a
 * per-tenant `scope` built from an API operation name instead of a
 * connector key, for every mutating public-API endpoint's
 * `Idempotency-Key` handling. One durable state machine, two callers.
 */
export class PrismaIdempotencyStore implements ConnectorIdempotencyStore {
  constructor(private readonly prisma: PrismaClient) {}

  async begin(input: ConnectorIdempotencyBeginInput): Promise<IdempotencyBeginResult> {
    return this.beginWithRetry(input, 5);
  }

  private async beginWithRetry(input: ConnectorIdempotencyBeginInput, attemptsLeft: number): Promise<IdempotencyBeginResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await selectForUpdate(tx, input.scope);
        const now = new Date();

        if (existing) {
          if (existing.request_hash !== input.requestHash || existing.command_id !== input.commandId) {
            return { state: "request_mismatch" as const, snapshot: toSnapshot(existing) };
          }

          if (existing.state === "succeeded" || existing.state === "failed") {
            if (existing.lease_expires_at > now) {
              return {
                state: "completed" as const,
                snapshot: toSnapshot(existing),
                result: existing.result_json as unknown as ConnectorCommandResult,
              };
            }
            // Completed TTL expired: allow a fresh acquisition, matching
            // InMemoryConnectorIdempotencyStore.cleanup(), which only ever
            // drops "acquired" and "completed" records on TTL expiry.
            const token = randomUUID();
            const leaseExpiresAt = new Date(now.getTime() + input.acquiredTtlSeconds * 1000);
            await tx.idempotentCommand.update({
              where: { scope: input.scope },
              data: {
                state: "pending",
                leaseToken: token,
                leaseExpiresAt,
                requestHash: input.requestHash,
                commandId: input.commandId,
                resultJson: Prisma.DbNull,
                outcomeJson: Prisma.DbNull,
              },
            });
            return {
              state: "acquired" as const,
              lease: { scope: input.scope, requestHash: input.requestHash, commandId: input.commandId, token },
            };
          }

          if (existing.state === "pending") {
            if (existing.lease_expires_at <= now) {
              const token = randomUUID();
              const leaseExpiresAt = new Date(now.getTime() + input.acquiredTtlSeconds * 1000);
              await tx.idempotentCommand.update({
                where: { scope: input.scope },
                data: { leaseToken: token, leaseExpiresAt, requestHash: input.requestHash, commandId: input.commandId },
              });
              return {
                state: "acquired" as const,
                lease: { scope: input.scope, requestHash: input.requestHash, commandId: input.commandId, token },
              };
            }
            return { state: "in_progress" as const, snapshot: toSnapshot(existing) };
          }

          // dispatched or indeterminate: never age out without explicit
          // reconciliation.
          return { state: "indeterminate" as const, snapshot: toSnapshot(existing) };
        }

        const token = randomUUID();
        const leaseExpiresAt = new Date(now.getTime() + input.acquiredTtlSeconds * 1000);
        await tx.idempotentCommand.create({
          data: {
            tenantId: tenantIdFromScope(input.scope),
            scope: input.scope,
            requestHash: input.requestHash,
            commandId: input.commandId,
            state: "pending",
            leaseToken: token,
            leaseExpiresAt,
          },
        });
        return {
          state: "acquired" as const,
          lease: { scope: input.scope, requestHash: input.requestHash, commandId: input.commandId, token },
        };
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error) && attemptsLeft > 0) {
        // Two concurrent first-time requests raced the INSERT. The loser
        // retries and will observe the winner's committed row through
        // SELECT ... FOR UPDATE.
        return this.beginWithRetry(input, attemptsLeft - 1);
      }
      throw error;
    }
  }

  async markDispatched(lease: ConnectorIdempotencyLease, reviewTtlSeconds: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const record = await this.requireLease(tx, lease, ["pending"]);
      await tx.idempotentCommand.update({
        where: { scope: record.scope },
        data: { state: "dispatched", leaseExpiresAt: new Date(Date.now() + reviewTtlSeconds * 1000) },
      });
    });
  }

  async complete(lease: ConnectorIdempotencyLease, result: ConnectorCommandResult, completedTtlSeconds: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const record = await this.requireLease(tx, lease, ["dispatched", "indeterminate"]);
      await tx.idempotentCommand.update({
        where: { scope: record.scope },
        data: {
          state: result.status === "rejected" ? "failed" : "succeeded",
          resultJson: result as unknown as Prisma.InputJsonValue,
          outcomeJson: Prisma.DbNull,
          leaseToken: null,
          leaseExpiresAt: new Date(Date.now() + completedTtlSeconds * 1000),
        },
      });
    });
  }

  async markIndeterminate(lease: ConnectorIdempotencyLease, outcome: ConnectorIndeterminateOutcome, reviewTtlSeconds: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const record = await this.requireLease(tx, lease, ["dispatched", "indeterminate"]);
      await tx.idempotentCommand.update({
        where: { scope: record.scope },
        data: {
          state: "indeterminate",
          outcomeJson: outcome as unknown as Prisma.InputJsonValue,
          leaseExpiresAt: new Date(Date.now() + reviewTtlSeconds * 1000),
        },
      });
    });
  }

  async releaseBeforeDispatch(lease: ConnectorIdempotencyLease): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await selectForUpdate(tx, lease.scope);
      if (
        existing &&
        existing.state === "pending" &&
        existing.lease_token === lease.token &&
        existing.request_hash === lease.requestHash &&
        existing.command_id === lease.commandId
      ) {
        await tx.idempotentCommand.delete({ where: { scope: lease.scope } });
      }
    });
  }

  async resolveIndeterminate(input: ResolveIndeterminateInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await selectForUpdate(tx, input.scope);
      if (!existing) {
        throw new ConnectorConflictError(
          "No idempotency record exists for reconciliation.",
          "IDEMPOTENCY_RECORD_NOT_FOUND",
          { retryable: false, details: { scope: input.scope } },
        );
      }
      if (existing.request_hash !== input.requestHash) {
        throw requestMismatchError(toSnapshot(existing));
      }
      if (existing.state !== "dispatched" && existing.state !== "indeterminate") {
        throw new ConnectorConflictError(
          `Idempotency record cannot be reconciled from state ${existing.state}.`,
          "IDEMPOTENCY_STATE_CONFLICT",
          { retryable: false, details: { scope: input.scope, state: existing.state } },
        );
      }
      await tx.idempotentCommand.update({
        where: { scope: input.scope },
        data: {
          state: input.result.status === "rejected" ? "failed" : "succeeded",
          resultJson: input.result as unknown as Prisma.InputJsonValue,
          outcomeJson: Prisma.DbNull,
          leaseToken: null,
          leaseExpiresAt: new Date(Date.now() + input.completedTtlSeconds * 1000),
        },
      });
    });
  }

  async get(scope: string): Promise<ConnectorIdempotencySnapshot | undefined> {
    const row = await this.prisma.idempotentCommand.findUnique({ where: { scope } });
    return row ? toSnapshot(toRawRow(row)) : undefined;
  }

  private async requireLease(
    tx: Prisma.TransactionClient,
    lease: ConnectorIdempotencyLease,
    allowedStates: readonly RawState[],
  ): Promise<RawRow> {
    const existing = await selectForUpdate(tx, lease.scope);
    if (
      !existing ||
      existing.lease_token !== lease.token ||
      existing.request_hash !== lease.requestHash ||
      existing.command_id !== lease.commandId ||
      !allowedStates.includes(existing.state)
    ) {
      throw new ConnectorConflictError(
        "The idempotency lease was lost or is no longer in the expected state.",
        "IDEMPOTENCY_LEASE_LOST",
        { retryable: false, details: { scope: lease.scope } },
      );
    }
    return existing;
  }
}

type RawState = "pending" | "dispatched" | "succeeded" | "failed" | "indeterminate";

interface RawRow {
  scope: string;
  tenant_id: string;
  request_hash: string;
  command_id: string;
  state: RawState;
  lease_token: string | null;
  lease_expires_at: Date;
  result_json: unknown;
  outcome_json: unknown;
}

async function selectForUpdate(tx: Prisma.TransactionClient, scope: string): Promise<RawRow | undefined> {
  const rows = await tx.$queryRaw<RawRow[]>(
    Prisma.sql`SELECT scope, tenant_id, request_hash, command_id, state, lease_token, lease_expires_at, result_json, outcome_json
               FROM idempotent_commands WHERE scope = ${scope} FOR UPDATE`,
  );
  return rows[0];
}

function toRawRow(row: {
  scope: string;
  tenantId: string;
  requestHash: string;
  commandId: string;
  state: string;
  leaseToken: string | null;
  leaseExpiresAt: Date;
  resultJson: unknown;
  outcomeJson: unknown;
}): RawRow {
  return {
    scope: row.scope,
    tenant_id: row.tenantId,
    request_hash: row.requestHash,
    command_id: row.commandId,
    state: row.state as RawState,
    lease_token: row.leaseToken,
    lease_expires_at: row.leaseExpiresAt,
    result_json: row.resultJson,
    outcome_json: row.outcomeJson,
  };
}

function toSnapshot(row: RawRow): ConnectorIdempotencySnapshot {
  const state = row.state === "pending" ? "acquired" : row.state === "succeeded" || row.state === "failed" ? "completed" : row.state;
  return {
    scope: row.scope,
    requestHash: row.request_hash,
    commandId: row.command_id,
    state,
    expiresAtEpochSeconds: Math.floor(row.lease_expires_at.getTime() / 1000),
    ...(row.result_json === null || row.result_json === undefined
      ? {}
      : { result: row.result_json as ConnectorCommandResult }),
    ...(row.outcome_json === null || row.outcome_json === undefined
      ? {}
      : { outcome: row.outcome_json as ConnectorIndeterminateOutcome }),
  };
}

function requestMismatchError(snapshot: ConnectorIdempotencySnapshot): ConnectorConflictError {
  return new ConnectorConflictError(
    "The idempotency key was already used for a different request.",
    "IDEMPOTENCY_REQUEST_MISMATCH",
    {
      retryable: false,
      details: { scope: snapshot.scope, existingRequestHash: snapshot.requestHash, existingCommandId: snapshot.commandId },
    },
  );
}

/** Scopes are always built as `${tenantId}:${namespace}:${operation}:${key}`. */
function tenantIdFromScope(scope: string): string {
  const tenantId = scope.split(":")[0];
  if (!tenantId) {
    throw new ConnectorError("Idempotency scope must be prefixed with a tenant ID.", "INVALID_SCOPE");
  }
  return tenantId;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
