import { describe, expect, it, vi } from "vitest";
import { SvixDeliveryService } from "../src/index.js";

const command = {
  tenantId: "042880db-aa51-4f16-83b5-ae858ee45ad6",
  idempotencyKey: "idempotency-webhook-0001",
  event: {
    specversion: "1.0",
    id: "d0313dba-09f7-4cce-8894-195f72c62126",
    source: "/codestra/social",
    type: "codestra.social.post.status.v1",
    time: "2026-08-27T00:00:00Z",
    datacontenttype: "application/json",
    data: { status: "published" },
  },
} as const;

describe("SvixDeliveryService", () => {
  it("is disabled by default and performs no handoff", async () => {
    const create = vi.fn();
    const service = new SvixDeliveryService({
      client: { message: { create } },
      applicationResolver: { resolveApplicationId: async () => "app_tenant" },
    });
    await expect(service.deliver(command)).rejects.toMatchObject({ code: "SVIX_DELIVERY_DISABLED" });
    expect(create).not.toHaveBeenCalled();
  });

  it("passes both event identity and request idempotency to Svix", async () => {
    const create = vi.fn().mockResolvedValue({ id: "msg_123" });
    const service = new SvixDeliveryService({
      enabled: true,
      client: { message: { create } },
      applicationResolver: { resolveApplicationId: async () => "app_tenant" },
    });
    await service.deliver(command);
    expect(create).toHaveBeenCalledWith(
      "app_tenant",
      expect.objectContaining({
        eventId: command.event.id,
        eventType: command.event.type,
        payloadRetentionPeriod: 14,
      }),
      { idempotencyKey: command.idempotencyKey },
    );
  });
});
