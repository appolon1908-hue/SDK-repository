# Codestra Communications SDK v1 Architecture

## Decision

Extend the existing `SDK-repository`. Do not create another SDK repository.

Repository ownership:

- `SDK-repository`: public/distributable contracts, generated clients, typed facades, webhook helpers, connector-kit interfaces, developer tooling, compatibility tests and SDK documentation.
- `Middleware-`: authenticated command intake, tenant/actor authorization, durable idempotency, inbox/outbox, Temporal execution, provider dispatch, read-back, reconciliation, audit and capability enforcement.
- Klyrow/Postal: email runtime.
- Telnexa/Jasmin: SMS runtime.
- VICIdial/Asterisk: voice runtime.
- Kong/Keycloak: API edge and identity.

Canonical path:

```text
Application
  -> Codestra SDK
  -> Kong
  -> Middleware /v1/commands
  -> trusted channel adapter
  -> principal provider runtime
  -> read-back/reconciliation
  -> Middleware event/status
  -> SDK consumer/webhook
```

No SDK package may hold provider credentials or bypass Middleware for cross-system writes.

## Existing SDK inventory

Already implemented:

- OpenAPI/AsyncAPI/JSON Schema contract foundation
- semantic contract validation
- TypeScript SDK
- webhook SDK
- connector kit
- n8n nodes
- provider-adapter framework
- Pact and contract-drift gates
- generated Python/PHP clients and real smoke tests
- generated Python Middleware control-plane client
- developer portal
- operations dashboard
- admin console
- optional Svix delivery shell
- optional Camel protocol gateway

## Communications v1 missing surface

The next layer is a provider-neutral communications facade. It should translate developer-friendly channel methods into the existing Middleware command plane.

### Capabilities

```http
GET /v1/communications/capabilities
```

Expose tenant/channel availability, supported features, quotas, maintenance/degraded state and fail-closed production-delivery flags.

### Email facade

SDK methods:

```text
email.send()
email.sendBatch()
email.get()
email.events()
email.cancel()
```

Command operations:

```text
email.message.send
email.message.send_batch
email.message.cancel
```

Required fields include tenant context, sender identity/domain, recipient(s), subject, template or content, metadata, scheduled time and idempotency key.

Provider credentials and Postal-specific fields stay server-side.

### SMS facade

SDK methods:

```text
sms.send()
sms.sendBatch()
sms.get()
sms.events()
sms.cancel()
```

Command operations:

```text
sms.message.send
sms.message.send_batch
sms.message.cancel
```

Telnexa/Jasmin remains the SMS runtime.

### Voice facade

SDK methods:

```text
voice.call()
voice.get()
voice.events()
voice.cancel()
voice.transfer()
```

Command operations:

```text
voice.call.start
voice.call.cancel
voice.call.transfer
```

VICIdial/Asterisk remains the voice runtime. Campaign isolation and dialing permissions are enforced by Middleware/provider runtime, never by client-side trust.

### Templates

Developer-facing API:

```text
templates.create()
templates.list()
templates.get()
templates.update()
templates.delete()
templates.render()
```

Templates support channel, locale, version, variables, validation and preview. Secret/provider configuration is excluded.

### Domains and senders

Read/write through governed Middleware operations for:

- sender identity registration
- sending-domain registration
- verification state
- SPF status
- DKIM status/selectors
- DMARC status/policy
- reverse-DNS status
- TLS status
- BIMI readiness
- VMC/CMC metadata state

DNS provider credentials must never enter SDK packages.

### Suppression and consent

Required concepts:

- hard-bounce suppression
- complaint suppression
- unsubscribe suppression
- SMS opt-out
- per-channel consent state
- tenant/global policy distinction
- reason/source/timestamp/audit metadata

SDK consumers cannot override a mandatory suppression through a normal send command.

### Reputation and deliverability

Read APIs only for application consumers:

```text
reputation.summary()
reputation.domains()
reputation.ips()
reputation.providers()
reputation.metrics()
```

Metrics:

- accepted
- delivered
- deferred
- bounced
- hard/soft bounce
- complaints
- unsubscribe
- suppression
- delivery latency
- queue depth
- provider failures
- DKIM/SPF/DMARC alignment state
- domain/IP health classification

Postal/Klyrow event ingestion and any Gmail/Postmaster/provider telemetry remain server-side integrations.

### Unified message model

Every channel should map to a stable envelope:

```text
message_id
channel
tenant_id
correlation_id
idempotency_key
operation
status
provider_reference
created_at
accepted_at
dispatched_at
completed_at
failure_code
failure_message
metadata
```

Canonical status model:

```text
accepted
queued
dispatched
delivered
failed
cancelled
suppressed
expired
indeterminate
```

Provider-specific statuses are normalized by Middleware while raw provider evidence remains available to authorized operators.

## Event catalogue

Add normalized communications events to AsyncAPI, for example:

```text
communications.email.accepted.v1
communications.email.delivered.v1
communications.email.bounced.v1
communications.email.complaint.v1
communications.sms.accepted.v1
communications.sms.delivered.v1
communications.sms.failed.v1
communications.sms.received.v1
communications.voice.started.v1
communications.voice.answered.v1
communications.voice.completed.v1
communications.voice.failed.v1
communications.reputation.changed.v1
```

Every event requires tenant binding, event ID, timestamp, correlation ID, source, schema version and replay-safe webhook delivery.

## SDK packages

Keep the existing monorepo. Recommended package layout:

```text
packages/contracts
packages/communications-sdk
packages/webhook-sdk
packages/connector-kit
packages/provider-adapters
generated/middleware-python
generated/python
generated/php
integrations/n8n-nodes
apps/developer-portal
apps/ops-dashboard
apps/admin-console
```

The TypeScript communications facade should be handwritten over the stable generated/control-plane transport so product developers get a clean API while transport contracts remain generated and drift-checked.

## Security requirements

- OAuth/OIDC tokens only; no embedded production credentials.
- Kong is the public API enforcement edge.
- Middleware revalidates caller identity and tenant/actor authorization.
- Mutation methods require an idempotency key.
- Canonical request fingerprints bind idempotency to tenant + operation + payload.
- Unknown provider outcomes become `indeterminate`, not retry-safe success/failure guesses.
- Webhooks are signed over exact raw bodies with timestamp and replay protection.
- HTTPS only.
- No token persistence in browser SDKs.
- Suppression/consent rules fail closed.
- Provider activation flags fail closed.

## Current blocker before product cutover

The caller-token contract across Keycloak, Kong and Middleware must be made consistent and proven against the live/staging OIDC path. Generated SDK availability alone is not production authorization.

## Build sequence

1. Freeze caller-token/security contract between Keycloak, Kong and Middleware.
2. Add communications capability and unified-message schemas.
3. Add email command/event contracts and adapter mappings.
4. Add SMS command/event contracts and adapter mappings.
5. Add voice command/event contracts and adapter mappings.
6. Add template, domain/sender, consent/suppression and reputation read models.
7. Build `@codestra/communications-sdk` thin TypeScript facade.
8. Regenerate Python/PHP clients and add channel smoke tests.
9. Expand n8n nodes for approved communications operations.
10. Extend developer portal and ops dashboard.
11. Add cross-repository contract tests against Middleware and principal provider repos.
12. Run staging integration with all live-effect flags disabled.
13. Prove read-back, reconciliation, duplicate/replay behavior, failure handling and observability.
14. Publish versioned SDK artifacts only from protected exact-SHA release workflows.

## Production exit gates

Production-ready means all of the following, not merely green compilation:

- exact-head SDK CI green
- exact-head Middleware CI green
- Keycloak/Kong/Middleware identity path verified
- contract drift gates green
- generated TypeScript/Python/PHP package smoke tests green
- email/SMS/voice provider contract tests green
- tenant isolation verified
- idempotency/reconciliation tests green
- signed webhook replay tests green
- suppression/consent enforcement verified
- provider read-back verified
- dashboards/alerts verified
- backup/restore and rollback evidence current
- immutable artifacts recorded by SHA/digest
- activation remains a separate explicit approval
