# `@codestra/svix-delivery`

Optional handoff from the Middleware transactional outbox to a Svix client. The package is disabled by default and accepts only canonical CloudEvents.

The outbox owns durability until Svix accepts the message. After acceptance, Svix owns endpoint delivery attempts. Middleware must not run an independent endpoint retry loop for the same accepted message.

Each request supplies both the Codestra event ID and a distinct idempotency key. Tenant-to-Svix-application mapping is resolved server-side and must never be accepted from a browser request.
