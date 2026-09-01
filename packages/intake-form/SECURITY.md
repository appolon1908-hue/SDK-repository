# Intake Form Security Boundary

`@codestra/intake-form` is a public lead/request form engine. It must not become a collection surface for secrets, credentials, payment card data, government identifiers, medical records, authentication material, or other high-risk data that requires a separately protected workflow.

Rules:

- browser forms never receive `sdk-intake` client credentials;
- forms submit through `@codestra/intake-sdk` to the same-origin BFF;
- the BFF calls Caddy, then Kong, then Middleware;
- industry/form metadata never selects an Odoo model or connector method directly;
- tenant and campaign values are inputs to Middleware authorization/routing, not browser authority;
- definitions containing `sensitive: true` are rejected by the public registry;
- prohibited fields fail validation if supplied, even when a page attempts to inject them manually.

Regulated products remain responsible for product-specific legal, privacy, retention, consent and disclosure review.
