# `@codestra/provider-adapters`

Server-side adapters for the restricted Codestra gateways deployed beside Postiz, Odoo, Klyrow, Telnexa, and VICIdial.

Every adapter is disabled by default. Enabling an adapter is not sufficient to enable a mutation: each operation must also appear in `enabledOperations`, and the `@codestra/connector-kit` runner must receive all required tenant capabilities.

```ts
const klyrow = new KlyrowAdapter({
  baseUrl: process.env.KLYROW_RESTRICTED_GATEWAY_URL!,
  tokenProvider: () => secretProvider.getShortLivedToken("klyrow"),
  enabled: true,
  enabledOperations: [], // email.send remains impossible
});
```

These adapters call product-local restricted gateways, not raw provider APIs and never from browsers. Product-specific signature verification and normalization must be supplied through `webhookNormalizer`; unverified webhooks fail closed.
