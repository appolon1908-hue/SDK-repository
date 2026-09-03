import type {
  CreateSocialPostInput,
  ListSocialPostsInput,
  SocialPost,
  SocialPostList,
  WebhookDeliveryTest,
  WebhookSubscription,
  WebhookSubscriptionCreated,
  WebhookSubscriptionInput,
  WebhookSubscriptionList,
  WebhookSubscriptionSecretRotation,
} from "@codestra/contracts";
import { CodestraContractViolationError } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SOCIAL_CHANNELS = new Set(["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"]);
const SOCIAL_STATUSES = new Set(["accepted", "scheduled", "publishing", "published", "partially_published", "failed", "cancelled"]);
const WEBHOOK_STATUSES = new Set(["pending_verification", "active", "disabled", "verification_failed"]);
const WEBHOOK_TEST_STATUSES = new Set(["queued", "rejected"]);

export function validateCreateSocialPostInput(input: CreateSocialPostInput): CreateSocialPostInput {
  const value = object(input, "body");
  uuid(value.workspaceId, "body.workspaceId");
  nonEmptyArray(value.channels, "body.channels").forEach((channel, index) => enumValue(channel, SOCIAL_CHANNELS, `body.channels[${index}]`));
  const content = object(value.content, "body.content");
  boundedString(content.text, "body.content.text", 1, 10_000);
  if (content.mediaUrls !== undefined) {
    nonEmptyArray(content.mediaUrls, "body.content.mediaUrls", true).forEach((url, index) => absoluteUri(url, `body.content.mediaUrls[${index}]`));
  }
  if (content.linkUrl !== undefined) absoluteUri(content.linkUrl, "body.content.linkUrl");
  if (value.publishAt !== undefined) dateTime(value.publishAt, "body.publishAt");
  return input;
}

export function validateListSocialPostsInput(input: ListSocialPostsInput): ListSocialPostsInput {
  const value = object(input, "query");
  if (value.cursor !== undefined) boundedString(value.cursor, "query.cursor", 1, 1000);
  if (value.limit !== undefined) integer(value.limit, "query.limit", 1, 100);
  if (value.workspaceId !== undefined) uuid(value.workspaceId, "query.workspaceId");
  if (value.status !== undefined) enumValue(value.status, SOCIAL_STATUSES, "query.status");
  return input;
}

export function validateWebhookSubscriptionInput(input: WebhookSubscriptionInput): WebhookSubscriptionInput {
  const value = object(input, "body");
  httpsUrl(value.endpointUrl, "body.endpointUrl");
  nonEmptyArray(value.eventTypes, "body.eventTypes").forEach((type, index) => boundedString(type, `body.eventTypes[${index}]`, 1, 200));
  if (value.description !== undefined) boundedString(value.description, "body.description", 0, 200);
  return input;
}

export function parseSocialPost(value: unknown, path = "response"): SocialPost {
  const post = object(value, path);
  uuid(post.id, `${path}.id`);
  uuid(post.tenantId, `${path}.tenantId`);
  uuid(post.workspaceId, `${path}.workspaceId`);
  enumValue(post.status, SOCIAL_STATUSES, `${path}.status`);
  nonEmptyArray(post.channels, `${path}.channels`, true).forEach((delivery, index) => {
    const item = object(delivery, `${path}.channels[${index}]`);
    enumValue(item.channel, SOCIAL_CHANNELS, `${path}.channels[${index}].channel`);
    enumValue(item.status, SOCIAL_STATUSES, `${path}.channels[${index}].status`);
  });
  object(post.content, `${path}.content`);
  if (post.publishAt !== undefined) dateTime(post.publishAt, `${path}.publishAt`);
  dateTime(post.createdAt, `${path}.createdAt`);
  dateTime(post.updatedAt, `${path}.updatedAt`);
  return post as unknown as SocialPost;
}

export function parseSocialPostList(value: unknown): SocialPostList {
  const list = object(value, "response");
  const items = nonEmptyArray(list.items, "response.items", true).map((item, index) => parseSocialPost(item, `response.items[${index}]`));
  if (list.nextCursor !== undefined) boundedString(list.nextCursor, "response.nextCursor", 1, 1000);
  return { items, ...(list.nextCursor === undefined ? {} : { nextCursor: String(list.nextCursor) }) };
}

export function parseWebhookSubscription(value: unknown, path = "response"): WebhookSubscription {
  const subscription = object(value, path);
  uuid(subscription.id, `${path}.id`);
  httpsUrl(subscription.endpointUrl, `${path}.endpointUrl`);
  nonEmptyArray(subscription.eventTypes, `${path}.eventTypes`).forEach((type, index) => boundedString(type, `${path}.eventTypes[${index}]`, 1, 200));
  enumValue(subscription.status, WEBHOOK_STATUSES, `${path}.status`);
  dateTime(subscription.createdAt, `${path}.createdAt`);
  dateTime(subscription.updatedAt, `${path}.updatedAt`);
  if (subscription.disabledAt !== undefined) dateTime(subscription.disabledAt, `${path}.disabledAt`);
  return subscription as unknown as WebhookSubscription;
}

export function parseWebhookSubscriptionCreated(value: unknown): WebhookSubscriptionCreated {
  const created = object(value, "response");
  const signingSecret = boundedString(created.signingSecret, "response.signingSecret", 28, 2048);
  if (!signingSecret.startsWith("whsec_")) violation("response.signingSecret must use whsec_ format.", "response.signingSecret");
  return {
    subscription: parseWebhookSubscription(created.subscription, "response.subscription"),
    signingSecret,
  };
}

export function parseWebhookSubscriptionList(value: unknown): WebhookSubscriptionList {
  const list = object(value, "response");
  const items = nonEmptyArray(list.items, "response.items", true).map((item, index) => parseWebhookSubscription(item, `response.items[${index}]`));
  if (list.nextCursor !== undefined) boundedString(list.nextCursor, "response.nextCursor", 1, 1000);
  return { items, ...(list.nextCursor === undefined ? {} : { nextCursor: String(list.nextCursor) }) };
}

export function parseWebhookDeliveryTest(value: unknown): WebhookDeliveryTest {
  const delivery = object(value, "response");
  uuid(delivery.deliveryId, "response.deliveryId");
  uuid(delivery.subscriptionId, "response.subscriptionId");
  enumValue(delivery.status, WEBHOOK_TEST_STATUSES, "response.status");
  dateTime(delivery.acceptedAt, "response.acceptedAt");
  return delivery as unknown as WebhookDeliveryTest;
}

export function parseWebhookSubscriptionSecretRotation(value: unknown): WebhookSubscriptionSecretRotation {
  const rotation = object(value, "response");
  const signingSecret = boundedString(rotation.signingSecret, "response.signingSecret", 28, 2048);
  if (!signingSecret.startsWith("whsec_")) violation("response.signingSecret must use whsec_ format.", "response.signingSecret");
  dateTime(rotation.previousSecretExpiresAt, "response.previousSecretExpiresAt");
  return {
    subscription: parseWebhookSubscription(rotation.subscription, "response.subscription"),
    signingSecret,
    previousSecretExpiresAt: String(rotation.previousSecretExpiresAt),
  };
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) violation(`${path} must be an object.`, path);
  return value as Record<string, unknown>;
}

function nonEmptyArray(value: unknown, path: string, allowEmpty = false): unknown[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) violation(`${path} must be a non-empty array.`, path);
  return value;
}

function boundedString(value: unknown, path: string, min: number, max: number): string {
  if (typeof value !== "string" || value.length < min || value.length > max || /[\u0000-\u001f]/u.test(value)) {
    violation(`${path} must be a bounded string.`, path);
  }
  return value;
}

function uuid(value: unknown, path: string): string {
  const text = boundedString(value, path, 1, 100);
  if (!UUID_PATTERN.test(text)) violation(`${path} must be a UUID.`, path);
  return text;
}

function dateTime(value: unknown, path: string): string {
  const text = boundedString(value, path, 1, 100);
  if (Number.isNaN(Date.parse(text))) violation(`${path} must be a date-time.`, path);
  return text;
}

function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    violation(`${path} must be an integer between ${min} and ${max}.`, path);
  }
  return value;
}

function absoluteUri(value: unknown, path: string): string {
  const text = boundedString(value, path, 1, 2048);
  try {
    new URL(text);
  } catch {
    violation(`${path} must be an absolute URI.`, path);
  }
  return text;
}

function httpsUrl(value: unknown, path: string): string {
  const text = absoluteUri(value, path);
  if (new URL(text).protocol !== "https:") violation(`${path} must use HTTPS.`, path);
  return text;
}

function enumValue(value: unknown, allowed: ReadonlySet<string>, path: string): string {
  const text = boundedString(value, path, 1, 200);
  if (!allowed.has(text)) violation(`${path} is not a supported value.`, path);
  return text;
}

function violation(message: string, path: string): never {
  throw new CodestraContractViolationError(message, path);
}
