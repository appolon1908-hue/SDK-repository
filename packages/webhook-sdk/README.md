# `@codestra/webhook-sdk`

Standard Webhooks-compatible HMAC signing and verification with secret rotation, scoped processing leases, and pluggable atomic replay protection.

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

For durable consumers, scope the claim to the tenant, endpoint, signer type, and event ID, then explicitly complete or fail the processing lease.

```ts
const verified = await verifyAndClaimWebhookProcessing(
  {
    id: request.headers.get("webhook-id")!,
    timestamp: request.headers.get("webhook-timestamp")!,
    signature: request.headers.get("webhook-signature")!,
    payload: rawBody,
    secrets: activeSecrets,
  },
  webhookProcessingStore,
  {
    tenantId,
    endpointId,
    signerType: "current",
    eventId: request.headers.get("webhook-id")!,
    processingTtlSeconds: 300,
  },
);

try {
  await handleEvent(rawBody);
  await webhookProcessingStore.markProcessed(verified.lease, Math.floor(Date.now() / 1_000));
} catch (error) {
  await webhookProcessingStore.markFailed(verified.lease, Math.floor(Date.now() / 1_000), {
    code: "HANDLER_FAILED",
    message: error instanceof Error ? error.message : "Handler failed",
  });
  throw error;
}
```

Always pass the exact raw request bytes. Do not parse and reserialize JSON before verification. The in-memory stores are only for tests and single-process development; production consumers must supply an atomic shared store such as Redis or a database table with conditional writes and lease-token compare-and-set updates.
