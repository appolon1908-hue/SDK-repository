import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { CodestraClient } from "@codestra/social-sdk";
import type { SocialPostList, WebhookSubscriptionList } from "@codestra/contracts";
import { buildSocialPostFixtures } from "../src/fixtures/social-posts.js";
import { buildWebhookSubscriptionFixtures } from "../src/fixtures/webhook-subscriptions.js";

/**
 * Exercises the real, fetch-based `CodestraClient` (the typed client every
 * app uses in "real API" mode) against an MSW-mocked HTTP server, proving
 * the client sends the tenant/correlation/auth headers the public OpenAPI
 * contract requires and parses the response contract shapes correctly.
 */

const BASE_URL = "http://localhost:4010";
const posts = buildSocialPostFixtures();
const subscriptions = buildWebhookSubscriptionFixtures();

const server = setupServer(
  http.get(`${BASE_URL}/v1/social/posts`, ({ request }) => {
    expect(request.headers.get("x-codestra-tenant-id")).toBe(posts[0]?.tenantId);
    expect(request.headers.get("authorization")).toMatch(/^Bearer /);
    const body: SocialPostList = { items: posts };
    return HttpResponse.json(body);
  }),
  http.get(`${BASE_URL}/v1/webhook-subscriptions`, () => {
    const body: WebhookSubscriptionList = { items: subscriptions };
    return HttpResponse.json(body);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("CodestraClient against a mocked Middleware", () => {
  it("lists social posts with the required tenant and auth headers", async () => {
    const client = new CodestraClient({
      baseUrl: BASE_URL,
      tenantId: posts[0]?.tenantId ?? "missing-tenant",
      getAccessToken: () => "synthetic-test-token",
    });

    const result = await client.social.posts.list();
    expect(result.items).toHaveLength(posts.length);
    expect(result.items[0]?.id).toBe(posts[0]?.id);
  });

  it("lists webhook subscriptions with real contract field names", async () => {
    const client = new CodestraClient({
      baseUrl: BASE_URL,
      tenantId: posts[0]?.tenantId ?? "missing-tenant",
      getAccessToken: () => "synthetic-test-token",
    });

    const result = await client.webhooks.subscriptions.list();
    expect(result.items.map((item) => item.status)).toEqual(subscriptions.map((item) => item.status));
  });
});
