# @codestra/intake-form

Industry-aware form/schema engine for the Codestra unified intake platform.

Canonical path:

`website / landing page -> @codestra/intake-form -> @codestra/intake-sdk -> same-origin @codestra/intake-bff -> Caddy -> Kong -> Middleware -> Odoo`

## Purpose

Sites choose a reviewed form definition instead of hard-coding business fields and routing logic. The engine validates public lead-intake data, adds industry/form metadata, and produces a payload compatible with the unified intake SDK.

## Included v1 industries

- general/contact
- financial services
- transportation/logistics
- home services
- medical transportation
- software/services
- real estate
- insurance
- education
- nonprofit
- contact-center campaigns

The registry is extensible; new industries and versions are added as reviewed definitions rather than new infrastructure.

## Safety boundary

Public intake forms are for lead/contact/request data. Sensitive fields must use a separately reviewed protected workflow. The v1 presets explicitly prohibit fields such as SSNs, bank/card credentials, medical records/diagnoses, passwords and similar high-risk data where applicable. A definition marked with a `sensitive` field is rejected by the public registry.

## Usage

```ts
import { IntakeFormRegistry, buildIntakeSubmission } from "@codestra/intake-form";
import { INDUSTRY_FORM_PRESETS } from "@codestra/intake-form/presets";

const registry = new IntakeFormRegistry(INDUSTRY_FORM_PRESETS);
const form = registry.get("freight_quote");

const payload = buildIntakeSubmission(
  form,
  { tenantId: "tenant-1", siteId: "site-1", campaignId: "freight-sales" },
  {
    name: "Example Shipper",
    origin: "Miami, FL",
    destination: "Boston, MA",
    privacyConsent: true,
  },
);
```

Pass the returned payload to `@codestra/intake-sdk`. Browser code still submits only to the site's same-origin BFF route; it never receives the `sdk-intake` secret.
