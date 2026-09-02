# Codestra Orbit unified experience system

## Purpose

Codestra Orbit V2 gives every Codestra-owned website, portal, administrative application, authentication screen, and vendor-supported theme one original corporate language without copying third-party source, private content, branding, or authentication values.

The canonical package is:

```text
@codestra/intake-ui/orbit
@codestra/intake-ui/orbit/styles
```

The canonical API contract is:

```text
contracts/openapi/codestra-orbit.openapi.yaml
```

The canonical schemas are:

```text
contracts/schemas/orbit-brand-shell.schema.json
contracts/schemas/orbit-page-shell.schema.json
contracts/schemas/orbit-footer.schema.json
```

## Non-negotiable visual contract

```text
canvas=#000000
surface-primary=#101010
surface-elevated=#171717
surface-secondary=#202020
text-main=#FFFFFF
text-supporting=#D8D8D8
text-muted=#9A9A9A
border-default=#353535
border-strong=#5A5A5A
primary-background=#FFFFFF
primary-text=#000000
primary-hover=#E7E7E7
primary-active=#CCCCCC
success=#36C98F
warning=#F4B860
error=#FF6469
information=#79B8FF
```

Informational blue is not a normal action or brand color.

```text
header-desktop=76px
header-tablet=64px
header-mobile=56px
control-standard=52px
control-compact=44px
auth-max-width=480px
radius-default=2px
radius-maximum=6px
social-icon=20px
social-target=44px
content-main=1280px
content-wide=1440px
content-text=720px
```

## Prohibited patterns

- gradients;
- translucent glass or backdrop blur;
- glow and drop-shadow effects;
- shadow-heavy cards and dialogs;
- neon decoration;
- large rounded cards or pill-shaped standard controls;
- blue primary buttons;
- raw product-specific colors outside approved token files;
- hard-coded production social profile URLs;
- copied third-party names, logos, wording, imagery, source, or auth parameters.

## Shared shell

Every suite declares:

- brand;
- canonical origin;
- surface type;
- root shell source;
- header source and `standard`, `compact`, or `auth` variant;
- footer source and `full`, `compact`, `auth-compact`, or `legal-only` variant;
- whether social links are allowed;
- token source;
- page roots;
- authentication mode and evidence;
- dynamic content and Asset API ownership;
- new-page inheritance rules.

Each repository stores this in `orbit/suite.json` and runs the reusable Orbit validator from this repository at an exact commit.

## Dynamic content

Editable content is identified by stable content keys. Replaceable files use Asset API IDs.

The API may replace:

- page text, headlines, descriptions, instructions, notices, and announcements;
- button labels and allowlisted destinations;
- logos, images, videos, and documents;
- navigation and application links;
- footer, legal, and published social links;
- telephone and email contact values;
- SEO metadata;
- authenticated account-shell content.

The API must not return executable JavaScript, raw event handlers, arbitrary CSS, unsafe HTML, unvalidated redirects, credentials, tokens, or provider endpoints as editable content.

## Footer and social policy

Frontend repositories contain no authoritative social profile URLs.

```http
GET /api/v1/brands/{brand}/footer
```

Only published, supported, credential-free HTTPS entries render. Missing entries are hidden.

Administrative mutation endpoints require authenticated authorization, brand/tenant scope, idempotency, correlation, expected version, safe reason, approval evidence, audit evidence, publication evidence, and rollback eligibility.

## Authentication boundary

Orbit owns only the visual shell and state presentation. Codestra identity remains responsible for:

- issuer and client registration;
- Authorization Code + PKCE where applicable;
- backend/BFF sessions and cookies;
- redirect allowlists;
- CSRF, state, nonce, and code-verifier handling;
- MFA and recovery;
- role, tenant, entitlement, and authorization enforcement;
- protected deep links;
- logout and revocation;
- session expiry and multi-tab behavior.

No external reference client ID, callback, `ReturnUrl`, state, nonce, PKCE value, logo, text, image, font, or source is reusable.

## Product identity

Products retain their approved names, logos, content, photography, charts, and domain responsibilities. They do not receive product-specific primary-button colors. Primary actions remain white with black text across the suite.

Semantic financial, compliance, risk, success, warning, error, stale, degraded, and information states retain their documented meanings. Branding never changes authoritative state.

## Vendor products

Keycloak, Odoo, Grafana, and Superset use only supported theme, template, plugin, or branding mechanisms. Do not fork or patch vendor internals merely to imitate the Orbit shell.

## Release sequence

1. merge the Orbit package authority;
2. publish or consume it by exact source SHA in staging;
3. add `orbit/suite.json` and a fail-closed repository workflow;
4. apply root attributes and tokens;
5. replace headers and footers without changing routes or auth behavior;
6. migrate page components and states;
7. integrate published Brand/Footer/Page/Asset API reads;
8. perform responsive, accessibility, auth, API, CSP, and failure-state testing;
9. build an immutable artifact with SBOM and provenance;
10. deploy the exact artifact to isolated staging;
11. capture screenshot and rollback evidence;
12. promote only through a separately approved production change.

No Orbit source merge authorizes production activation.
