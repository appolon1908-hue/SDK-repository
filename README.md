# Codestra SDK Repository

Codestra's contract-first developer platform for reusable SDKs, webhook tooling, connector interfaces, automation nodes, provider adapters, compatibility gates, generated clients, and optional delivery/protocol gateways.

## Release branches

Implementation is delivered as a stacked, dependency-ordered branch series:

1. `feat/01-contracts`
2. `feat/02-social-sdk`
3. `feat/03-webhook-sdk`
4. `feat/04-connector-kit`
5. `feat/05-n8n-nodes`
6. `feat/06-provider-adapters`
7. `feat/07-pact-contract-gates`
8. `feat/08-python-php-generation`
9. `optional/09-svix-delivery`
10. `optional/10-camel-protocol-gateway`

Each branch is based on the preceding branch so reviews remain small and the release dependency order is explicit.

## Authority boundary

SDKs and connectors never bypass Codestra Middleware. Middleware remains the only cross-system write authority and owns authorization, tenant isolation, idempotency, inbox/outbox processing, retries, reconciliation, audit, and privileged credentials.

Optional runtime integrations are disabled by default and must not activate external delivery or production mutations merely by installing this repository.
