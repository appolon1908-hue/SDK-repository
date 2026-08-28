# `@codestra/n8n-nodes`

Thin n8n actions for Codestra Middleware plus a signed internal event trigger and terminal acknowledgement node.

## Credential separation

- `Codestra API` contains only the tenant and bearer token used by outbound n8n action nodes.
- `Codestra Internal Webhook` contains only inbound event signing secrets, tenant/source/type allowlists, and a service token scoped to the private event lifecycle API.
- Do not copy the outbound API token into the inbound credential or reuse the replay-guard token for general Middleware calls.

## Signed internal event flow

```text
Middleware outbox
  -> Standard Webhooks-compatible signature over exact raw body
  -> Codestra Signed Internal Event Trigger
  -> tenant/source/type/schema validation
  -> atomic Middleware replay claim
  -> workflow execution
  -> Codestra Internal Event Acknowledgement
```

The trigger parses JSON only after verifying the exact raw request bytes. It requires `Webhook-Id`, `Webhook-Timestamp`, `Webhook-Signature`, `X-Codestra-Tenant-Id`, and `X-Correlation-Id`. The configured tenant, transport tenant, CloudEvent `tenantid`, and event-specific tenant must agree.

A delivery is not emitted into a workflow unless the private replay guard atomically creates its claim. A 409 replay or an unavailable guard produces no workflow data. After terminal workflow processing, place the acknowledgement node on both the success and handled-failure paths so Middleware can record `completed` or `failed`.

## Security boundary

- Keep the trigger reachable only through private networking, mTLS or an equivalent authenticated service boundary, and an allowlist.
- Signing secrets use the `whsec_` format and support overlap during rotation.
- The replay guard must use durable shared storage; in-memory or workflow-static replay state is not acceptable.
- The action node calls only Codestra Middleware, never Postiz, Odoo, Klyrow, Telnexa, or VICIdial directly.
- Workflows orchestrate approved commands; they do not own authorization, tenant isolation, command idempotency, retries, or write correctness.
- Do not expose the internal n8n webhook route to the public internet.
