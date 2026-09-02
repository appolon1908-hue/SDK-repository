# Codestra Orbit account-wide adoption matrix

**Authority:** `appolon1908-hue/SDK-repository`  
**Package:** `@codestra/intake-ui/orbit`  
**State:** `SOURCE_AUTHORITY_IN_REVIEW`  
**Production activation:** Not authorized by this matrix.

## Classification

| Class | Meaning |
|---|---|
| `DIRECT_APPLICATION` | Codestra-owned browser source adopts Orbit components, tokens, shell declarations, and API clients directly. |
| `MULTI_APPLICATION_MONOREPO` | Every runnable browser application registers independently in one `orbit/suite.json`. |
| `VENDOR_SUPPORTED_THEME` | Adopt through supported theme, template, plugin, or branding mechanisms without patching vendor core. |
| `SERVER_RENDERED_ADMIN` | Apply only to owned templates/static assets; preserve framework security and administration behavior. |
| `DOCUMENTATION_ONLY` | Record the Orbit contract and adoption state but do not add browser runtime code. |
| `NO_BROWSER_RUNTIME` | Do not install Orbit into the service. The repository may validate route or release policy only. |
| `LEGACY_OR_PLACEHOLDER` | Do not create a second Orbit implementation; first resolve repository authority or archive status. |

## Direct browser applications

| Repository | Class | Brand | Known surfaces | Canonical/target origins | Required adoption |
|---|---|---|---|---|---|
| `appolon1908-hue/codestra` | `DIRECT_APPLICATION` | `codestra` | public, customer/dashboard, auth entry | `https://codestra.co` | Root shell, standard/auth headers, full/compact/auth footer, content/asset API, real session controls, all pages registered. |
| `appolon1908-hue/beyvra-frontend` | `DIRECT_APPLICATION` | `beyvra` | public, trading customer, admin | `https://beyvra.com`, `https://platform.beyvra.com`, `https://admin.beyvra.com`, staging | Preserve same-origin BFF, charts, order-safety states, and financial semantics; primary action becomes Orbit white/black. |
| `appolon1908-hue/Breero.com` | `MULTI_APPLICATION_MONOREPO` | `breero` | public/customer, partner, operations, admin | `https://breero.com`, `https://partners.breero.com`, `https://ops.breero.com`, `https://admin.breero.com` | Register and validate each application; preserve marketplace, dispatch, finance, and provider authorization boundaries. |
| `appolon1908-hue/booked4seasons` | `DIRECT_APPLICATION` | `breero` | public lead capture | `https://booked4seasons.com` | Public shell and full footer; no fake protected account controls until real application authority exists. |
| `appolon1908-hue/Moneybee-frontend-` | `MULTI_APPLICATION_MONOREPO` | `moneybee` | public, borrower, lender, admin | `https://moneybeeloan.com`, `https://app.moneybeeloan.com`, `https://lenders.moneybeeloan.com`, `https://admin.moneybeeloan.com` | Register four applications; preserve underwriting, offers, funding, compliance, and servicing as backend authority. |
| `appolon1908-hue/transportaion-Frontend` | `MULTI_APPLICATION_MONOREPO` | `transportation` | broker, dispatcher, operations, admin, customer, carrier | Domain authority must be documented before production | Register every executable suite; preserve freight, tender, dispatch, finance, and provider states. |
| `appolon1908-hue/LARIM-A-Fornt-end` | `MULTI_APPLICATION_MONOREPO` | `larim` | customer web/mobile, professional mobile, operations web | Domain authority must be documented before production | Register all four applications; preserve Capacitor/native safe areas, booking/dispatch/payment/provider boundaries, and mobile release controls. |
| `appolon1908-hue/Frontend-Resturant-` | `DIRECT_APPLICATION` | `restaurant` | customer and restaurant operations | Domain authority must be documented before production | Apply root shell and API footer to owned Nuxt pages; preserve reservation, order, kitchen, table, payment, and staff authorization. |
| `appolon1908-hue/klyrow-Website-` | `DIRECT_APPLICATION` | `klyrow` | public marketing/auth entry | `https://klyrow.com` | Public/auth shell; keep application/API separation and do not imply the marketing source is deployed before cutover evidence. |
| `appolon1908-hue/klyrow.com` | `DIRECT_APPLICATION` | `klyrow` | authenticated email/campaign application | `https://app.klyrow.com`, `https://api.klyrow.com` | Adopt only the owned browser layer; preserve Postal/Mautic/API boundaries, tenant scope, suppression, billing, and email-write safety. |
| `appolon1908-hue/Telnexa-web` | `DIRECT_APPLICATION` | `telnexa` | public marketing, compliance and onboarding | `https://telnexa.co`, `https://app.telnexa.co` | Public/auth shell and content API; preserve service onboarding, compliance, and API boundary. |
| `appolon1908-hue/social.codestra.co` | `DIRECT_APPLICATION` | `social` | authenticated social planning/publishing application | `https://social.codestra.co` | Preserve Postiz/Temporal behavior, provider authorization, approvals, scheduling, publishing, and analytics; no source-hardcoded social-profile footer URLs. |

## Server-rendered and vendor-supported browser systems

| Repository | Class | Brand | Surface | Required adoption |
|---|---|---|---|---|
| `appolon1908-hue/backend2` | `SERVER_RENDERED_ADMIN` | `codestra` | Django administration and CMS routes | Apply Orbit only to Codestra-owned templates/static assets; do not replace Django authentication, CSRF, permissions, or admin behavior. |
| `appolon1908-hue/codestra-backend` | `SERVER_RENDERED_ADMIN` | `codestra` | recovered Django API/admin lineage | Do not adopt until canonical/legacy authority is resolved; any owned template must preserve Django security. |
| `appolon1908-hue/Keycloak` | `VENDOR_SUPPORTED_THEME` | `codestra` | login, registration, verification, recovery, MFA, account console | Use supported Keycloak themes/messages/resources. Preserve realm, client, redirect, session, MFA, logout, and role configuration. Never copy reference authentication values. |
| `appolon1908-hue/Odoo` | `VENDOR_SUPPORTED_THEME` | `codestra` | Odoo login, backend, portal, website components | Use supported modules, assets, QWeb/OWL/templates, and configuration. Preserve Odoo ACLs, record rules, CSRF, sessions, company/tenant behavior, and upgrades. |
| `appolon1908-hue/Codestra-Grafana-` | `VENDOR_SUPPORTED_THEME` | `neutral` | authenticated operational dashboards | Use supported branding/config/plugin mechanisms only. Preserve Grafana auth, RBAC, data sources, dashboards, alerts, and restricted ingress. |
| `appolon1908-hue/Superset` | `VENDOR_SUPPORTED_THEME` | `neutral` | authenticated business analytics | Use supported branding/templates/configuration only. Preserve Superset security manager, roles, dataset permissions, CSP, and migrations. |
| `appolon1908-hue/N8N` | `VENDOR_SUPPORTED_THEME` | `neutral` | protected automation editor | Apply only through supported configuration/theme mechanisms. Preserve Keycloak/Kong protection, credentials, projects, workflow permissions, and execution behavior. |

## Documentation and governance repositories

| Repository | Class | Required adoption |
|---|---|---|
| `appolon1908-hue/SDK-repository` | `DOCUMENTATION_ONLY` plus package authority | Own canonical Orbit source, schemas, OpenAPI, validator, examples, compatibility policy, and package release. |
| `appolon1908-hue/documentaions` | `DOCUMENTATION_ONLY` | Record account-wide design authority, product origins, exceptions, adoption PRs, staging evidence, and release state. |
| `appolon1908-hue/Infustruction-repo` | `DOCUMENTATION_ONLY` | Record exact SDK/package identity, build/deploy integration, CSP/edge implications, screenshot evidence, and rollback. Do not manufacture UI source. |
| `appolon1908-hue/codestra-production-platform` | `DOCUMENTATION_ONLY` | Record protected release adoption, immutable artifacts, source locks, staging/production readback, and rollback. Orbit source must remain in owning repositories. |
| `appolon1908-hue/communication-platform-` | `DOCUMENTATION_ONLY` | Reference Orbit for any future operator/customer UI; do not create a competing component library. |
| `appolon1908-hue/Codestra-Marketing-` | `DOCUMENTATION_ONLY` until UI exists | Register future browser applications before implementation; no autonomous campaign-spend authorization from UI design. |
| `appolon1908-hue/Codestra-Communication-CC` | `DOCUMENTATION_ONLY` until UI exists | Register future communication UI before implementation; preserve consent, suppression, channel, and delivery-state authority. |
| `appolon1908-hue/Codesrea-Social-` | `DOCUMENTATION_ONLY` | Remains provider-neutral control-plane architecture and must not compete with `social.codestra.co` runtime UI. |
| `appolon1908-hue/Codestra-AI` | `DOCUMENTATION_ONLY` until UI authority is proven | Register any `ai.codestra.co` browser application and real auth/API source before claiming adoption. |

## No browser runtime

Orbit runtime code must not be installed into these repositories merely for consistency:

| Repository group | Repositories | Allowed Orbit work |
|---|---|---|
| API/integration control plane | `Middleware-`, `Kong`, `codestra-provisioning-service`, `SDK-repository` non-UI packages | API contracts, headers, schemas, route and release policy only. |
| Edge | `Caddy` | Route/CSP/header policy for adopted applications; no UI runtime. |
| Messaging/voice/provider backends | `telnexa`, `Vicidialer-Codestra`, `kyqra-crawler` | No UI runtime unless a distinct owned browser application is later registered. |
| Observability storage/collectors | `Codestra-Prometheus`, `Codestra-Alertmanager`, `Codestra-Loki`, `Codestra-Tempo`, `Codestra-Telemetry`, `Codestra-Alloy` | No Orbit UI. Preserve private service exposure. |
| Exporters | `Codestra-Node-Exporter`, `Codestra-cAdvisor`, `Codestra-Redis-Exporter`, `Codestra-Blackbox-Exporter`, `Codestra-Postgres-Exporter` | No Orbit UI. PostgreSQL Exporter remains private `postgres-exporter:9187` with no public hostname. |
| Secrets | `Codestra-OpenBao` | Use only supported native UI customization and keep access tightly restricted; never expose secrets through Orbit content APIs. |
| Product backends | `beyvra-backend`, `Moneybee-Backend`, `transportation-backend-`, `LARIM-A-Backend` | Implement required Brand/Content/Asset/Footer endpoints only in an approved owning backend; do not add presentation source. |

## Legacy or authority-blocked repositories

| Repository | Class | Required decision |
|---|---|---|
| `appolon1908-hue/Codestraxxxx` | `LEGACY_OR_PLACEHOLDER` | Archive or assign a real authority before any Orbit work. |
| `appolon1908-hue/kyqra` | `LEGACY_OR_PLACEHOLDER` | Keep deprecated; canonical crawler is `kyqra-crawler`. |
| `appolon1908-hue/scrapper` | `LEGACY_OR_PLACEHOLDER` | Keep legacy/reference only; do not create a competing crawler UI. |
| duplicate Codestra backend lineage | `backend2`, `codestra-backend` | Resolve canonical/legacy status before duplicate dynamic-content or administration implementations are introduced. |

## Required repository PR contents

Every direct or multi-application adoption PR includes:

```text
orbit/suite.json
ORBIT_ADOPTION.md
root shell attributes
header and footer implementation
Brand/Footer API client or canonical shared import
stable page/content keys
Asset API IDs
real login/logout/guard evidence where protected
responsive and accessibility tests
Orbit exact-SHA workflow
no production activation
```

Every vendor theme PR includes:

```text
supported extension mechanism
vendor-version compatibility
native auth/RBAC preservation
Orbit token mapping
login/account/admin screenshots
upgrade and rollback evidence
no upstream core patch
no production activation
```

## Rollout order

1. SDK Orbit authority.
2. Codestra corporate site and Keycloak authentication theme.
3. Beyvra and MoneyBee customer financial interfaces.
4. Breero, Booked4Seasons, Restaurant, Transportation, and LARIM-A product interfaces.
5. Klyrow, Telnexa, and Codestra Social communications interfaces.
6. Odoo and protected vendor/operator portals.
7. Staging source locks, screenshot certification, immutable artifacts, rollback rehearsal, then separately approved production cutovers.

## Completion rule

A repository is not `ORBIT_ADOPTED` because a README or manifest exists. Completion requires:

```text
SOURCE_CONTRACT=PASS
BUILD_AND_TYPECHECK=PASS
AUTH_AND_ROUTE_BEHAVIOR=PASS|N/A
FOOTER_API_CONTRACT=PASS
NO_HARDCODED_SOCIAL_URLS=PASS
NO_PROHIBITED_VISUAL_PATTERNS=PASS
DESKTOP_1440_SCREENSHOT=PASS
MOBILE_390_SCREENSHOT=PASS
KEYBOARD_AND_FOCUS=PASS
WCAG_REVIEW=PASS
STAGING_EXACT_ARTIFACT=PASS
ROLLBACK_REHEARSAL=PASS
PRODUCTION_ACTIVATION=SEPARATELY_APPROVED
```
