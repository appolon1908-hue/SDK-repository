# @codestra/communications-sdk

Provider-neutral email, SMS, and voice facade for Codestra products.

This package does not talk directly to Postal, Jasmin, Telnexa, VICIdial, SMTP, SMS gateways, or voice providers. It submits durable commands to the Codestra Middleware control plane:

```text
POST /v1/commands
GET  /v1/operations/{command_id}
```

Kong and Keycloak remain the public authentication boundary, while Middleware owns tenant authorization, idempotency, provider dispatch, read-back, and reconciliation.

```ts
import { CodestraCommunicationsClient } from "@codestra/communications-sdk";

const communications = new CodestraCommunicationsClient({
  baseUrl: "https://api.codestra.co",
  tenantId: "tenant-123",
  requestedBy: "moneybee-backend",
  getAccessToken: async () => process.env.CODESTRA_TOKEN!,
});

const operation = await communications.email.send(
  {
    from: { email: "support@example.com", name: "Support" },
    to: [{ email: "customer@example.com" }],
    subject: "Application update",
    content: { text: "Your application was received." },
  },
  { idempotencyKey: "moneybee-application-123-email-1" },
);
```

Mutation methods require an idempotency key. Provider credentials and provider-specific operational fields must stay server-side.
