# MoneyBee Adapter Contract

Branch authority: `integration/moneybee-adapters-20260902`.

The shared SDK provides typed, server-safe clients and adapters for MoneyBee while preserving the Codestra control boundary. Browser packages may use MoneyBee API/Keycloak clients only and must never contain provider master credentials.

Required integration families: Codestra Middleware, Plaid, CRM/Odoo, KYB, credit, lender, e-signature, communications, payments, S3-compatible storage, ClamAV, Keycloak/OIDC, PostgreSQL/Redis support contracts.

Consequential operations require tenant context, correlation, idempotency, typed errors, bounded retries, and reconciliation of ambiguous outcomes before retry. Provider adapters remain disabled by default until staging and production activation gates pass.

Production release requires OpenAPI/Pact alignment, security scans, SBOM/provenance, staging contract tests, production read-only smoke, and zero unresolved Critical/High issues. SSH policy is out of scope.
