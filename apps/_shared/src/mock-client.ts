import { CodestraApiError, type CodestraClient } from "@codestra/social-sdk";
import type {
  CreateSocialPostInput,
  ListSocialPostsInput,
  SocialPost,
  SocialPostList,
  UUID,
  WebhookDeliveryTest,
  WebhookSubscription,
  WebhookSubscriptionCreated,
  WebhookSubscriptionInput,
  WebhookSubscriptionList,
  WebhookSubscriptionSecretRotation,
} from "@codestra/contracts";
import { defaultStubTenantId } from "./auth/session.js";
import { buildSocialPostFixtures } from "./fixtures/social-posts.js";
import { buildWebhookSubscriptionFixtures, DESTINATION_POLICY } from "./fixtures/webhook-subscriptions.js";

/**
 * The subset of `CodestraClient` (from `@codestra/social-sdk`) that every
 * app depends on. Both the real client and this mock implement it, so pages
 * and components never need to know which one they were handed.
 */
export type CodestraApiClient = Pick<CodestraClient, "social" | "webhooks">;

let socialPosts: SocialPost[] = buildSocialPostFixtures();
let webhookSubscriptions: WebhookSubscription[] = buildWebhookSubscriptionFixtures();
let sequence = 1;

/** Test-only: restores the mock store to its initial fixture state. */
export function resetMockStore(): void {
  socialPosts = buildSocialPostFixtures();
  webhookSubscriptions = buildWebhookSubscriptionFixtures();
  sequence = 1;
}

function nextId(): UUID {
  sequence += 1;
  return `00000000-mock-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function notFound(resource: string): CodestraApiError {
  return new CodestraApiError({
    message: `${resource} was not found.`,
    code: "NOT_FOUND",
    status: 404,
    retryable: false,
  });
}

/**
 * An in-memory implementation of the public API's social-post and
 * webhook-subscription operations, used whenever `NEXT_PUBLIC_CODESTRA_API_URL`
 * is unset. It mutates a module-level store so create/list/enable/disable
 * flows are fully interactive in local dev without any network calls --
 * this is the "simple in-memory fixtures" half of the mocking strategy
 * described in the repo task; `test/msw-client.test.ts` exercises the real
 * HTTP `CodestraClient` against an MSW server for the other half.
 */
export function createMockCodestraApiClient(): CodestraApiClient {
  return {
    social: {
      posts: {
        async create(input: CreateSocialPostInput): Promise<SocialPost> {
          const post: SocialPost = {
            id: nextId(),
            tenantId: defaultStubTenantId(),
            workspaceId: input.workspaceId,
            status: input.publishAt ? "scheduled" : "accepted",
            channels: input.channels.map((channel) => ({ channel, status: input.publishAt ? "scheduled" : "accepted" })),
            content: input.content,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            ...(input.publishAt === undefined ? {} : { publishAt: input.publishAt }),
          };
          socialPosts = [post, ...socialPosts];
          return post;
        },
        async list(input: ListSocialPostsInput = {}): Promise<SocialPostList> {
          const items = socialPosts.filter((post) => {
            if (input.workspaceId && post.workspaceId !== input.workspaceId) return false;
            if (input.status && post.status !== input.status) return false;
            return true;
          });
          const limit = input.limit ?? items.length;
          return { items: items.slice(0, limit) };
        },
        async get(postId: UUID): Promise<SocialPost> {
          const found = socialPosts.find((post) => post.id === postId);
          if (!found) throw notFound(`Social post ${postId}`);
          return found;
        },
        async cancel(postId: UUID): Promise<SocialPost> {
          const found = socialPosts.find((post) => post.id === postId);
          if (!found) throw notFound(`Social post ${postId}`);
          found.status = "cancelled";
          found.updatedAt = nowIso();
          return found;
        },
      },
    },
    webhooks: {
      subscriptions: {
        async create(input: WebhookSubscriptionInput): Promise<WebhookSubscriptionCreated> {
          const subscription: WebhookSubscription = {
            id: nextId(),
            endpointUrl: input.endpointUrl,
            eventTypes: input.eventTypes,
            status: "pending_verification",
            verification: { status: "pending" },
            destinationPolicy: DESTINATION_POLICY,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          webhookSubscriptions = [subscription, ...webhookSubscriptions];
          return { subscription, signingSecret: `whsec_mock_${nextId().slice(-12)}` };
        },
        async list(): Promise<WebhookSubscriptionList> {
          return { items: webhookSubscriptions };
        },
        async get(subscriptionId: UUID): Promise<WebhookSubscription> {
          const found = webhookSubscriptions.find((sub) => sub.id === subscriptionId);
          if (!found) throw notFound(`Webhook subscription ${subscriptionId}`);
          return found;
        },
        async test(subscriptionId: UUID): Promise<WebhookDeliveryTest> {
          const found = webhookSubscriptions.find((sub) => sub.id === subscriptionId);
          if (!found) throw notFound(`Webhook subscription ${subscriptionId}`);
          return {
            deliveryId: nextId(),
            subscriptionId,
            status: "queued" as const,
            acceptedAt: nowIso(),
          };
        },
        async rotateSecret(subscriptionId: UUID): Promise<WebhookSubscriptionSecretRotation> {
          const found = webhookSubscriptions.find((sub) => sub.id === subscriptionId);
          if (!found) throw notFound(`Webhook subscription ${subscriptionId}`);
          found.updatedAt = nowIso();
          return {
            subscription: found,
            signingSecret: `whsec_mock_${nextId().slice(-12)}`,
            previousSecretExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          };
        },
        async enable(subscriptionId: UUID): Promise<WebhookSubscription> {
          const found = webhookSubscriptions.find((sub) => sub.id === subscriptionId);
          if (!found) throw notFound(`Webhook subscription ${subscriptionId}`);
          found.status = "active";
          found.updatedAt = nowIso();
          delete found.disabledAt;
          return found;
        },
        async disable(subscriptionId: UUID): Promise<WebhookSubscription> {
          const found = webhookSubscriptions.find((sub) => sub.id === subscriptionId);
          if (!found) throw notFound(`Webhook subscription ${subscriptionId}`);
          found.status = "disabled";
          found.updatedAt = nowIso();
          found.disabledAt = nowIso();
          return found;
        },
        async delete(subscriptionId: UUID): Promise<void> {
          const before = webhookSubscriptions.length;
          webhookSubscriptions = webhookSubscriptions.filter((sub) => sub.id !== subscriptionId);
          if (webhookSubscriptions.length === before) throw notFound(`Webhook subscription ${subscriptionId}`);
        },
      },
    },
  };
}
