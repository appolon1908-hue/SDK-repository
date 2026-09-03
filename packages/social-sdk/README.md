# `@codestra/social-sdk`

A tenant-aware client for Codestra's public social publishing and webhook-subscription APIs.

```ts
import { CodestraClient } from "@codestra/social-sdk";

const client = new CodestraClient({
  baseUrl: "https://api.codestra.co",
  tenantId,
  getAccessToken: async () => session.accessToken,
});

const post = await client.social.posts.create(
  {
    workspaceId,
    channels: ["linkedin", "facebook"],
    content: { text: "New product announcement" },
    publishAt: "2026-08-29T14:00:00Z",
  },
  { idempotencyKey: crypto.randomUUID() },
);
```

The client never stores tokens, never sends cookies, disables HTTP caching, rejects insecure non-loopback base URLs, and retries mutations only when an idempotency key is present.
