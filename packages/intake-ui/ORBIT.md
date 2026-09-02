# Codestra Orbit Design System V2

Codestra Orbit is the canonical visual, shell, content, asset, authentication-page, and footer contract for Codestra-owned browser applications.

It is an original Codestra system. It does not contain Starlink source code, private account information, trademarks, logos, screenshots, callback values, client identifiers, redirect URIs, `ReturnUrl`, state, nonce, PKCE challenges, or proprietary wording.

## Authority

```text
DESIGN_SYSTEM=CODESTRA_ORBIT
CONTRACT_VERSION=2.0.0
PACKAGE=@codestra/intake-ui
CANONICAL_MODULE=@codestra/intake-ui/orbit
CANONICAL_STYLES=@codestra/intake-ui/orbit/styles
HORIZON_STATUS=DEPRECATED_COMPATIBILITY_ALIAS
PRIMARY_ACTION=WHITE_BACKGROUND_BLACK_TEXT
DEFAULT_APPEARANCE=DARK_ONLY
SOCIAL_URL_SOURCE=BRAND_FOOTER_API
```

Orbit controls presentation and shell behavior. It does not authorize users, determine balances or prices, approve compliance, move money, publish campaigns, call providers, or replace server-side validation.

## Exact color system

| Purpose | Value |
|---|---|
| Main canvas | `#000000` |
| Primary surface | `#101010` |
| Elevated surface | `#171717` |
| Secondary surface | `#202020` |
| Main text | `#FFFFFF` |
| Supporting text | `#D8D8D8` |
| Muted text | `#9A9A9A` |
| Default border | `#353535` |
| Strong border | `#5A5A5A` |
| Primary action background | `#FFFFFF` |
| Primary action text | `#000000` |
| Primary hover | `#E7E7E7` |
| Primary active | `#CCCCCC` |
| Success | `#36C98F` |
| Warning | `#F4B860` |
| Error | `#FF6469` |
| Information | `#79B8FF` |

Blue is informational only. It must not become the normal primary action, selected navigation, focus, or brand color.

## Geometry

```text
DESKTOP_HEADER=76px
TABLET_HEADER=64px
MOBILE_HEADER=56px
STANDARD_CONTROL=52px
COMPACT_CONTROL=44px
AUTH_CONTENT_MAX=480px
DEFAULT_RADIUS=2px
MAXIMUM_NORMAL_RADIUS=6px
SOCIAL_ICON_VISUAL=20px
SOCIAL_INTERACTION_TARGET=44px
MAIN_CONTENT_MAX=1280px
WIDE_CONTENT_MAX=1440px
TEXT_COLUMN_MAX=720px
```

The shared shell prohibits gradients, glass or backdrop-blur effects, glow, decorative neon colors, excessive shadows, and rounded interface surfaces larger than 6px.

## Installation

```ts
import {
  applyOrbitShell,
  createOrbitBrandClient,
  mountOrbitFooter,
} from "@codestra/intake-ui/orbit";
import "@codestra/intake-ui/orbit/styles";

applyOrbitShell(document.documentElement, {
  brand: "codestra",
  headerVariant: "auth",
  footerVariant: "auth-compact",
  socialAllowed: true,
});
```

The root element must declare Orbit before the application renders so the browser never flashes an ungoverned theme.

## Header variants

- `standard` — public sites, customer portals, and full application shells.
- `compact` — dense operator or administration layouts.
- `auth` — login, registration, verification, password reset, recovery, and MFA surfaces.

## Footer variants

- `full` — public websites and primary customer products.
- `compact` — authenticated applications and administration software.
- `auth-compact` — authentication and account-recovery pages.
- `legal-only` — constrained or regulated surfaces where social links are not allowed.

Supported social networks are LinkedIn, Facebook, Instagram, X, YouTube, GitHub, TikTok, and Threads.

Social profile URLs are never committed to frontend repositories. The application reads only published entries from:

```http
GET /api/v1/brands/{brand}/footer
```

Administrators use:

```http
PUT  /api/v1/admin/brands/{brand}/footer
POST /api/v1/admin/brands/{brand}/footer/publish
POST /api/v1/admin/brands/{brand}/footer/rollback
```

Every mutation requires authorization plus:

```text
Idempotency-Key
X-Correlation-ID
X-Expected-Resource-Version
X-Safe-Reason
```

The server remains responsible for tenant/brand authorization, optimistic concurrency, safe-reason policy, approval history, audit evidence, publication evidence, and rollback eligibility.

Missing, unpublished, withdrawn, malformed, or non-HTTPS social entries are not rendered.

## Framework-neutral footer

```ts
const client = createOrbitBrandClient({ baseUrl: "/api" });
const footer = await client.getFooter("codestra");

mountOrbitFooter(document.querySelector("[data-footer-root]")!, footer, {
  variant: "auth-compact",
  socialAllowed: true,
  renderSocialIcon(network, document) {
    const icon = document.createElement("span");
    icon.dataset.icon = network;
    icon.setAttribute("aria-hidden", "true");
    return icon;
  },
});
```

Use approved, local icon components or an approved icon package. Do not fetch icons from arbitrary third-party origins at runtime.

## Dynamic content and assets

Every editable value uses a stable content key. Every replaceable image, logo, video, or document uses an Asset API ID.

A page declaration includes:

```ts
import { assertOrbitPageShell } from "@codestra/intake-ui/orbit";

const declaration = {
  page_key: "codestra.account.login",
  header_variant: "auth",
  footer_variant: "auth-compact",
  social_links_allowed: true,
  content_keys: [
    "codestra.account.login.title",
    "codestra.account.login.description",
    "codestra.account.login.submit",
  ],
  asset_ids: ["ast_codestra_logo_primary"],
} as const;

assertOrbitPageShell(declaration);
```

Stable keys may control page text, headlines, descriptions, button labels and destinations, logos, hero/card images, videos, navigation, footer/legal/social links, telephone and email contacts, SEO metadata, account-shell content, authentication instructions, announcements, and product/application links.

The API response is content, not executable source. Do not accept raw HTML, JavaScript URLs, event handlers, untrusted CSS, arbitrary iframe origins, or unvalidated redirects as editable content.

## Authentication pages

Orbit changes the visual language only. Codestra authentication remains owned by Codestra domains, Keycloak configuration, backend/BFF sessions, roles, MFA, logout, allowlisted callbacks, protected deep links, CSRF controls, and authorization policy.

Never copy or persist from an external reference:

- client IDs or client secrets;
- redirect or callback URIs;
- `ReturnUrl` values;
- `state`, `nonce`, authorization codes, or PKCE material;
- account logic, session logic, or private content;
- names, logos, imagery, wording, fonts, screenshots, or source code.

Browser code must not store identity or provider secrets. Authentication success in the interface never replaces backend authorization.

## Required states

Every data-bearing or effectful surface defines applicable states explicitly:

```text
loading
empty
success
partial
stale
degraded
unavailable
unauthorized
forbidden
validation-error
conflict
unknown-outcome
offline
```

The interface must not convert an unknown provider or financial result into success or failure without authoritative read-back.

## Accessibility

- All interactive targets are at least 44px.
- Keyboard focus uses a visible white outline.
- Social icons have accessible names and 44×44 targets.
- Status is conveyed by text and semantics, not color alone.
- Motion respects `prefers-reduced-motion`.
- Form labels, errors, help text, headings, landmarks, and live regions are explicit.
- Product-specific contrast must be verified against the exact Orbit palette.

## Horizon compatibility

`@codestra/intake-ui/horizon` and the `styles/horizon/*` exports remain temporary compatibility aliases. They resolve to Orbit’s black/white corporate palette and may not reintroduce light mode, gradients, blue primary actions, glow, large radii, or shadow-heavy cards.

New work must use Orbit names. Each adopting repository records and later removes Horizon compatibility only after all source, tests, documentation, built artifacts, and runtime evidence use Orbit.

## Production gates

Orbit source can merge without activating a runtime. A production adoption requires:

1. exact SDK package version or immutable source SHA;
2. application build and type checks;
3. responsive screenshot review at 1440px and 390px;
4. overflow, keyboard, focus, and WCAG testing;
5. authentication, logout, protected-route, and failure-state tests;
6. Brand/Footer API contract tests;
7. proof that social URLs are absent from source and rendered only when published;
8. CSP and external-origin review;
9. immutable image/package digest, SBOM, provenance, and rollback evidence;
10. isolated staging acceptance;
11. explicit production deployment approval.

Merging Orbit does not rename repositories, deploy applications, change DNS, rotate secrets, publish social content, enable providers, or authorize production traffic.
