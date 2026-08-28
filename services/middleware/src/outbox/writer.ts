import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { JsonObject } from "@codestra/contracts";

/**
 * Writes one canonical event row transactionally alongside the state change
 * it describes (the outbox pattern) — call this with the same `tx` handle
 * used for the row mutation so both commit or both roll back together.
 *
 * A separate publisher process is expected to poll
 * `outbox_events WHERE published_at IS NULL`, emit each row to the event
 * bus under the type described in
 * contracts/asyncapi/codestra-events.asyncapi.yaml, and stamp
 * `publishedAt`. That publisher is a documented stub in this change — see
 * services/middleware/README.md — this function only guarantees the event
 * is durably and atomically recorded.
 */
export async function writeOutboxEvent(
  tx: Prisma.TransactionClient,
  event: { tenantId: string; eventType: string; subject?: string; payload: JsonObject; occurredAt?: Date },
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      id: randomUUID(),
      tenantId: event.tenantId,
      eventType: event.eventType,
      ...(event.subject === undefined ? {} : { subject: event.subject }),
      payload: event.payload as Prisma.InputJsonValue,
      occurredAt: event.occurredAt ?? new Date(),
    },
  });
}
