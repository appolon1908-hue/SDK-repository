# Codestra SDK Repository API Audit

**Audit baseline:** `optional/10-camel-protocol-gateway` at `91a2ae5a2dbd8ac8c8b432c47fbdd1abde34e3a4`  
**Audit branch:** `audit/11-api-audit-report`  
**Audit type:** static contract, SDK, connector, test, CI, and Git-state review  
**Runtime changes in this audit:** none

## Executive decision

The repository has a sound high-level authority model and useful fail-closed defaults, but it is **not ready for a stable or production SDK release**.

The latest stacked branch compiles and its current GitHub checks are green. That evidence is valuable, but the checks cover a narrow surface. They do not prove that the OpenAPI and AsyncAPI documents are semantically valid, that the Middleware provider satisfies the contracts, that every exposed operation works, or that connector mutations are exactly-once under uncertain provider outcomes.

The most important release blockers are:

1. Contract validation currently checks file shape rather than full OpenAPI, AsyncAPI, and JSON Schema semantics.
2. Connector idempotency releases its claim after timeouts and other uncertain external outcomes, which can permit duplicate provider mutations.
3. The n8n internal trigger relies on a shared static token without timestamped signing, replay protection, tenant binding, or full event validation; its inbound and outbound secrets also share one credential record.
4. Webhook-subscription contracts do not define destination verification, signing-secret lifecycle, or SSRF defenses.
5. Test coverage is too small to support the current green status as a release-readiness claim.

Work should proceed in the prioritized slices defined at the end of this report. “Fix all” should not be treated as one pull request.

## Scope and limitations

This repository is a **contract-first developer platform**, not the Codestra Middleware API server.

Reviewed here:

- Public and enterprise OpenAPI contracts.
- AsyncAPI event catalogue and JSON Schemas.
- TypeScript public SDK.
- Webhook SDK.
- Connector execution kit.
- Postiz, Odoo, Klyrow, Telnexa, and VICIdial adapter libraries.
- n8n action and trigger nodes.
- Optional Svix handoff.
- Optional Apache Camel gateway shell.
- Test entry points, CI workflows, branch state, and release governance.

Not present in this repository and therefore not verified here:

- Kong routes and plugins actually serving `api.codestra.co`.
- Codestra Middleware HTTP handlers, authentication, tenant resolution, persistence, inbox, outbox, and reconciliation workers.
- Product-local restricted gateways for Postiz, Odoo, Klyrow, Telnexa, or VICIdial.
- Deployed DNS, TLS, mTLS, network policy, rate limiting, secrets, or provider credentials.
- Live provider behavior.

A separate provider-side audit is required before claiming that the API server implements these contracts.

## Repository and API map

### Authority path

```text
Application
  -> @codestra/social-sdk or @codestra/n8n-nodes
  -> Kong
  -> Codestra Middleware
  -> @codestra/connector-kit
  -> @codestra/provider-adapters
  -> product-local restricted gateway
  -> provider
```

The architecture correctly states that Middleware is the only cross-system write authority. The audit found no deliberate direct frontend-to-provider write path.

### Canonical contract files

| Boundary | Source |
|---|---|
| Public REST API | `contracts/openapi/codestra-public.openapi.yaml` |
| Enterprise connector REST API | `contracts/openapi/codestra-enterprise.openapi.yaml` |
| Canonical event catalogue | `contracts/asyncapi/codestra-events.asyncapi.yaml` |
| Shared schemas | `contracts/schemas/**` |
| Handwritten TypeScript types | `packages/contracts/src/index.ts` |

### Public HTTP operations

| Operation | SDK implementation | n8n implementation | Direct test | Pact test |
|---|---|---|---|---|
| `POST /v1/social/posts` | Yes | Yes | Partial | Yes |
| `GET /v1/social/posts/{postId}` | Yes | Yes | No | No |
| `POST /v1/webhook-subscriptions` | Yes | Yes | No | No |

### Enterprise HTTP operations

| Operation | Library support | HTTP provider verification |
|---|---|---|
| `POST /v1/connectors/{connectorKey}/commands` | Connector runner and restricted gateway adapter exist | No |
| `POST /v1/connectors/{connectorKey}/reconciliation` | Adapter method exists | No |

The connector interface additionally exposes `testConnection` and `ingestWebhook`, but those boundaries are not represented in the enterprise OpenAPI contract. The adapter base calls product-local routes that also have no canonical OpenAPI document:

```text
GET  /health/ready
POST /internal/v1/codestra/commands
POST /internal/v1/codestra/reconciliation
```

### Canonical events

The AsyncAPI document currently contains two message types:

```text
codestra.social.post.status.v1
codestra.webhook.delivery.status.v1
```

The provider manifests declare additional product event names that are not in the canonical event catalogue, including Postiz, Odoo, Klyrow, Telnexa, and VICIdial events. A clear distinction is needed between raw provider events and normalized Codestra events.

## Test and validation entry points

### Workspace commands

```bash
pnpm contracts:validate
pnpm build
pnpm typecheck
pnpm test
pnpm --filter @codestra/social-sdk test:pact
pnpm pacts:validate
```

### Observed behavioral tests

| Area | File | Test cases observed |
|---|---|---:|
| Contract package | `packages/contracts/test/contracts.test.ts` | 1 |
| Social SDK | `packages/social-sdk/test/client.test.ts` | 2 |
| Social Pact | `packages/social-sdk/test/pact/social-post.pact.test.ts` | 1 |
| Webhook SDK | `packages/webhook-sdk/test/webhook.test.ts` | 3 |
| Connector runner | `packages/connector-kit/test/runner.test.ts` | 2 |
| Provider adapters | `packages/provider-adapters/test/adapters.test.ts` | 3 |
| Svix handoff | `packages/svix-delivery/test/delivery.test.ts` | 2 |
| **Total observed** |  | **14** |

No behavioral tests were found for:

- n8n actions or internal trigger.
- Camel gateway policy or routes.
- Generated Python SDK execution.
- Generated PHP SDK execution.
- Enterprise HTTP provider verification.
- Webhook-subscription creation.
- Social-post lookup.
- Authentication, authorization, tenant isolation, rate limits, or most API error responses.

`@codestra/n8n-nodes` and `@codestra/testing` use `vitest run --passWithNoTests`, so a green workspace test job does not mean those packages have tests.

There is no shared `vitest.config.*` at the audit baseline. Package-local defaults are technically usable, but there is no repository-wide test environment, coverage threshold, timeout policy, setup file, or exclusion policy.

## Current Git state

At the audit baseline:

- `main` contains only the initialization `README.md`.
- Ten feature branches form a dependency-ordered stack.
- Ten pull requests are open and remain drafts.
- The full stack is represented by `optional/10-camel-protocol-gateway`.
- The full-stack head has successful workspace, compatibility, and Camel checks.
- No branch is protected.
- No repository ruleset exists.
- No release exists.
- No `pnpm-lock.yaml` is committed.
- CI installs dependencies with `pnpm install --no-frozen-lockfile`.

This means the implementation exists only in a draft branch stack and has not been accepted into the default branch or published as a reviewed release.

## Findings summary

| ID | Severity | Finding | Release effect |
|---|---|---|---|
| API-001 | Blocker | Contract validation is structural, not semantic | Invalid or unresolved contracts can pass CI |
| API-002 | Blocker | Connector idempotency releases claims after uncertain external outcomes | Duplicate provider mutations are possible |
| API-003 | Blocker | n8n internal trigger lacks signed replay-safe authentication and separates no credentials | Forged or replayed internal events may be accepted if the route/token is exposed |
| API-004 | Blocker | Webhook destination and signing-secret lifecycle are undefined | SSRF, unverifiable endpoints, and unsafe delivery onboarding remain unresolved |
| API-005 | High | Contract and implementation boundaries do not fully match | Consumers and providers cannot know the authoritative surface |
| API-006 | High | Contract-drift detection covers only a small subset of public OpenAPI breakage | Breaking changes can pass the compatibility gate |
| API-007 | High | Provider gateway responses and errors are loosely validated | Data loss, misleading errors, and reconciliation corruption can be hidden |
| API-008 | High | Current tests exercise only a small fraction of behavior | Green CI gives false confidence about release readiness |
| API-009 | High | Dependencies and protected-branch governance are nondeterministic or absent | Reviewed code can change behavior or be bypassed at merge time |
| API-010 | High | Runtime request and response validation is mostly absent | JavaScript callers and malformed servers can bypass TypeScript-only guarantees |
| API-011 | High | Webhook replay state is not tenant/endpoint scoped and has no processing lifecycle | Cross-scope collisions or lost retries are possible |
| API-012 | Medium | AsyncAPI and JSON Schema coverage is incomplete and internally inconsistent | Event consumers can diverge from SDK and REST types |
| API-013 | Medium | Svix integration is hand-typed and treats nearly every handoff failure as retryable | SDK drift and permanent retry loops may go undetected |
| API-014 | Medium | Camel verification has no tests and readiness is unconditional | A compiled shell can appear operational without an enabled protocol path |
| API-015 | Medium | Generated SDK and package publication are not executed end to end | Archives may exist without being installable or usable |

## Detailed findings

### API-001 — Contract validation is structural, not semantic

**Evidence**

`scripts/validate-contracts.mjs` verifies file existence, leading version text, final newlines, a few forbidden strings, and whether JSON files parse. It does not:

- Parse the OpenAPI or AsyncAPI YAML documents.
- Resolve internal or external `$ref` values.
- Validate OpenAPI 3.1 semantics.
- Validate AsyncAPI 3.0 semantics.
- Validate JSON Schema vocabularies and formats.
- Ensure operation IDs are unique.
- Ensure response and request schemas are reachable and valid.
- Compare handwritten TypeScript types with the canonical schemas.

**Impact**

CI can report “Contract structure validation passed” while the contract contains an invalid reference, malformed operation, unsupported schema construct, or mismatch between files.

**Required correction**

Add semantic validation that bundles and validates all contract files. A complete gate should include:

1. OpenAPI lint and bundle validation for public and enterprise contracts.
2. AsyncAPI document validation.
3. JSON Schema Draft 2020-12 compilation with format validation.
4. A check that every external `$ref` resolves from a clean checkout.
5. Generated-type or schema-conformance checks for handwritten TypeScript contracts.
6. Negative fixtures proving malformed contracts fail CI.

### API-002 — Idempotency can be released after an uncertain provider outcome

**Evidence**

`ConnectorRunner.execute()` acquires an idempotency scope, dispatches to the connector, and releases the scope for every caught error. This includes:

- A timeout after the provider request was transmitted.
- A client abort when the provider may continue processing.
- A network failure after the provider accepted the command.
- A provider result with a mismatched command ID.
- Failure to persist the completed result after the provider mutation succeeded.

The scope contains tenant, connector, operation, and key, but no canonical request fingerprint.

**Impact**

A retry may reacquire the same key while the first provider mutation succeeded or is still running. That violates the intended exactly-once boundary and can duplicate email, SMS, social publication, CRM writes, callbacks, or telephony commands. The same key can also be reused with a changed payload and incorrectly replay the earlier result.

**Required correction**

Introduce an explicit state machine such as:

```text
acquired -> dispatched -> completed
                     -> indeterminate -> reconciled/completed/rejected
```

Store a canonical request hash with the idempotency record. The same key and a different hash must return a deterministic conflict. Release a claim only when the provider was definitely not called. Timeouts, transport ambiguity, and result-persistence failures must retain an indeterminate record and trigger reconciliation.

Regression tests must cover:

- Same key and same payload replay.
- Same key and different payload conflict.
- Timeout after dispatch.
- Network reset after provider acceptance.
- Persistence failure after provider success.
- Reconciliation of an indeterminate command.
- Concurrent duplicate requests across multiple process instances using a durable store.

### API-003 — n8n internal trigger authentication is not replay-safe

**Evidence**

`CodestraInternalTrigger` accepts a static `X-Codestra-N8N-Token` and performs a constant-time comparison. It does not validate a timestamped signature, event ID replay state, tenant binding, source allowlist, event-type allowlist, or the complete canonical event schema.

The same `codestraApi` credential record contains both the outbound service access token and the inbound internal webhook token.

**Impact**

If the route or token is exposed through configuration, logs, backup, workflow export, or network misrouting, a captured request can be replayed and arbitrary minimally shaped events can enter workflows. Combining unrelated secrets increases blast radius and makes least-privilege rotation harder.

**Required correction**

- Split outbound API credentials from inbound event-trigger credentials.
- Prefer mTLS or a private authenticated ingress plus Standard Webhooks-compatible HMAC signing.
- Sign the exact raw body with event ID and timestamp.
- Enforce timestamp tolerance and durable replay protection.
- Bind the authenticated sender and tenant to the event tenant.
- Validate the complete CloudEvent and event-specific data schema before workflow execution.
- Return deterministic errors without echoing sensitive input.
- Add tests for tampering, expiry, replay, wrong tenant, wrong source, unsupported event, malformed data, and secret rotation.

### API-004 — Webhook onboarding does not define SSRF or signing-secret controls

**Evidence**

`POST /v1/webhook-subscriptions` accepts any URL matching `^https://`. The contract defines no endpoint challenge, pending-verification state, signing secret, secret rotation, disable/delete operation, test delivery, destination policy, redirect policy, or DNS/IP validation behavior.

**Impact**

HTTPS alone does not prevent requests to private, loopback, link-local, metadata, or otherwise restricted destinations. DNS rebinding and redirects can change a previously valid host into a restricted target. Consumers also have no contract for obtaining or rotating the secret needed by `@codestra/webhook-sdk`.

**Required correction**

Define a complete lifecycle:

```text
create -> pending_verification -> challenge verified -> active
active -> rotate secret / test / disable / delete
```

At registration and every delivery attempt:

- Normalize and validate the URL.
- Resolve all addresses and reject loopback, private, link-local, multicast, reserved, and metadata ranges.
- Disable redirects or revalidate every redirect hop.
- Pin the intended scheme and port policy.
- Apply tenant destination allowlists where required.
- Return the initial signing secret exactly once or define a secure secret-retrieval flow.
- Record immutable audit events for create, challenge, rotation, disable, and deletion.

### API-005 — Contract and implementation boundaries are incomplete

Examples:

- `CodestraConnector` exposes `testConnection` and `ingestWebhook`; the enterprise OpenAPI exposes neither.
- Restricted product-gateway routes are called by adapters but have no canonical OpenAPI contract.
- `social.post.cancel` exists in the Postiz adapter manifest but no public cancellation operation exists.
- Enterprise reconciliation accepts `limit`; the connector interface accepts only `cursor`.
- Enterprise `CommandReceipt` requires `acceptedAt`; `ConnectorCommandResult` does not expose it.
- The reconciliation endpoint uses weaker `connectorKey` and correlation-ID constraints than the command endpoint.

Some of these may be intentionally library-only. The defect is that the ownership decision is undocumented and unenforced.

**Required correction**

Create a boundary matrix declaring each operation as one of:

- Public API.
- Middleware-private API.
- Product-local restricted gateway API.
- In-process library method only.
- Event-only boundary.

Then align contracts, types, adapters, and tests to that decision.

### API-006 — Contract-drift detection misses breaking changes

`scripts/check-contract-drift.mjs` checks removed public paths, operations, responses, schemas, properties, enum values, and newly required properties. It does not resolve references and does not inspect:

- Enterprise OpenAPI.
- AsyncAPI.
- External JSON Schemas.
- Parameters and headers.
- Authentication and security requirements.
- Request bodies and media types.
- Types, formats, patterns, bounds, defaults, nullability, or `additionalProperties`.
- Operation-ID changes.
- Response-schema changes.

**Required correction**

Use a reference-aware breaking-change engine for both OpenAPI documents and add equivalent event/schema compatibility checks. Keep focused custom policy checks only for Codestra-specific invariants.

### API-007 — Provider response validation can hide failures or corruption

`RestrictedGatewayAdapter` has several problematic behaviors:

- It parses JSON before checking `response.ok`; non-JSON errors and valid empty success responses lose their actual HTTP semantics.
- Reconciliation silently filters out non-object items rather than rejecting an invalid page.
- Command receipts do not validate the complete enterprise response shape.
- A webhook normalizer is an arbitrary callback; the adapter cannot prove signature verification or replay protection occurred.
- Normalized event types are not checked against the connector manifest.
- The common transport defines bearer authentication but no required mTLS contract.

**Required correction**

- Separate success and error parsers by status/media type.
- Reject any invalid reconciliation item with index-specific diagnostics.
- Validate every provider response against a versioned schema.
- Require verified-webhook evidence or a standard verifier interface.
- Validate normalized event type, source, tenant, and schema.
- Define mTLS identity and bearer-token requirements in the restricted gateway contract.

### API-008 — Green CI covers too little behavior

The 14 observed tests are mostly smoke tests. Only one of the three public operations has a Pact interaction. No provider verification is present. There are no n8n or Camel tests.

Missing high-value categories include:

- Authentication and authorization failures.
- Cross-tenant access denial.
- Idempotency conflict and concurrent replay.
- Retry, timeout, abort, and `Retry-After` behavior.
- Invalid request and response schemas.
- All documented error statuses.
- Webhook timestamp boundaries, malformed signatures, and tenant-scoped replay.
- Every provider operation and every adapter response class.
- n8n credential isolation and inbound-trigger security.
- Generated SDK installation and invocation.

**Required correction**

Create a repository-wide test configuration and coverage policy, remove `--passWithNoTests` from production packages, add an operation coverage matrix, and require every OpenAPI operation to have at least one consumer test and one provider-verification path.

### API-009 — Dependency and merge governance are not deterministic

There is no committed lockfile, no branch ruleset, and all branches are unprotected. CI uses mutable dependency resolution. GitHub Actions are referenced with major tags rather than immutable action commit SHAs. The SDK generator image is pinned by tag rather than digest.

The SDK-generation workflow also checks out `${{ github.sha }}` rather than the explicit pull-request head SHA, so pull-request runs can validate GitHub’s synthetic merge commit while other workflows claim exact-head validation.

**Required correction**

- Commit and review `pnpm-lock.yaml`.
- Use `pnpm install --frozen-lockfile`.
- Pin actions and generator images immutably.
- Use the exact reviewed head SHA consistently.
- Protect `main` with required reviews, required exact-head checks, stale-approval dismissal, conversation resolution, and force-push/deletion prevention.

### API-010 — TypeScript types are not runtime validation

The social SDK accepts and returns TypeScript interfaces but does not validate UUIDs, date-times, enum values, body constraints, or server response schemas at runtime. JavaScript consumers can submit invalid data, and a malformed or compromised server response is returned as the requested type.

**Required correction**

Generate or compile runtime validators from the canonical schemas. Validate outgoing inputs before transmission where practical and always validate security- or correctness-sensitive responses. Return a structured `CONTRACT_VIOLATION` error with request ID and safe diagnostics.

### API-011 — Webhook replay state lacks namespace and processing lifecycle

The webhook SDK’s replay store claims only `eventId`. It does not include tenant, endpoint, signer, or event namespace. It also provides a single claim operation without `processing`, `processed`, `failed`, or lease-recovery semantics.

A claim made before business processing can suppress a legitimate retry after a handler crash. A global event-ID collision can also affect unrelated tenants or endpoints.

**Required correction**

Use a scope such as tenant + endpoint + signer/version + event ID, backed by an atomic durable store. Define processing leases and completion semantics so crashes can recover without processing the same event concurrently.

Also document time units explicitly: verifier `now()` is milliseconds while the in-memory replay-store clock is epoch seconds.

### API-012 — Event contracts are incomplete and inconsistent

The social-post event JSON Schema allows any string for `deliveries[].channel`, while the public OpenAPI and TypeScript package restrict channels to the canonical enum. The AsyncAPI document also lacks server bindings, security, message-header definitions, and most normalized product events.

**Required correction**

Derive common channel/status definitions from one schema, reference them everywhere, and add a test that compiles every event example against JSON Schema and TypeScript-generated types. Document raw provider events separately from canonical Codestra events.

### API-013 — Svix handoff is weakly coupled to the actual provider SDK

The package defines a handwritten `SvixClientLike` rather than compiling against the official client interface. Every unexpected client failure becomes retryable, even when the provider rejected configuration or payload permanently. There is no timeout, abort signal, event-type allowlist, tenant/data cross-check, or verification of a returned event ID.

**Required correction**

Add an adapter around a pinned official client, classify provider errors explicitly, enforce event allowlists and tenant consistency, add timeout/cancellation, and test permanent versus transient failures.

### API-014 — Camel verification compiles but does not behaviorally test policy

The Camel module has no `src/test` tree. `mvn verify` therefore proves compilation and packaging, not policy behavior. Readiness returns HTTP 200 even when no protocol and no operation are enabled.

**Required correction**

Add tests for missing headers, control characters, protocol and operation normalization, empty allowlists, denied commands, allowed commands, and health behavior. Decide whether readiness should fail or report a distinct non-ready state when no protocol path is configured.

### API-015 — Generated SDK and package publication are not tested end to end

The generator creates Python and PHP test sources, but CI only checks output structure, scans a few forbidden strings, archives the files, and uploads them. It does not install, import, lint, or run the generated tests.

Package publication is likewise not verified with `pnpm pack` and install-from-tarball tests. In particular, `@codestra/contracts` attempts to include `../../contracts`, which should be treated as an unverified packaging risk until the packed tarball is inspected.

**Required correction**

- Install and import the generated Python package in a clean virtual environment.
- Install the PHP package with Composer and execute generated tests.
- Run minimal calls against a disposable mock server.
- Pack every npm package and install the tarball into a clean example project.
- Verify exports, type declarations, contract assets, license, README, provenance, and absence of internal files.

## Prioritized remediation slices

### Slice 0 — Deterministic audit and contract substrate

**Goal:** make green CI meaningful before changing API behavior.

Deliverables:

- Commit `pnpm-lock.yaml` and require frozen installs.
- Add a shared Vitest configuration and minimum coverage policy.
- Replace structural contract checks with semantic OpenAPI, AsyncAPI, and JSON Schema validation.
- Make all workflows validate the exact reviewed head SHA.
- Pin actions and generator image by immutable revision/digest.
- Add branch rules and required checks.

Exit criteria:

- Invalid contract fixtures fail locally and in CI.
- A clean checkout reproduces the dependency graph.
- Packages with no tests cannot pass silently unless explicitly classified as metadata-only.

### Slice 1 — Idempotency and uncertain external outcomes

**Goal:** prevent duplicate provider mutations.

Deliverables:

- Request fingerprinting.
- Durable idempotency state machine with `indeterminate` state.
- No release after dispatch unless non-execution is proven.
- Reconciliation workflow and audit records.
- Concurrency, timeout, network ambiguity, and persistence-failure tests.

Exit criteria:

- Every ambiguous outcome is retained and reconciled.
- Same key/different payload always conflicts.
- Concurrent duplicates produce one provider mutation.

### Slice 2 — Signed inbound event boundary

**Goal:** make n8n and webhook ingestion replay-safe and tenant-safe.

Deliverables:

- Separate outbound and inbound credentials.
- Raw-body HMAC or mTLS-backed sender authentication.
- Timestamp and durable replay checks.
- Tenant/source/event allowlists.
- Full schema validation.
- n8n trigger tests.

Exit criteria:

- Tampered, expired, replayed, cross-tenant, or unsupported events cannot start a workflow.

### Slice 3 — Contract ownership and webhook lifecycle

**Goal:** define the complete supported API surface.

Deliverables:

- Boundary matrix for public, Middleware-private, product-local, library-only, and event-only operations.
- Versioned product-local restricted-gateway OpenAPI.
- Decision and contract for social cancellation.
- Reconciliation and command-receipt alignment.
- Webhook challenge, secret, rotation, test, disable, and delete operations.
- SSRF-safe destination policy.

Exit criteria:

- Every network call made by a shipped package maps to a versioned contract and owner.

### Slice 4 — Runtime validation and provider conformance

**Goal:** enforce contracts at runtime rather than only in TypeScript.

Deliverables:

- Generated request/response/event validators.
- Strict provider response parsing.
- Typed provider errors and retry classification.
- Verified webhook-normalizer interface.
- Provider conformance suites for Postiz, Odoo, Klyrow, Telnexa, and VICIdial.

Exit criteria:

- Malformed provider data fails closed with an actionable, non-secret diagnostic.

### Slice 5 — Complete compatibility and security testing

**Goal:** test every supported operation and failure class.

Deliverables:

- Consumer Pact interactions for all public operations.
- Middleware provider verification.
- Enterprise command and reconciliation compatibility tests.
- Tenant-isolation and authorization suites.
- Retry, timeout, rate-limit, and idempotency suites.
- Webhook and n8n security suites.
- Camel policy tests.

Exit criteria:

- The operation coverage matrix has no unsupported blank cells.
- Required checks run on every affected pull request.

### Slice 6 — Reproducible package and generated-SDK release

**Goal:** prove release artifacts are installable and traceable.

Deliverables:

- `pnpm pack` smoke tests.
- Clean-project npm installation tests.
- Python virtual-environment installation/tests.
- PHP Composer installation/tests.
- SBOM, checksums, provenance, and immutable release workflow.
- Changesets and protected publication approval.

Exit criteria:

- Exact reviewed artifacts install and run in clean environments.
- No pull-request workflow can publish a stable package.

### Slice 7 — Optional Svix and Camel activation readiness

**Goal:** keep optional infrastructure isolated until the core release is sound.

Deliverables:

- Official Svix client adapter and error classification.
- Private-network, backup, restore, and reconciliation evidence.
- Camel protocol-specific typed contracts and behavioral tests.
- Immutable image digests and explicit operator activation.

Exit criteria:

- Optional services remain disabled by default and cannot become a second write authority.

## Release gate recommendation

Do not merge the full stack into a protected release branch or publish stable packages until at least Slices 0 through 5 are complete and independently reviewed.

The optional Svix and Camel branches should remain draft and disabled until their protocol-specific activation evidence is complete.

## Audit conclusion

The repository is a credible foundation, especially in its contract-first structure, strict TypeScript configuration, exact-head checks in most workflows, HTTPS enforcement, mutation idempotency intent, disabled provider operations, and separation of Middleware authority from n8n orchestration.

The remaining defects are not cosmetic. They affect contract trust, exactly-once behavior, inbound event security, webhook destination safety, and the reliability of release evidence. The correct next step is not a broad “fix all” branch; it is the prioritized, test-first sequence above.
