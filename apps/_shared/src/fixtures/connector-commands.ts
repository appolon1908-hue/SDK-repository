import type {
  ConnectorCommand,
  ConnectorCommandStatus,
  ConnectorHealth,
  ConnectorHealthStatus,
  ConnectorIdempotencyRecordState,
} from "@codestra/connector-kit";
import type { ISODateTime, SocialChannel } from "@codestra/contracts";

/**
 * Mocked ops-dashboard data. Nothing here is served by a real Middleware
 * endpoint yet -- there is no public API surface for connector-command
 * telemetry in `contracts/openapi/codestra-public.openapi.yaml`. The shapes
 * below reuse the real `packages/connector-kit` types so the dashboard is
 * ready to bind to a real telemetry endpoint the moment Middleware exposes
 * one; only the data is synthetic.
 */

export const CONNECTOR_KEYS: readonly SocialChannel[] = [
  "facebook",
  "instagram",
  "linkedin",
  "x",
  "youtube",
  "tiktok",
];

export interface ConnectorCommandRecord {
  command: ConnectorCommand;
  connectorKey: SocialChannel;
  idempotencyState: ConnectorIdempotencyRecordState;
  resultStatus?: ConnectorCommandStatus;
  updatedAt: ISODateTime;
}

/**
 * The operator-facing 5-state lifecycle a connector command moves through,
 * derived from the real `ConnectorIdempotencyRecordState` (acquired /
 * dispatched / indeterminate / completed) recorded by
 * `ConnectorIdempotencyStore` plus the `ConnectorCommandResult.status`
 * (accepted / completed / rejected) it completes with.
 */
export type ConnectorCommandOutcome = "pending" | "dispatched" | "succeeded" | "failed" | "indeterminate";

export const CONNECTOR_COMMAND_OUTCOMES: readonly ConnectorCommandOutcome[] = [
  "pending",
  "dispatched",
  "succeeded",
  "failed",
  "indeterminate",
];

export function deriveCommandOutcome(
  record: Pick<ConnectorCommandRecord, "idempotencyState" | "resultStatus">,
): ConnectorCommandOutcome {
  switch (record.idempotencyState) {
    case "acquired":
      return "pending";
    case "dispatched":
      return "dispatched";
    case "indeterminate":
      return "indeterminate";
    case "completed":
      return record.resultStatus === "rejected" ? "failed" : "succeeded";
    default:
      return "indeterminate";
  }
}

function iso(minutesAgo: number): ISODateTime {
  return new Date(Date.UTC(2026, 7, 28, 12, 0, 0) - minutesAgo * 60_000).toISOString();
}

export function buildConnectorHealthFixtures(): Record<SocialChannel, ConnectorHealth> {
  const statuses: Record<SocialChannel, ConnectorHealthStatus> = {
    facebook: "healthy",
    instagram: "healthy",
    linkedin: "degraded",
    x: "healthy",
    youtube: "unavailable",
    tiktok: "disabled",
  };
  const latency: Record<SocialChannel, number | undefined> = {
    facebook: 142,
    instagram: 188,
    linkedin: 910,
    x: 96,
    youtube: undefined,
    tiktok: undefined,
  };

  const entries = CONNECTOR_KEYS.map((key) => {
    const health: ConnectorHealth = {
      status: statuses[key],
      checkedAt: iso(1),
      ...(latency[key] === undefined ? {} : { latencyMs: latency[key] }),
      ...(statuses[key] === "unavailable"
        ? { details: { reason: "Provider OAuth token expired." } }
        : {}),
    };
    return [key, health] as const;
  });

  return Object.fromEntries(entries) as Record<SocialChannel, ConnectorHealth>;
}

export function buildConnectorCommandFixtures(): ConnectorCommandRecord[] {
  const rows: Array<Omit<ConnectorCommandRecord, "command"> & { operation: string; commandId: string }> = [
    {
      commandId: "8b4a5f1e-1e1a-4b3a-9b1a-000000000001",
      operation: "publishPost",
      connectorKey: "facebook",
      idempotencyState: "completed",
      resultStatus: "completed",
      updatedAt: iso(2),
    },
    {
      commandId: "8b4a5f1e-1e1a-4b3a-9b1a-000000000002",
      operation: "publishPost",
      connectorKey: "instagram",
      idempotencyState: "completed",
      resultStatus: "completed",
      updatedAt: iso(4),
    },
    {
      commandId: "8b4a5f1e-1e1a-4b3a-9b1a-000000000003",
      operation: "publishPost",
      connectorKey: "linkedin",
      idempotencyState: "indeterminate",
      updatedAt: iso(6),
    },
    {
      commandId: "8b4a5f1e-1e1a-4b3a-9b1a-000000000004",
      operation: "cancelPost",
      connectorKey: "x",
      idempotencyState: "dispatched",
      updatedAt: iso(1),
    },
    {
      commandId: "8b4a5f1e-1e1a-4b3a-9b1a-000000000005",
      operation: "publishPost",
      connectorKey: "youtube",
      idempotencyState: "completed",
      resultStatus: "rejected",
      updatedAt: iso(12),
    },
    {
      commandId: "8b4a5f1e-1e1a-4b3a-9b1a-000000000006",
      operation: "publishPost",
      connectorKey: "tiktok",
      idempotencyState: "acquired",
      updatedAt: iso(0),
    },
    {
      commandId: "8b4a5f1e-1e1a-4b3a-9b1a-000000000007",
      operation: "publishPost",
      connectorKey: "facebook",
      idempotencyState: "acquired",
      updatedAt: iso(0),
    },
    {
      commandId: "8b4a5f1e-1e1a-4b3a-9b1a-000000000008",
      operation: "publishPost",
      connectorKey: "x",
      idempotencyState: "completed",
      resultStatus: "completed",
      updatedAt: iso(20),
    },
  ];

  return rows.map((row) => ({
    connectorKey: row.connectorKey,
    idempotencyState: row.idempotencyState,
    ...(row.resultStatus === undefined ? {} : { resultStatus: row.resultStatus }),
    updatedAt: row.updatedAt,
    command: {
      commandId: row.commandId,
      operation: row.operation,
      payload: { channel: row.connectorKey },
      requestedAt: row.updatedAt,
      idempotencyKey: `synthetic-${row.commandId}`,
    },
  }));
}
