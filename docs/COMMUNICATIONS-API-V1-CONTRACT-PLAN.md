# Communications API v1 Contract Plan

## Purpose

This document is the execution authority for **Step 2: define and implement the canonical provider-neutral Communications API v1 contracts** after the cross-repository capability inventory is accepted.

Repository: `appolon1908-hue/SDK-repository`

Branch: `feat/communications-api-v1-contracts`

## Dependency on Step 1

The source inventory lives in:

`appolon1908-hue/communication-platform-:audit/communications-capability-inventory-v1`

Step 2 must use the accepted Step 1 exit report as evidence. It must not invent a provider capability and then represent it as already implemented.

## Repository authority

`SDK-repository` owns:

- canonical developer-facing OpenAPI/AsyncAPI contracts;
- generated client contracts;
- common SDK facades;
- webhook helper contracts;
- shared schemas and error/status types;
- compatibility and contract-drift gates;
- developer documentation and fixtures.

It does not own:

- Middleware privileged execution;
- Klyrow/Postal/Mautic runtime;
- Telnexa/Jasmin/SMPP runtime;
- VICIdial/Asterisk runtime;
- Kong route/plugin implementation;
- Keycloak identity configuration;
- Caddy edge configuration.

## Target API model

The preferred public developer surface is provider-neutral.

### Messages

```text
POST /v1/communications/messages
GET  /v1/communications/messages/{message_id}
GET  /v1/communications/messages/{message_id}/events
POST /v1/communications/messages/{message_id}/cancel
```

The common message request must include or resolve:

- tenant context from authenticated identity;
- channel: `email`, `sms`, or `voice`;
- recipient/target identity;
- sender identity;
- template or content payload;
- metadata/tags;
- requested schedule when supported;
- policy/capability context where required.

Effectful creation requires an idempotency key.

### Templates

```text
POST   /v1/communications/templates
GET    /v1/communications/templates
GET    /v1/communications/templates/{template_id}
PATCH  /v1/communications/templates/{template_id}
DELETE /v1/communications/templates/{template_id}
```

Template support must distinguish common metadata from channel-specific content.

### Sender identities and domains

```text
GET  /v1/communications/senders
POST /v1/communications/senders
GET  /v1/communications/senders/{sender_id}
GET  /v1/communications/domains
GET  /v1/communications/domains/{domain_id}
```

Email domain reads should be able to represent SPF, DKIM, DMARC, TLS and other verification state without making DNS configuration itself an SDK responsibility.

### Suppressions and preferences

```text
GET    /v1/communications/suppressions
POST   /v1/communications/suppressions
DELETE /v1/communications/suppressions/{suppression_id}

GET   /v1/communications/preferences/{subject_id}
PATCH /v1/communications/preferences/{subject_id}
```

The contract must preserve tenant scope, channel scope, reason/source, timestamps and auditability.

### Health, usage and reputation

```text
GET /v1/communications/channels
GET /v1/communications/providers/health
GET /v1/communications/usage
GET /v1/communications/reputation
```

These are read surfaces. They must normalize enough for dashboards while preserving provider-specific detail when necessary.

## Canonical lifecycle

The common lifecycle should support:

```text
accepted
queued
submitted
provider_accepted
delivered
suppressed
rejected
failed
cancelled
indeterminate
```

An implementation must not claim `delivered` merely because a provider returned HTTP 2xx.

`indeterminate` is mandatory for uncertain external outcomes until authoritative read-back or reconciliation resolves the state.

## Common identifiers

Every command/message/event should support as applicable:

- `message_id` or operation ID;
- tenant ID;
- correlation ID;
- causation ID;
- idempotency key;
- provider reference ID;
- channel;
- canonical status;
- provider status/details;
- created/accepted/submitted/completed timestamps.

## Error model

The API must define deterministic machine-readable errors for at least:

- authentication failure;
- authorization/scope failure;
- tenant mismatch;
- validation failure;
- idempotency conflict;
- suppression/consent denial;
- quota/rate limit;
- unsupported capability;
- provider unavailable;
- provider rejection;
- indeterminate outcome;
- reconciliation required;
- not found;
- version/conflict conditions.

## Event contract

AsyncAPI should cover canonical communications events including at minimum:

- `communications.message.accepted.v1`
- `communications.message.submitted.v1`
- `communications.message.delivered.v1`
- `communications.message.failed.v1`
- `communications.message.suppressed.v1`
- `communications.message.indeterminate.v1`
- `communications.message.reconciled.v1`
- `communications.email.bounced.v1`
- `communications.email.complained.v1`
- `communications.sms.received.v1`
- `communications.sms.dlr.v1`
- `communications.voice.call.started.v1`
- `communications.voice.call.ended.v1`
- `communications.voice.disposition.updated.v1`

Final names and payloads must follow the Step 1 inventory and canonical event naming rules already present in this repository.

## Security contract

The public contract assumes the permanent identity path:

```text
Application/SDK -> Caddy -> Kong -> Middleware
                         ^
                         |
                     Keycloak
```

The contract work must define expected audiences/scopes/headers, but Keycloak/Kong/Middleware remain the runtime authorities for issuance, gateway enforcement and privileged revalidation.

The caller-token model is a release blocker until those repositories agree and prove the exact path end to end.

## Implementation slices

### Slice 2A — shared schemas

- canonical IDs;
- status enums;
- errors;
- pagination;
- idempotency/correlation headers;
- provider-detail extension object;
- consent/suppression types.

### Slice 2B — message API

- create;
- lookup;
- event timeline;
- cancel semantics;
- common channel envelope.

### Slice 2C — email extensions

- sender/domain state;
- templates;
- bounce/complaint models;
- reputation/deliverability reads;
- Klyrow capability mapping.

### Slice 2D — SMS extensions

- sender identities;
- inbound SMS;
- DLR/failure models;
- Telnexa capability mapping.

### Slice 2E — voice extensions

- call command envelope;
- call/campaign/queue/disposition event shapes;
- VICIdial capability mapping.

### Slice 2F — generated clients

- TypeScript facade;
- Python generation/smoke tests;
- PHP generation/smoke tests;
- no provider credentials or direct provider endpoints in generated clients.

### Slice 2G — compatibility gates

- semantic OpenAPI validation;
- AsyncAPI validation;
- JSON Schema validation;
- breaking-change detection;
- Pact/consumer-provider compatibility;
- generated-client smoke tests.

## Step 2 exit gate

Step 2 passes only when:

- Step 1 inventory is accepted;
- OpenAPI/AsyncAPI/schema validation passes;
- the common status and error model is explicit;
- provider-specific gaps remain visible rather than hidden;
- generated clients compile/install/run against safe contract fixtures;
- Middleware contract compatibility is proven for the accepted API boundary;
- Klyrow/Telnexa/VICIdial mappings have provider-side contract tests or explicit blockers;
- Keycloak/Kong/Middleware caller-token semantics are agreed and tested before production use;
- no package publication, provider activation or production cutover occurs merely from merging the contract branch.

## Handoff after Step 2

Implementation then moves by provider authority:

1. Email adapter/runtime alignment in `klyrow.com` + `Middleware-`.
2. SMS alignment in `telnexa` + `Middleware-`.
3. Voice alignment in `Vicidialer-Codestra` + `Middleware-`.
4. Dashboard/read-model implementation after canonical read/event contracts are stable.
