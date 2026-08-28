# Codestra Contract Boundary Matrix

This repository is a contract-first SDK and connector monorepo. It defines client libraries, connector libraries, n8n nodes, optional handoff packages, and versioned contracts. It does not implement Codestra Middleware, Kong, identity, or product-local gateways.

## Non-Negotiable Authority Path

```text
Application
  -> Codestra SDK or approved n8n node
  -> Kong
  -> Codestra Middleware
  -> provider adapter
  -> product-local restricted gateway
  -> provider
```

Codestra Middleware is the only cross-system write authority. Any package in this repository that prepares a mutation must send it toward Middleware or be invoked by Middleware. No browser SDK, n8n workflow, Svix service, Camel service, provider adapter, or provider may create a second write path.

## Boundary Ownership

| Boundary | Network surface | Contract | Implemented here | External owner | Write authority |
|---|---|---|---|---|---|
| Public SDK to Middleware | `POST /v1/social/posts`, `GET /v1/social/posts/{postId}`, `POST /v1/webhook-subscriptions` | `contracts/openapi/codestra-public.openapi.yaml` | `packages/social-sdk`, n8n action node | Codestra Middleware behind Kong | Middleware |
| Enterprise Middleware connector API | `POST /v1/connectors/{connectorKey}/commands`, `POST /v1/connectors/{connectorKey}/reconciliation` | `contracts/openapi/codestra-enterprise.openapi.yaml` | connector interfaces and Pact/test helpers | Codestra Middleware private API | Middleware |
| Product-local restricted gateway | `GET /health/ready`, `POST /internal/v1/codestra/commands`, `POST /internal/v1/codestra/reconciliation` | `contracts/openapi/codestra-restricted-gateway.openapi.yaml` | `packages/provider-adapters` client side only | Product-local gateway beside Postiz, Odoo, Klyrow, Telnexa, VICIdial | Middleware-issued private request only |
| Canonical event catalogue | `codestra.social.post.status.v1`, `codestra.webhook.delivery.status.v1` | `contracts/asyncapi/codestra-events.asyncapi.yaml`, `contracts/schemas/events/**` | event types and validators | Middleware/event bus | Middleware publishes canonical events |
| n8n internal event trigger | n8n webhook receiver for signed internal events | M01 signed boundary code and event contracts | `integrations/n8n-nodes` | n8n runtime plus Middleware replay-guard endpoint | No mutation authority |
| Webhook verification SDK | in-process verification only | `packages/webhook-sdk` public API | `packages/webhook-sdk` | consumer application storage | No mutation authority |
| Connector runtime | in-process command execution/idempotency | `packages/connector-kit` TypeScript interfaces | `packages/connector-kit` | Middleware persistence implementation | Middleware |
| Optional Svix delivery | optional outbound delivery adapter | package API only until M15 | `packages/svix-delivery` | Middleware operator activation | No independent write authority |
| Optional Camel gateway | optional protocol gateway shell | package/service API only until M16 | `services/camel-protocol-gateway` | Middleware operator activation | No independent write authority |

## Restricted Gateway Contract Rules

- Product-local gateway routes are private and must not be exposed through public Kong routes.
- Every request requires both private workload identity and a tenant-scoped service bearer token.
- Mutating commands require `Idempotency-Key` and provider-local idempotency must not issue duplicate provider mutations for the same command.
- Reconciliation reads provider-local state and must not issue a mutation.
- Provider adapters remain disabled by default and require explicit operation allowlists.
- Raw provider events are not canonical Codestra events until Middleware normalizes and publishes them under the AsyncAPI catalogue.

## Cancellation Decision

Social-post cancellation is not part of the v0.1 public API. Until a versioned `cancelSocialPost` contract is added, SDKs and n8n nodes must not expose cancellation as a public operation. Provider adapters may only implement provider-local cancellation after Middleware owns a corresponding command contract, authorization decision, and idempotency/reconciliation policy.

## Required Future Certification

M02 makes the repository-owned contracts explicit. System production readiness still requires external evidence that:

- Codestra Middleware implements the public and enterprise contracts exactly.
- Kong exposes only public routes and keeps internal routes private.
- Product-local gateways implement the restricted gateway contract with mTLS/workload identity.
- Provider-specific operation schemas, results, webhooks, and reconciliation behavior are verified for Postiz, Odoo, Klyrow, Telnexa, and VICIdial.
