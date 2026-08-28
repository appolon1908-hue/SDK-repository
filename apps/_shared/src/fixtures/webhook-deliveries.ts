import type { ISODateTime, UUID } from "@codestra/contracts";

/**
 * Shape matches the `webhookDeliveryStatusChanged` message data in
 * `contracts/asyncapi/codestra-events.asyncapi.yaml` (channel
 * `codestra.webhook.delivery.status.v1`). There is no public API operation
 * that lists delivery attempts yet, so the ops dashboard's delivery feed is
 * mocked -- the field names and status enum are the real contract's.
 */
export interface WebhookDeliveryStatusEvent {
  deliveryId: UUID;
  endpointId: UUID;
  status: "queued" | "attempting" | "delivered" | "failed" | "dead_lettered";
  attempt: number;
  occurredAt: ISODateTime;
}

function iso(minutesAgo: number): ISODateTime {
  return new Date(Date.UTC(2026, 7, 28, 12, 0, 0) - minutesAgo * 60_000).toISOString();
}

export function buildWebhookDeliveryFixtures(endpointIds: readonly UUID[]): WebhookDeliveryStatusEvent[] {
  const [first, second, third] = endpointIds;
  const events: WebhookDeliveryStatusEvent[] = [
    {
      deliveryId: "3f2a1c10-0000-4000-8000-000000000001",
      endpointId: first ?? "00000000-0000-0000-0000-000000000000",
      status: "delivered",
      attempt: 1,
      occurredAt: iso(3),
    },
    {
      deliveryId: "3f2a1c10-0000-4000-8000-000000000002",
      endpointId: second ?? first ?? "00000000-0000-0000-0000-000000000000",
      status: "attempting",
      attempt: 2,
      occurredAt: iso(1),
    },
    {
      deliveryId: "3f2a1c10-0000-4000-8000-000000000003",
      endpointId: third ?? first ?? "00000000-0000-0000-0000-000000000000",
      status: "failed",
      attempt: 3,
      occurredAt: iso(9),
    },
    {
      deliveryId: "3f2a1c10-0000-4000-8000-000000000004",
      endpointId: first ?? "00000000-0000-0000-0000-000000000000",
      status: "dead_lettered",
      attempt: 6,
      occurredAt: iso(180),
    },
    {
      deliveryId: "3f2a1c10-0000-4000-8000-000000000005",
      endpointId: second ?? first ?? "00000000-0000-0000-0000-000000000000",
      status: "queued",
      attempt: 1,
      occurredAt: iso(0),
    },
  ];
  return events;
}
