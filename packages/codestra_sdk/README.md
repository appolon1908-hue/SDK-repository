# codestra_sdk

`codestra_sdk` is the unified developer-facing Codestra package. Product teams import one SDK and use stable domain modules while backend ownership remains free to change behind Kong and Middleware.

```ts
import { createCodestraSdk } from "codestra_sdk";

const codestra = createCodestraSdk({
  baseUrl: "https://api.codestra.co",
  tenantId: "tenant-001",
  requestedBy: "moneybee-backend",
  getAccessToken: async () => token,
});

await codestra.marketing.campaigns.list();
await codestra.ai.generate({ prompt: "Summarize this lead." }, { idempotencyKey });
await codestra.communication.messages.send(
  { channel: "email", to: ["customer@example.com"], content: { subject: "Hi", text: "Hello" } },
  { idempotencyKey },
);
await codestra.social.posts.schedule(
  { workspaceId, channels: ["linkedin"], content: { text: "Launch update" }, publishAt },
  { idempotencyKey },
);
await codestra.crm.leads.get(leadId);
```

## Module Map

```text
codestra_sdk
  auth
  marketing
  ai
  communication
  social
  crm
  workflow
  events
  common
```

`communication` delegates to `@codestra/communications-sdk`. `social` delegates to `@codestra/social-sdk`. New domain packages should be mounted here first so product code keeps importing one stable SDK.
