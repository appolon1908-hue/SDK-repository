# @codestra/intake-sdk

Unified lead-intake client for landing pages, forms, chat widgets, voice entry points, and trusted API callers.

## Browser rule

Never embed Middleware service credentials, client secrets, or long-lived bearer tokens in browser code. Browser applications should send to a same-origin BFF/proxy route such as `/api/codestra/intake`; that server-side route authenticates to Middleware.

## Canonical flow

`landing page / form / chat / voice -> @codestra/intake-sdk -> same-origin BFF -> Kong -> Middleware -> durable inbox/outbox -> Odoo lead + downstream workflows`

Every submission carries tenant, site, source, campaign/form attribution, consent state, UTM attribution, optional custom fields, and metadata. Middleware remains the cross-system write authority.

## Example

```ts
import { createIntakeClient } from "@codestra/intake-sdk";

const intake = createIntakeClient();

await intake.submitLead({
  tenantId: "tenant-example",
  siteId: "landing-site",
  source: "landing_page",
  formId: "hero-contact",
  name: "Example Person",
  email: "person@example.com",
  attribution: {
    source: "google",
    medium: "cpc",
    campaign: "summer",
  },
});
```

Trusted server-side callers may set an explicit Middleware endpoint and short-lived bearer token. Production callers should also provide stable idempotency and correlation IDs.
