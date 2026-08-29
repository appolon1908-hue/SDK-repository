# Communications Platform SDK Authority

`appolon1908-hue/SDK-repository` is the principal developer-facing contract and SDK authority for the Codestra communications platform.

## SDK repository owns

- provider-neutral public OpenAPI contracts;
- canonical AsyncAPI event contracts;
- shared schemas and typed models;
- TypeScript/Python/PHP generated clients;
- handwritten developer facades where needed;
- webhook signing/verification helpers;
- connector-kit interfaces intended for distribution;
- n8n nodes that call governed APIs only;
- developer portal/API reference;
- compatibility, Pact and contract-drift gates;
- fixtures and sandbox/test helpers;
- dashboard/client-side API integrations that do not own privileged runtime behavior.

## SDK repository does not own

- provider credentials;
- runtime authorization decisions;
- durable command/inbox/outbox state;
- production retries/reconciliation;
- Postal/Mautic runtime;
- Jasmin/SMPP runtime;
- VICIdial/Asterisk runtime;
- Kong routes/plugins;
- Keycloak clients/realms;
- Caddy edge configuration;
- production deployment activation.

## Related principal repositories

- `Middleware-` — privileged cross-system control plane
- `communication-platform-` — communications architecture/coordination
- `Kong` — API gateway/security
- `Keycloak` — identity
- `Caddy` — public TLS edge
- `klyrow.com` — email runtime
- `telnexa` — SMS runtime
- `Vicidialer-Codestra` — voice runtime
- `Infustruction-repo` — shared infrastructure/deployment topology

## Required request path

```text
Application/Product
  -> Codestra SDK
  -> Caddy
  -> Kong
  -> Middleware
  -> provider adapter
  -> Klyrow / Telnexa / VICIdial
```

The SDK must never create direct provider write paths that bypass Middleware.

## Canonical communications contract target

The SDK should expose a provider-neutral model for common operations while allowing explicitly versioned channel-specific extensions.

### Shared message surface

```text
POST /v1/communications/messages
GET  /v1/communications/messages/{message_id}
GET  /v1/communications/messages/{message_id}/events
POST /v1/communications/messages/{message_id}/cancel
```

### Supporting surfaces

```text
GET/POST/PATCH /v1/communications/templates
GET              /v1/communications/channels
GET              /v1/communications/providers/health
GET              /v1/communications/usage
GET              /v1/communications/reputation
GET/POST          /v1/communications/suppressions
GET/POST/PATCH    /v1/communications/preferences
GET               /v1/communications/domains
GET               /v1/communications/domains/{domain_id}/authentication
```

Exact operations must only be added after confirming runtime/provider ownership and implementation support.

## Common message model

A canonical message should carry at minimum:

- message ID;
- tenant/organization context derived by server policy;
- channel (`email`, `sms`, `voice` or future supported channel);
- sender identity reference;
- recipient(s) using channel-appropriate types;
- template/content reference;
- metadata safe for client control;
- correlation ID;
- idempotency key for effectful submission;
- requested schedule time when supported;
- canonical status;
- provider reference(s) returned only when safe;
- timestamps;
- failure/error model;
- links to message event timeline.

## Canonical status model

```text
accepted
queued
submitted
provider_accepted
delivered
received
suppressed
bounced
complained
failed
cancelled
indeterminate
```

Channel/provider-specific statuses may be preserved as detail but must map deterministically to the canonical state model.

## Contract rules

1. Every effectful mutation requires explicit idempotency semantics.
2. Client-supplied tenant IDs must never override authenticated tenant context.
3. Errors use stable machine-readable codes.
4. Correlation IDs are supported end-to-end.
5. Retry behavior is documented and safe.
6. Unknown provider outcome is represented as `indeterminate`, not silently retried.
7. Provider secrets and internal administration endpoints are never exposed.
8. Webhook signatures are verified over exact raw bodies.
9. Event IDs/timestamps support replay defense.
10. Breaking contract changes require semantic drift gates and versioning.

## Email contract requirements

Coordinate with `klyrow.com` for:

- transactional/bulk/scheduled sending where supported;
- templates;
- sender identities/domains;
- SPF/DKIM/DMARC state reporting;
- delivery status;
- bounce/complaint events;
- suppressions;
- consent/preferences;
- quotas/usage;
- reputation/deliverability;
- provider readiness and safe-mode state.

## SMS contract requirements

Coordinate with `telnexa` for:

- outbound send;
- inbound messages;
- DLRs;
- sender identity;
- opt-out/consent;
- status/failure classification;
- usage/billing visibility where authorized;
- provider health and reconciliation.

## Voice contract requirements

Coordinate with `Vicidialer-Codestra` for:

- calls/call commands;
- campaigns and campaign isolation;
- agents/queues;
- callbacks;
- dispositions;
- transfers;
- recording metadata;
- call lifecycle events;
- provisioning/read-back/reconciliation.

## Release gates

A stable communications SDK release requires:

- semantic OpenAPI/AsyncAPI/JSON Schema validation;
- generated-client build/install smoke tests;
- provider compatibility tests against Middleware and relevant provider boundaries;
- auth/tenant/idempotency negative tests;
- event signature/replay tests;
- contract-drift gates;
- exact-head CI evidence;
- release provenance/checksums;
- no package publication from untrusted PR workflows;
- no production activation by SDK release alone.

## Current cutover blocker

The Keycloak -> Kong -> Middleware caller-token model must be consistent and proven end-to-end before product runtimes are switched to rely on the new privileged communications/control-plane SDK path.
