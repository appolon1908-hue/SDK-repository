import { DataTable, StatTile, StatusPill } from "@codestra/apps-shared/ui";
import {
  buildConnectorCommandFixtures,
  buildConnectorHealthFixtures,
  CONNECTOR_COMMAND_OUTCOMES,
  CONNECTOR_KEYS,
  deriveCommandOutcome,
  type ConnectorCommandOutcome,
} from "@codestra/apps-shared/fixtures";

export default function ConnectorHealthPage(): JSX.Element {
  const health = buildConnectorHealthFixtures();
  const commands = buildConnectorCommandFixtures();

  const counts = Object.fromEntries(
    CONNECTOR_COMMAND_OUTCOMES.map((outcome) => [outcome, 0]),
  ) as Record<ConnectorCommandOutcome, number>;
  for (const record of commands) counts[deriveCommandOutcome(record)] += 1;

  return (
    <div>
      <h1>Connector command health</h1>
      <p className="cds-page-subtitle">
        Health per connector and the command lifecycle from <code>packages/connector-kit</code>&apos;s{" "}
        <code>ConnectorHealth</code> and <code>ConnectorIdempotencyRecordState</code> (acquired / dispatched /
        indeterminate / completed) types, mapped to the operator-facing outcomes below. Mock data: there is no
        connector-telemetry endpoint in the public OpenAPI contract yet.
      </p>

      <div className="cds-stat-row">
        {CONNECTOR_COMMAND_OUTCOMES.map((outcome) => (
          <StatTile key={outcome} label={outcome} value={counts[outcome]} />
        ))}
      </div>

      <section className="cds-section">
        <h2>Connector health</h2>
        <DataTable
          rows={CONNECTOR_KEYS.map((key) => ({ key, ...health[key] }))}
          getRowKey={(row) => row.key}
          columns={[
            { key: "connector", header: "Connector", render: (row) => row.key },
            { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
            {
              key: "latency",
              header: "Latency",
              render: (row) => (row.latencyMs === undefined ? "—" : `${row.latencyMs} ms`),
              align: "right",
            },
            { key: "checkedAt", header: "Checked at", render: (row) => new Date(row.checkedAt).toLocaleString() },
          ]}
        />
      </section>

      <section className="cds-section">
        <h2>Recent connector commands</h2>
        <DataTable
          rows={commands}
          getRowKey={(row) => row.command.commandId}
          columns={[
            { key: "operation", header: "Operation", render: (row) => row.command.operation },
            { key: "connector", header: "Connector", render: (row) => row.connectorKey },
            { key: "outcome", header: "Outcome", render: (row) => <StatusPill status={deriveCommandOutcome(row)} /> },
            {
              key: "idempotencyState",
              header: "Idempotency state",
              render: (row) => row.idempotencyState,
            },
            { key: "commandId", header: "Command ID", render: (row) => row.command.commandId },
            { key: "updatedAt", header: "Updated", render: (row) => new Date(row.updatedAt).toLocaleString() },
          ]}
        />
      </section>
    </div>
  );
}
