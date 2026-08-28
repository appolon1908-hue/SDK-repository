# `@codestra/n8n-nodes`

Thin n8n actions for social posts and webhook subscriptions plus a private internal trigger for canonical events emitted by Middleware.

## Security boundary

- The action node calls only Codestra Middleware, never Postiz, Odoo, Klyrow, Telnexa, or VICIdial directly.
- The internal trigger must be reachable only from Middleware through private networking, mTLS or an equivalent service boundary, and an allowlist.
- Its trigger token is separate from the outbound API token and must be high entropy and rotated.
- Workflows orchestrate approved commands; they do not own authorization, tenant isolation, idempotency, retries, or write correctness.
- Do not expose the internal n8n webhook route to the public internet.
