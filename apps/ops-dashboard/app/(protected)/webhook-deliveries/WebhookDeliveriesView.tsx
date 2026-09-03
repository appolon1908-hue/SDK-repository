import type { WebhookSubscription } from "@codestra/contracts";
import type { WebhookDeliveryStatusEvent } from "@codestra/apps-shared/fixtures";
import { DataTable, StatusPill } from "@codestra/apps-shared/ui";

export interface WebhookDeliveriesViewProps {
  subscriptions: readonly WebhookSubscription[];
  deliveries: readonly WebhookDeliveryStatusEvent[];
}

export function WebhookDeliveriesView({ subscriptions, deliveries }: WebhookDeliveriesViewProps): JSX.Element {
  const endpointById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));

  return (
    <div>
      <h1>Webhook delivery feed</h1>
      <p className="cds-page-subtitle">
        Delivery attempts shaped like the AsyncAPI <code>codestra.webhook.delivery.status.v1</code> message from{" "}
        <code>contracts/asyncapi/codestra-events.asyncapi.yaml</code>. The endpoints are the tenant&apos;s real
        webhook subscriptions (via <code>webhooks.subscriptions.list</code>); the delivery events themselves are
        mocked -- the public API has no delivery-history operation yet.
      </p>
      <DataTable
        rows={deliveries}
        getRowKey={(row) => row.deliveryId}
        emptyMessage="No webhook subscriptions to correlate deliveries with yet."
        columns={[
          { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
          {
            key: "endpoint",
            header: "Endpoint",
            render: (row) => endpointById.get(row.endpointId)?.endpointUrl ?? row.endpointId,
          },
          { key: "attempt", header: "Attempt", render: (row) => row.attempt, align: "right" },
          { key: "deliveryId", header: "Delivery ID", render: (row) => row.deliveryId },
          { key: "occurredAt", header: "Occurred at", render: (row) => new Date(row.occurredAt).toLocaleString() },
        ]}
      />
    </div>
  );
}
