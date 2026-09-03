# Platform OpenAPI Route Convergence V2

This branch replaces manifest/string-based SDK readiness with exact accepted OpenAPI ownership and generated-client parity.

## Route decisions

```text
/v1/auth/session
  Owner: same-origin BFF package.
  Action: publish a real BFF OpenAPI contract or remove the unsupported readiness claim.

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
