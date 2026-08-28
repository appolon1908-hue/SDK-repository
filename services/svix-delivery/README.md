# Optional self-hosted Svix profile

This Compose definition is inert unless the `optional-svix` profile is explicitly selected. It publishes no host port; Middleware reaches Svix only over the external `codestra-private` network.

Before activation:

1. Replace every image placeholder with a reviewed immutable digest.
2. Inject database and JWT secrets from the deployment secret manager.
3. Back up and restore-test both PostgreSQL and Redis persistence.
4. Confirm the Middleware outbox stops endpoint-level retries after a successful Svix handoff.
5. Configure retention, tenant application mapping, operational webhooks, metrics, and dead-letter reconciliation.
6. Keep production activation behind a protected environment and explicit operator approval.

This branch does not activate, deploy, or publish Svix.
