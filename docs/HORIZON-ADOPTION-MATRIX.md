# Horizon adoption matrix

## Authority

- Shared package and contract: `appolon1908-hue/SDK-repository` → `packages/intake-ui` → Horizon module
- Versioned package: `@codestra/intake-ui`
- Horizon runtime subpath: `@codestra/intake-ui/horizon`
- Initial branch: `feature/horizon-unified-experience-v1`
- Runtime activation: none in the foundation change

## Product rollout

The following repositories are the current user-facing adoption targets discovered in the authenticated repository inventory. Each repository must be inspected before modification; names alone do not prove which directories are runnable or deployed.

| Wave | Repository | Intended theme | First migration slice |
|---|---|---|---|
| 1 | `appolon1908-hue/codestra` | `codestra` | public shell, global header/footer, home and primary CTA |
| 1 | `appolon1908-hue/Breero.com` | `breero` | `apps/web` only; public marketplace and booking flow |
| 1 | `appolon1908-hue/Telnexa-web` | `telnexa` | public shell, product pages, sign-in and contact conversion |
| 1 | `appolon1908-hue/klyrow-Website-` | `klyrow` | public shell, authentication and account overview |
| 1 | `appolon1908-hue/social.codestra.co` | `social` | app shell, composer, campaign list and state handling |
| 2 | `appolon1908-hue/beyvra-frontend` | `beyvra` | app shell, market explorer, safe order ticket and activity |
| 2 | `appolon1908-hue/Moneybee-frontend-` | `moneybee` | application, document, servicing and account pages |
| 2 | `appolon1908-hue/LARIM-A-Fornt-end` | `larim` | application shell, customer flows and operator surfaces |
| 2 | `appolon1908-hue/transportaion-Frontend` | `transport` | marketing, shipper, carrier and operations shells |
| 2 | `appolon1908-hue/booked4seasons` | `neutral` | public booking shell and account pages after product-theme review |
| 2 | `appolon1908-hue/Frontend-Resturant-` | `neutral` | public ordering/booking shell after runnable-app inspection |
| 3 | `appolon1908-hue/kyqra` | `neutral` | inspect whether a user-facing UI exists before adoption |
| 3 | `appolon1908-hue/klyrow.com` | `klyrow` | reconcile with `klyrow-Website-`; avoid two competing authorities |
| 3 | `appolon1908-hue/telnexa` | `telnexa` | reconcile with `Telnexa-web`; avoid two competing authorities |

## Vendor and operator applications

Use supported theming mechanisms rather than importing Horizon directly into upstream core code:

| Repository/application | Strategy |
|---|---|
| `appolon1908-hue/Keycloak` | custom supported login/account theme with Horizon tokens compiled into theme assets |
| `appolon1908-hue/Odoo` | custom Codestra web theme/module; no direct edits to Odoo core |
| `appolon1908-hue/Codestra-Grafana-` | supported branding/theme configuration and provisioned dashboard conventions |
| `appolon1908-hue/Superset` | supported application branding and CSS/theme extension |
| n8n, Kong, Caddy and infrastructure tools | operational branding only where supported; do not alter product behavior for visual consistency |

## Per-repository migration sequence

1. Read repository instructions and identify the authoritative runnable frontend.
2. Record current routes, framework, package manager, build/test commands and deployment authority.
3. Add `@codestra/intake-ui` with an exact approved version and import the Horizon subpath.
4. Apply the root theme attributes and import styles once.
5. Migrate shell, typography, buttons, forms and page states before decorative sections.
6. Preserve product-specific components and API behavior.
7. Add screenshots or visual-regression baselines for mobile, tablet and desktop.
8. Run lint, typecheck, unit, integration, end-to-end, accessibility and production build gates.
9. Commit and push the exact logical change to a repository branch.
10. Open a pull request with exact-head evidence and no runtime activation.

## Acceptance criteria for every adoption PR

- no copied Starlink or other third-party source, branding, private content, font binaries or assets
- one shared layout and interaction grammar across the product family
- product-specific accent remains restrained
- mobile and desktop navigation are complete
- primary, secondary, destructive and disabled CTA states are implemented
- loading, empty, error, offline/degraded and success states are present where applicable
- customer and operator actions remain tied to real backend capabilities
- accessibility and visual-regression evidence is attached
- exact package version and application commit are recorded
- rollback returns the previous shell without changing backend data or deployment credentials
