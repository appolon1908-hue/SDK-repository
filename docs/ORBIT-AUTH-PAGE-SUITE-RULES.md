# Codestra Orbit authentication, page, and suite rules

## Status

This document is a mandatory extension of the Codestra Orbit V2 contract. It applies to every Codestra-owned public website, customer account, partner portal, operator application, administrative application, mobile/web suite, and supported vendor theme.

The rules are enforced through a repository-local `orbit/suite.json` manifest and the pinned composite validator at `.github/actions/orbit-validate` in `appolon1908-hue/SDK-repository`.

## 1. Authentication is functional, not decorative

A header may show **Sign in**, **Account**, **Profile**, or **Log out** only when the repository contains and registers the real implementation. A visual control must never impersonate an authentication function.

Allowed authentication modes:

| Mode | Use |
|---|---|
| `public-only` | Public content with no protected route and no account controls |
| `same-origin-bff` | Preferred browser application using an HttpOnly same-origin session |
| `oidc-pkce` | Browser application using Codestra Keycloak Authorization Code Flow with PKCE S256 |
| `api-session` | Existing API session retained only as an explicitly governed migration state |
| `vendor-native` | Supported native session mechanism of Keycloak, Odoo, Grafana, Superset, or another approved vendor |

Protected suites must provide:

- a real login source;
- session bootstrap and expiry handling;
- a fail-closed protected-route guard;
- explicit 401 and 403 handling;
- a real logout/revocation operation before local cleanup where supported;
- a shell that reflects the actual session state;
- backend-authoritative tenant, permission, record, capability, and state checks;
- durable identity based on `issuer + subject` for OIDC;
- a same-origin or allowlisted post-login and post-logout destination;
- multi-tab logout propagation where the application can be open in multiple tabs;
- CSRF protection for cookie-authenticated unsafe methods.

The canonical issuer is:

```text
https://auth.codestra.co/realms/codestra
```

Email address, display name, browser role labels, navigation visibility, and client-side token claims are not sufficient authorization.

### Reference-safety rule

A design reference supplies only visual inspiration. The following must never be copied, inferred, stored, or reused from an external authentication page:

- external client IDs or client secrets;
- redirect URIs, callback paths, or post-logout URIs;
- `ReturnUrl` or equivalent redirect values;
- `state`, `nonce`, authorization codes, PKCE challenges, or code verifiers;
- cookies, headers, session identifiers, or account content;
- account creation, recovery, verification, MFA, or logout logic;
- external names, logos, images, wording, fonts, source code, or private screenshots.

Orbit authentication screens use Codestra-owned identity configuration, routes, wording, assets, and content keys.

### Logout requirements

Logout must:

1. prevent duplicate submission while in progress;
2. invoke the application/provider logout or end-session operation when available;
3. remove only application-owned session state;
4. clear cached privileged data;
5. broadcast the signed-out state to applicable tabs;
6. route to an approved same-origin or registered destination;
7. provide a safe local signed-out result when remote revocation is temporarily unavailable;
8. avoid disclosing raw provider or identity errors.

`sessionStorage.clear()` and `localStorage.clear()` are prohibited because they can delete unrelated application state. Open redirect parameters are prohibited.

### Browser token storage

New protected applications should use a same-origin BFF with `Secure`, `HttpOnly`, appropriately scoped `SameSite` cookies. Browser code must not receive a client secret, provider credential, database credential, or infrastructure token.

A vendor-native application may use storage controlled by its supported vendor mechanism. It must not copy those tokens into custom JavaScript storage.

## 2. Authentication shell

Authentication, registration, verification, recovery, MFA, and reauthentication pages use:

```text
header_variant=auth
footer_variant=auth-compact|legal-only
authentication_max_width=480px
standard_control_height=52px
compact_control_height=44px
```

Authentication pages retain the same black canvas, white primary action, borders, typography, focus treatment, and legal footer as the rest of Orbit.

Required states include:

- idle;
- submitting;
- validation error;
- invalid or expired link;
- rate limited;
- authentication denied;
- MFA required;
- recovery required;
- session expired;
- identity provider unavailable;
- safe success/continuation state.

Do not show an account as authenticated until the application has established and read back its own approved session.

## 3. Every page inherits one root shell

A product defines the Orbit root once in its authoritative application layout. Every page below that layout inherits:

- `data-orbit-root`;
- `data-orbit-brand`;
- `data-orbit-header`;
- `data-orbit-footer`;
- `data-orbit-social-allowed`;
- typography, spacing, borders, focus, forms, tables, states, and CTA hierarchy;
- the shared header/footer or approved operator-shell equivalent;
- localization, analytics, accessibility, security, and identity providers already owned by the application.

A page must not create a competing global header, footer, root token set, authentication provider, primary color, or social-link source.

## 4. Required page declaration

Every newly added page declares:

- stable page key;
- header variant;
- footer variant;
- whether social links are permitted;
- all editable content keys;
- all Asset API IDs;
- whether it is an authentication surface;
- whether it is protected;
- approved external origins, if any;
- applicable loading, empty, partial, stale, degraded, unavailable, unauthorized, forbidden, validation-error, conflict, unknown-outcome, offline, and success states.

Use `contracts/schemas/orbit-page-shell.schema.json` or `assertOrbitPageShell()` to validate the declaration.

## 5. Dynamic content safety

Editable values use stable content keys. Replaceable media use Asset API IDs.

Allowed content value categories:

- plain text;
- structured rich-text document rendered by an approved component set;
- internal path;
- allowlisted credential-free HTTPS URL;
- telephone or email display/contact value;
- SEO metadata.

Prohibited dynamic content:

- executable JavaScript;
- event-handler attributes;
- arbitrary HTML injection;
- untrusted CSS;
- `javascript:`, `data:`, or unapproved iframe origins;
- provider credentials, tokens, secrets, private endpoints, or database URLs;
- unvalidated login or logout redirects;
- server-authoritative prices, balances, permissions, risk outcomes, or compliance decisions fabricated by the client.

## 6. Header rules

### Public and customer surfaces

The header contains only approved elements:

- product identity supplied by the Brand/Asset APIs or approved local fallback;
- current-route navigation;
- one visually dominant primary action per decision area;
- actual session-aware authentication controls when protected routes exist;
- desktop, tablet, mobile, keyboard, focus, and zoom behavior.

Header heights are exactly 76px desktop, 64px tablet, and 56px mobile unless a documented native-vendor limitation requires an exception.

### Operator and administration surfaces

An approved operator shell may use a persistent rail plus compact top bar. It must still use Orbit tokens, real session state, supported logout, environment/domain indication, and backend authorization.

## 7. Footer rules

Allowed variants:

```text
full
compact
auth-compact
legal-only
```

The footer contains approved identity, privacy, terms, security, accessibility, contact, and support links. It may include social links only from the published Orbit footer API resource.

Frontend repositories do not store authoritative social profile URLs. Missing or unpublished entries do not render.

The footer must not expose backend-only hostnames as customer destinations.

## 8. Color, geometry, and decoration

Product source consumes Orbit variables. New component source must not introduce foundational raw colors.

Primary action remains:

```css
background: var(--cx-action-primary-bg);
color: var(--cx-action-primary-text);
```

Informational blue is reserved for information status. It cannot represent the normal primary action, selected navigation, focus outline, generic brand accent, success, failure, gain, loss, risk, or destructive action.

The shared shell prohibits:

- gradients;
- backdrop blur and glass effects;
- glow and drop-shadow decoration;
- shadow-heavy cards;
- normal interface radii above 6px;
- pill-shaped standard buttons, inputs, cards, tabs, or status chips;
- decorative neon colors.

Font files are not copied between repositories. Applications load approved licensed fonts under their own privacy and performance policy; Orbit supplies system fallbacks.

## 9. Adding a page

A new page pull request must:

1. live below a registered page root;
2. inherit the registered root shell;
3. declare header, footer, and social-link policy;
4. use Orbit tokens instead of new raw colors;
5. preserve authentication and authorization boundaries;
6. implement applicable states;
7. retain mobile, keyboard, focus, zoom, and reduced-motion behavior;
8. add route, unit/integration, accessibility, and screenshot evidence appropriate to the page;
9. avoid fake controls, balances, orders, campaigns, testimonials, activity, or provider results;
10. use stable content keys and Asset API IDs for editable content.

A transient toast is not a durable receipt for an effectful protected command.

## 10. Adding a suite or application

A new runnable browser application under a registered discovery root is rejected until it appears in `orbit/suite.json`.

Each registration includes:

- stable suite ID and root;
- surface type and brand;
- canonical HTTPS origin;
- root, token, header, footer, and page-root files;
- header/footer/social variants;
- real authentication mode and evidence;
- canonical issuer and durable identity where applicable;
- browser-storage policy;
- backend-authorization requirement;
- Brand/Footer/Page/Asset API ownership;
- stable content keys and Asset API IDs;
- new-page policy;
- build, test, accessibility, screenshot, security, staging, deployment, and rollback gates.

## 11. Repository manifest

Every browser-facing repository uses:

```text
orbit/suite.json
```

Multi-application repositories use `suiteDiscovery` so a new `apps/*/package.json` directory cannot bypass registration.

The manifest pins the Orbit visual contract to a full `appolon1908-hue/SDK-repository` commit SHA. Floating branches or tags are not sufficient production evidence.

## 12. Required CI gate

Each repository adds a workflow that checks out full history and invokes the validator at an immutable SDK commit:

```yaml
- uses: appolon1908-hue/SDK-repository/.github/actions/orbit-validate@<FULL_COMMIT_SHA>
  with:
    manifest: orbit/suite.json
    base-ref: ${{ github.base_ref }}
```

The gate fails closed for:

- missing or invalid manifests;
- unregistered suites;
- missing root attributes;
- missing header, footer, login, logout, or guard evidence;
- noncanonical issuer;
- missing backend authorization declaration;
- hard-coded social profile URLs;
- copied external authentication values;
- missing content or Asset API ownership;
- gradients, glass, glow, shadows, oversized radii, blue primary actions, or new raw colors;
- missing new-page inheritance rules.

## 13. Vendor systems

Keycloak, Odoo, Grafana, Superset, n8n, and other vendor applications use supported themes, templates, plugins, or branding mechanisms. Do not patch upstream core code or add a cosmetic login that bypasses the native session and authorization model.

## 14. Production boundary

Passing the Orbit source contract proves source-side adoption only. It does not prove DNS, runtime deployment, provider activation, production identity configuration, published social links, or live traffic cutover.

Production requires an immutable application artifact, exact Orbit package/source identity, staging acceptance, responsive screenshots, accessibility results, API and authentication evidence, CSP review, observability, and rollback proof.
