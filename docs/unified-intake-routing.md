# Unified Intake Routing

The canonical production request path for forms, landing pages, chat widgets, callback widgets and voice-generated leads is:

`site -> @codestra/intake-sdk -> same-origin BFF -> Caddy -> Kong -> Middleware -> durable inbox/outbox -> Odoo`

The browser never receives a Keycloak client secret and never calls Middleware directly.

## Browser / SDK

The SDK collects the canonical lead payload, attribution, consent, correlation identity and idempotency identity. Browser mode submits only to the site's same-origin BFF.

## BFF

The BFF obtains a short-lived confidential service token for client `sdk-intake` and calls the public API edge. The token scope is limited to `leads.write` and its audience is `middleware-api`.

## Caddy

Caddy is the TLS/public reverse-proxy edge. It forwards `/v1/intake/*` to Kong and must not bypass Kong for intake requests.

## Kong

Kong owns gateway authentication, route policy, request-size ceilings, rate limiting and correlation handling. It forwards accepted requests to Middleware.

## Middleware

Middleware validates tenant/header/body agreement, records the canonical `codestra.events.lead_submitted` event durably, rejects semantic idempotency conflicts, and is the only cross-system write authority.

## Odoo

Middleware translates accepted lead events to the guarded `crm.lead.intake.upsert.v1` command. The Odoo integration method is not public HTTP and remains protected by the Middleware connector and `ODOO_WRITE` capability.

No documentation or SDK package may authorize deployment or enable live writes.
