# SDK Rapid Domain + Campaign Onboarding

The SDK must let new websites integrate quickly without embedding infrastructure or provider credentials.

Provide typed server/browser-safe helpers for: tenant/site bootstrap, campaign context, intake forms, consent, attribution, correlation IDs, idempotency keys, capability discovery, operation polling and typed error handling.

Browser path: website -> SDK/BFF -> Caddy -> Kong -> Middleware. Browser code must never call VICIdial, Odoo DB, OpenBao, provider APIs or private Middleware adapters directly.

Every intake/submission should carry tenant_id, website/domain identity, campaign_code or campaign_id, form_id, source/UTM attribution, consent context, correlation ID and idempotency key where mutating.

Campaign-aware clients must treat Odoo/Middleware as authoritative and surface synchronization state rather than attempting telephony provisioning themselves.

A new domain is production-ready only after SDK contract/OpenAPI tests, staging E2E, browser security, exact package version/provenance and production read-only smoke pass.
