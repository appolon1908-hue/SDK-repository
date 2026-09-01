# Communications SDK Production Readiness

The SDK repository is the canonical contract authority for Codestra Communications API v1. Product backends should import generated or typed SDK clients instead of hand-writing HTTP calls to Middleware, Klyrow, Telnexa, VICIdial, Postly, or crawler providers.

## Ready in this branch

- Canonical OpenAPI surface for `/v1/communications/messages`, templates, sender identities, domains, suppressions, preferences, provider health, usage, and reputation.
- Canonical AsyncAPI catalogue for normalized communications events, SMS receipt, call disposition updates, reputation changes, and provider health changes.
- TypeScript `@codestra/communications-sdk` facade for both product-friendly Communications API resources and privileged Middleware command-plane operations.
- Required bearer, tenant, correlation, and idempotency headers on SDK mutations.
- Provider-neutral command mappings for email, SMS, and voice through the governed Middleware command plane.
- Production-readiness manifest at `contracts/communications-production-readiness.v1.json`.
- CI validator at `scripts/validate-communications-readiness.mjs`.

## Required Before Production Activation

- Keycloak product clients must exist for Moneybee, Beyvra, Social, Kyqra, Klyrow, Transportation, and Breero where applicable.
- Kong must validate Keycloak JWTs before routing to Middleware.
- Live auth matrix must pass: valid token, no token, invalid token, wrong scope, wrong caller/target, and required header enforcement.
- Generated Python, TypeScript, and PHP clients must pass smoke tests from the generated artifacts.
- Product repos must replace raw HTTP integrations with the SDK.
- Provider canaries must pass for `klyrow-email`, `telnexa-sms`, `vicidialer-codestra`, `postly-social`, and `kyqra-crawler`.
- Secrets must be loaded through the external secret store only.
- Backup/restore, rollback rehearsal, observability alerts, and dashboard evidence must be attached before live capability flags are enabled.

## Product Adoption Order

1. Moneybee-Backend
2. beyvra-backend
3. social.codestra.co
4. kyqra
5. klyrow.com
6. transportation-backend-
7. Breero.com

## Release Gate

Every SDK release candidate must pass:

```bash
pnpm contracts:validate
pnpm communications:ready
pnpm contracts:validate:negative
pnpm build
pnpm typecheck
pnpm test:coverage
```

The SDK can be considered contract-ready when these pass. It is production-active only after the live Keycloak, Kong, Middleware, provider canary, secret-store, backup, rollback, and observability evidence exists.
