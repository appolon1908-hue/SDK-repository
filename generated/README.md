# Generated SDK output

CI writes generated clients into this directory temporarily and uploads them as exact-SHA artifacts. Generated source is ignored by Git so reviews focus on canonical contracts and generator configuration.

The generated families are intentionally separate:

- `generated/python` — public Codestra Python client from `contracts/openapi/codestra-public.openapi.yaml`.
- `generated/php` — public Codestra PHP client from the same public contract.
- `generated/middleware-python` — service-to-service Python client from `contracts/openapi/codestra-control-plane.openapi.yaml`.

The Middleware client mirrors the principal `appolon1908-hue/Middleware-` command-plane runtime (`POST /v1/commands` and `GET /v1/operations/{command_id}`). This SDK repository owns the distributable contract and generated transport client only. It does not own Middleware credentials, authorization, durable state, provider execution, capability activation, Kong route policy, or production deployment.

Keeping the control-plane client in a separate package (`codestra-middleware-sdk` / `codestra_middleware_sdk`) prevents browser/public consumers from gaining privileged command methods merely by upgrading the public SDK.

Generation alone does not prove the output works. `scripts/generate-sdks.sh` runs real behavioral smoke tests against each freshly generated client. The tests install the generated package into a real environment, start a local HTTP server returning contract-shaped responses, and call the generated client end to end. The Middleware smoke test additionally proves bearer preservation plus the required `X-Tenant-ID`, `X-Correlation-ID`, and `Idempotency-Key` headers and typed operation read-back.

`scripts/verify-generated-sdks.mjs` also checks required generated package structure and rejects known credential/private-infrastructure material from all generated outputs.

Stable publication should occur from a protected release workflow that regenerates from the reviewed commit, tests the package, signs provenance, and publishes the immutable artifact. Do not publish a developer workstation's generated directory.
