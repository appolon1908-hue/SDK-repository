import type { WebhookSubscription } from "@codestra/contracts";

function iso(minutesAgo: number): string {
  return new Date(Date.UTC(2026, 7, 28, 12, 0, 0) - minutesAgo * 60_000).toISOString();
}

export const DESTINATION_POLICY = {
  httpsOnly: true as const,
  privateAddressBlocked: true as const,
  redirectsBlocked: true as const,
};

export function buildWebhookSubscriptionFixtures(): WebhookSubscription[] {
  return [
    {
      id: "6f0a2b3c-1111-4222-8333-000000000001",
      endpointUrl: "https://hooks.example-tenant.dev/codestra/social-status",
      eventTypes: ["codestra.social.post.status.v1"],
      status: "active",
      verification: { status: "verified", verifiedAt: iso(4320) },
      destinationPolicy: DESTINATION_POLICY,
      createdAt: iso(10080),
      updatedAt: iso(4320),
    },
    {
      id: "6f0a2b3c-1111-4222-8333-000000000002",
      endpointUrl: "https://hooks.example-tenant.dev/codestra/delivery-status",
      eventTypes: ["codestra.webhook.delivery.status.v1"],
      status: "pending_verification",
      verification: { status: "pending", challengeId: "chal_9f21", lastAttemptAt: iso(15) },
      destinationPolicy: DESTINATION_POLICY,
      createdAt: iso(20),
      updatedAt: iso(15),
    },
    {
      id: "6f0a2b3c-1111-4222-8333-000000000003",
      endpointUrl: "https://retired.example-tenant.dev/codestra/legacy",
      eventTypes: ["codestra.social.post.status.v1"],
      status: "disabled",
      verification: { status: "verified", verifiedAt: iso(50000) },
      destinationPolicy: DESTINATION_POLICY,
      createdAt: iso(60000),
      updatedAt: iso(2000),
      disabledAt: iso(2000),
    },
  ];
}
