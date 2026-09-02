# Horizon authentication, page, color, and suite rules

## Status

This document is a mandatory extension of the Horizon unified experience contract. It applies to every Codestra-owned public website, customer account, operator portal, administrative application, mobile/web suite, and supported vendor theme.

The rules are enforced through a repository-local `horizon/suite.json` manifest and the pinned composite validator at `.github/actions/horizon-validate`.

## 1. Authentication is functional, not decorative

A header may show **Sign in**, **Account**, or **Log out** only when the linked repository contains and registers the real implementation.

Allowed authentication modes:

| Mode | Use |
|---|---|
| `public-only` | Public content with no protected route and no account controls |
| `oidc-pkce` | Browser application using Keycloak Authorization Code Flow with PKCE S256 |
| `same-origin-bff` | Browser application using a same-origin backend-for-frontend session |
| `api-session` | Existing API session retained only as an explicit migration state |
| `vendor-native` | Supported authentication mechanism of a vendor product such as Keycloak, Odoo, Grafana, or Superset |

Protected suites must provide all of the following:

- a real login path and source file;
- session bootstrap and expiry handling;
- a fail-closed protected-route guard;
- 401 and 403 handling;
- a real provider/API logout operation before local cleanup where the protocol supports revocation;
- a header or operator shell that reflects the real session state;
- backend-authoritative permission, tenant, record, capability, and state checks;
- durable identity based on Keycloak `issuer + subject` for OIDC;
- an explicit migration target of `issuer + subject` for a legacy API session.

The canonical issuer is:

```text
https://auth.codestra.co/realms/codestra
```

Email address, display name, browser role labels, route visibility, and client-side token claims are never sufficient authorization by themselves.

### Logout requirements

Logout must:

1. disable duplicate clicks while in progress;
2. invoke the provider end-session endpoint or application logout/revocation operation when available;
3. remove only the application-owned credentials and state;
4. clear cached privileged data;
5. broadcast the signed-out state to all applicable tabs/shells;
6. return the user to an approved same-origin or registered public route;
7. succeed locally even when remote revocation is temporarily unavailable.

`sessionStorage.clear()` and `localStorage.clear()` are forbidden because they delete unrelated product state. Open redirect parameters are forbidden; post-login and post-logout destinations must be validated same-origin paths or registered origins.

### Browser token storage

New production applications must prefer a same-origin BFF with secure, `HttpOnly`, `SameSite` cookies. A repository that still stores bearer or refresh tokens in browser storage must declare:

```json
"browserTokenStorage": "legacy-session-storage-migration-required"
```

and must not describe that state as the final production security model.

## 2. Every page inherits the root shell

A product defines the Horizon root exactly once in its authoritative application layout. Every page below that layout inherits:

- `data-horizon-root`;
- the registered product theme;
- dark, light, or system appearance behavior;
- typography, spacing, borders, focus, forms, tables, cards, and CTA hierarchy;
- the shared public header/footer or approved operator-shell equivalent;
- localization, accessibility, analytics, and security providers already owned by the application.

A page must not create a second global header, footer, root token set, authentication provider, or independent color palette.

New pages must define every applicable state:

- loading;
- empty;
- partial;
- stale;
- degraded;
- unauthorized;
- forbidden;
- validation error;
- server error with safe reference information;
- offline behavior;
- durable success/receipt.

A transient toast by itself is not a durable success state for a protected command.

## 3. Color and typography are token-owned

Product pages and components consume Horizon variables. They do not introduce raw foundational colors.

Approved examples:

```css
background: var(--hz-bg);
color: var(--hz-text);
border-color: var(--hz-border);
outline-color: var(--hz-focus);
```

Semantic status variables remain distinct from product accent variables:

- `--hz-success`
- `--hz-warning`
- `--hz-danger`
- `--hz-info`

The product accent must not represent success, failure, gain, loss, risk, destructive action, or financial direction.

The validator rejects newly added hexadecimal, RGB, HSL, Lab, LCH, or OKLCH values outside the registered token files. Existing legacy colors may be migrated progressively, but no new page or component may add to the divergence.

Font files are never copied between repositories. Applications load approved, licensed assets through their own performance and privacy policies; Horizon supplies fallbacks and roles, not font binaries.

## 4. Header and footer rules

### Public and customer surfaces

The common header contains:

- product identity;
- the canonical public-domain label;
- current-route navigation;
- one dominant primary action;
- real session-aware authentication controls where the suite has protected routes;
- complete desktop, keyboard, and mobile behavior.

The common footer contains:

- legal entity and support route;
- the product’s public domain;
- clearly separated identity, API, operator, status, and administration domains where relevant;
- privacy, terms, accessibility, security, and contact links;
- approved Codestra product-network links;
- no backend-only hostname exposed as a customer destination.

### Operator and administrative surfaces

An approved operator shell may replace the public header/footer with a persistent rail, top bar, support/legal route, and environment/domain indicator. It must still use the Horizon tokens, real session state, logout behavior, and registered domain authority.

## 5. Adding a new page

A new page pull request must:

1. live below a registered page root;
2. inherit the registered root layout and shell;
3. use Horizon tokens instead of raw colors;
4. preserve authentication and authorization boundaries;
5. implement applicable page states;
6. retain mobile, keyboard, focus, zoom, and reduced-motion behavior;
7. add route, accessibility, unit/integration, and visual-regression evidence appropriate to the page;
8. avoid fake data, controls, balances, status, testimonials, campaigns, orders, or activity.

## 6. Adding a new suite or application

A new directory under a registered suite-discovery root is rejected until it is added to `horizon/suite.json`.

The suite registration must include:

- stable suite ID and repository root;
- surface type;
- canonical HTTPS origin;
- public, identity, API, operator, administration, and status domain roles as applicable;
- Horizon theme;
- root layout, page roots, token file, and header/footer or operator-shell files;
- real authentication mode;
- Keycloak client, issuer, scopes, audience, redirect URIs, logout URIs, and roles when protected;
- login, logout, session, and guard source files;
- browser-storage policy;
- backend-authorization requirement;
- build, test, accessibility, visual, security, deployment, and rollback gates.

A new suite cannot be production-certified with `public-only` authentication when it contains protected routes or privileged commands.

## 7. Repository manifest

Each repository uses:

```text
horizon/suite.json
```

The manifest records every runnable user-facing suite and the files that prove compliance. Multi-application repositories must use `suiteDiscovery` so a new `apps/*/package.json` directory cannot bypass registration.

## 8. Required CI gate

Each repository adds a workflow that checks out the full history and invokes the validator at an immutable SDK-repository commit:

```yaml
- uses: appolon1908-hue/SDK-repository/.github/actions/horizon-validate@<FULL_COMMIT_SHA>
  with:
    manifest: horizon/suite.json
    base-ref: ${{ github.base_ref }}
```

The gate fails closed for:

- missing or invalid manifests;
- unregistered suites;
- missing root-layout markers;
- missing header/footer/operator-shell files;
- missing token variables;
- unsupported or fake authentication modes;
- protected routes without real login, logout, and guard source evidence;
- noncanonical OIDC issuer;
- missing backend authorization declaration;
- new raw colors outside registered token files.

## 9. Vendor systems

Keycloak, Odoo, Grafana, Superset, n8n, and other vendor applications use supported theme/plugin/branding mechanisms. Do not patch upstream core files or add a cosmetic login that bypasses the vendor’s native session and authorization model.

## 10. Production boundary

Passing this contract proves source-side adoption. It does not prove DNS, runtime deployment, provider activation, production authentication configuration, or live traffic cutover. Those remain separate deployment and certification gates.
