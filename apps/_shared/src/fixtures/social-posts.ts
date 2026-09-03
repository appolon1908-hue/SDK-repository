import type { SocialPost } from "@codestra/contracts";
import { defaultStubTenantId } from "../auth/session.js";

const WORKSPACE_ID = "204ddc3a-3a33-445f-bfc5-0bb15167b624";

function iso(minutesAgo: number): string {
  return new Date(Date.UTC(2026, 7, 28, 12, 0, 0) - minutesAgo * 60_000).toISOString();
}

export function buildSocialPostFixtures(tenantId: string = defaultStubTenantId()): SocialPost[] {
  return [
    {
      id: "d0313dba-09f7-4cce-8894-195f72c62126",
      tenantId,
      workspaceId: WORKSPACE_ID,
      status: "published",
      channels: [
        { channel: "facebook", status: "published", externalId: "fb_9182" },
        { channel: "instagram", status: "published", externalId: "ig_4471" },
      ],
      content: { text: "Codestra 0.1 ships contract-first SDKs for social, webhooks, and connectors." },
      createdAt: iso(240),
      updatedAt: iso(180),
    },
    {
      id: "d0313dba-09f7-4cce-8894-195f72c62127",
      tenantId,
      workspaceId: WORKSPACE_ID,
      status: "partially_published",
      channels: [
        { channel: "x", status: "published", externalId: "x_5521" },
        { channel: "linkedin", status: "failed", failureCode: "PROVIDER_RATE_LIMITED", failureMessage: "LinkedIn API rate limit exceeded." },
      ],
      content: { text: "Webhook subscriptions now support secret rotation with an overlap window." },
      createdAt: iso(120),
      updatedAt: iso(60),
    },
    {
      id: "d0313dba-09f7-4cce-8894-195f72c62128",
      tenantId,
      workspaceId: WORKSPACE_ID,
      status: "scheduled",
      channels: [{ channel: "youtube", status: "scheduled" }],
      content: { text: "Upcoming: connector-kit's idempotency and reconciliation walkthrough." },
      publishAt: iso(-1440),
      createdAt: iso(30),
      updatedAt: iso(30),
    },
    {
      id: "d0313dba-09f7-4cce-8894-195f72c62129",
      tenantId,
      workspaceId: WORKSPACE_ID,
      status: "publishing",
      channels: [{ channel: "tiktok", status: "publishing" }],
      content: { text: "Live: connector command dispatched to TikTok." },
      createdAt: iso(5),
      updatedAt: iso(1),
    },
  ];
}
