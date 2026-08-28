# `@codestra/webhook-sdk`

Standard Webhooks-compatible HMAC signing and verification with secret rotation and pluggable atomic replay protection.

```ts
const verified = await verifyAndClaimWebhook(
  {
    id: request.headers.get("webhook-id")!,
    timestamp: request.headers.get("webhook-timestamp")!,
    signature: request.headers.get("webhook-signature")!,
    payload: rawBody,
    secrets: activeSecrets,
  },
  redisReplayStore,
);
```

Always pass the exact raw request bytes. Do not parse and reserialize JSON before verification. The in-memory replay store is only for tests and single-process development; production consumers must supply an atomic shared store such as Redis or a database uniqueness constraint.
