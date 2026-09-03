# Platform OpenAPI Route Convergence V2

This branch replaces manifest/string-based SDK readiness with exact accepted OpenAPI ownership and generated-client parity.

## Route decisions

```text
/v1/auth/session
  Owner: same-origin BFF package.
  Action: publish a real BFF OpenAPI contract or remove the unsupported readiness claim.
  Status: DONE (removed the claim). No same-origin BFF package exists anywhere in
  this repo or its owned repos, and this repo's own "Authority boundary" section
  (root README) places OIDC/session infrastructure outside its ownership entirely --
  publishing a real contract here would mean either building that infrastructure
  from scratch (out of scope) or documenting someone else's undeployed plan.
  Removed auth.session.get() from the unified SDK facade (packages/codestra_sdk)
  and "auth" from requiredUnifiedSdkModules in the readiness manifest. The route
  stays in codestra-platform.openapi.yaml, marked deprecated: true, and in the
  readiness manifest's compatibilityOnlyEndpointPaths, for the same published
  sunset window as /v1/crm/leads below (same gate limitation: no exemption yet
  for removing an already-deprecated operation).

/v1/marketing/campaigns
  Owner: appolon1908-hue/Codestra-Marketing-.
  Action: import/validate the accepted Marketing OpenAPI and generate the Marketing client.

/v1/ai/generate
  Owner: appolon1908-hue/Codestra-AI.
  Action: import/validate the accepted AI OpenAPI and generate the AI client.

/v1/crm/leads
  Prohibited direct CRM edge.
  Action: remove and use POST /v1/intake/leads.
  Status: PARTIALLY DONE. Removed from the unified SDK facade (packages/codestra_sdk)
  and from requiredUnifiedSdkModules in the readiness manifest. Lead submission goes
  through packages/intake-bff to POST /v1/intake/leads; CRM record mutation goes
  through codestra.control.crm. The route itself stays in
  codestra-platform.openapi.yaml, marked deprecated: true, and in the readiness
  manifest's compatibilityOnlyEndpointPaths, for the published sunset window
  docs/production/MIDDLEWARE-SDK-CONTRACT-DRIFT.md requires: the breaking-change
  gate (scripts/check-contract-drift.mjs) unconditionally rejects deleting a
  contract path, with no exemption for an already-deprecated operation, so final
  removal from the contract needs that gate extended first or a deliberately
  accepted breaking-change exception -- a separate, follow-up decision.

/v1/workflow/runs
  Superseded orchestration vocabulary.
  Action: remove and use POST /v2/automation/commands plus command/job status APIs.
  Status: DONE, but not as originally worded. Investigated the real Middleware
  v2 automation contract (appolon1908-hue/Middleware-@9152a04e:
  docs/decisions/ADR-0001-AUTOMATION-CONTRACT-V2.md,
  contracts/automation/{n8n-control-plane,operation-policy}.v2.json) before
  building against it: it is real and ADR-accepted, but status: SOURCE_ONLY /
  implementation_status: NOT_IMPLEMENTED, and every client in its operation
  policy is an n8n-branded machine client (n8n-crm-automation,
  n8n-identity-automation, ...) with tenant/actor context explicitly derived
  server-side, never from a caller. That is the n8n-orchestrator's internal
  claim/lease protocol with Middleware, not a product-facing route -- building
  a product SDK contract against POST /v2/automation/commands as literally
  written here would have repeated the exact mistake this file's own
  marketing/ai corrections above just fixed: inventing a contract for the
  wrong integration point.
  Routed through the real, already-implemented canonical command plane
  instead: codestra.automation.commands.trigger() submits POST /v1/commands
  (command_type "automation.workflow.trigger", target "n8n", capability
  "AUTOMATION_TRIGGER" -- a proposed convention, not a verified-real
  command_type, since no such workflow-trigger command_type exists in the
  real command-envelope.v1.schema.json's validated branches yet), read back
  via the existing GET /v1/operations/{command_id}. No new OpenAPI paths
  needed: /v1/commands and /v1/operations/{id} both already exist in the
  vendored Middleware contract and are already exercised by
  scripts/check-middleware-runtime-alignment.mjs. /v1/workflow/runs* is
  deprecated: true in codestra-platform.openapi.yaml, same sunset treatment
  as the routes above; codestra_sdk no longer exposes workflow.runs.*.
```

## Required packages

- `@codestra/intake-sdk`
- `@codestra/intake-bff`
- `@codestra/marketing-sdk`
- `@codestra/ai-sdk`
- `@codestra/communication-sdk`
- `@codestra/social-sdk`
- `@codestra/automation-sdk`
- `@codestra/operations-sdk`

Every mutation must propagate bearer authorization, `X-Tenant-ID`, `X-Correlation-ID`, `Idempotency-Key`, bounded timeout and safe error handling. Browser packages must not contain service credentials.

## Validation

CI must fail when a readiness operation is absent from its accepted OpenAPI, an SDK method has no operation, generated code drifts, a forbidden direct CRM/workflow route returns, or a mutation omits tenant/correlation/idempotency behavior. All OpenAPI documents already recognized by the contract validator must participate in compatibility and drift checks.

## Safety

```text
RUNTIME_DEPLOYED=false
PRODUCTION_CHANGED=false
EXTERNAL_EFFECTS_ENABLED=false
BROWSER_SERVICE_CREDENTIALS=0
```
