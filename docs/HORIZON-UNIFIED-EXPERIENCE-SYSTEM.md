# Horizon Unified Experience System v1

## Decision

Horizon is the authoritative visual and interaction foundation for Codestra-owned websites, portals and operator applications.

The intended feeling is premium, direct, high-contrast, spacious and operationally calm. The system may take directional inspiration from strong public product experiences, including restrained monochrome palettes, immersive sections, crisp cards and decisive calls to action, but it must remain an original Codestra implementation.

Do not copy or redistribute third-party source code, private dashboard content, page copy, logos, photography, illustrations, icons, proprietary fonts, trademarks, or pixel-identical compositions.

## Outcome

Every included product should feel like part of the same company because it uses the same:

- layout grid, page width and spacing rhythm
- typography roles and content hierarchy
- global navigation and app-shell behavior
- button, link and call-to-action hierarchy
- form, validation and submission behavior
- card, table, filter and data-display patterns
- loading, empty, partial, degraded and error states
- accessibility, keyboard, focus and reduced-motion behavior
- responsive breakpoints and mobile interaction rules
- quality gates and visual-regression process

Products keep their own names, domain language, imagery and a restrained accent. The accent never replaces semantic colors or the monochrome primary action system.

## Visual language

### Canvas

Dark is the default operational appearance. Use near-black rather than pure black for the page canvas, a slightly lighter application surface, thin translucent borders, and white or warm-white content surfaces when contrast is needed.

A complete light appearance is required. Light mode is not a simple inversion; it uses a warm off-white canvas, white cards, dark text and reduced shadows.

### Typography

- Display: `Space Grotesk` with system fallbacks.
- Body and interface: `Inter` with system fallbacks.
- Monospace: `IBM Plex Mono` with system fallbacks.
- Font files are loaded by each application through its approved asset policy; Horizon ships no font binaries.
- Hero headings may use uppercase command styling. Ordinary page headings remain sentence case for readability.
- Utility labels and eyebrows use uppercase with generous tracking.
- Body copy must not use all caps.

### Geometry

- Controls: 4px radius.
- Cards: 8px radius.
- Panels and overlays: 12px radius maximum.
- Pills are reserved for status badges, compact filters and tags.
- Borders carry more visual weight than shadows.
- Avoid gradient-heavy SaaS styling, glassmorphism on every surface, excessive rounding and oversized empty heroes.

### Imagery

Marketing pages may use full-bleed, high-quality original or licensed photography with a controlled dark scrim. Product dashboards use imagery sparingly. Never reuse third-party website assets.

## Call-to-action system

Each decision area has one dominant action.

1. Primary: white on dark or near-black on light. Use for the single next action.
2. Secondary: transparent with a strong border. Use for a valid alternative.
3. Accent: product accent with dark text. Use sparingly for selected emphasis, not as the default action everywhere.
4. Tertiary: text link with directional arrow. Use for navigation and supporting actions.
5. Destructive: semantic danger treatment and explicit confirmation; never use the product accent.

Button copy uses a verb and object: `Add service`, `Review application`, `Create campaign`, `Preview order`, `Submit payment`. Avoid vague labels such as `Continue` when the outcome can be named.

## Page families

### Public marketing

Standard sequence:

1. transparent or solid high-contrast header
2. immersive hero with one primary CTA and one supporting action
3. product or service selector
4. benefit split section
5. evidence, metrics or trust section
6. process or capability section
7. plan, pricing or conversion section where applicable
8. FAQ and support route
9. final CTA
10. legal and corporate footer

### Authentication

- focused single-column panel
- visible product and company identity without third-party mimicry
- password manager and passkey friendly inputs
- explicit recovery, privacy and support routes
- no marketing carousel competing with account access
- complete loading, validation, lockout and service-unavailable states

### Customer account home

- stable app shell or compact account header
- account/workspace selector when the user owns more than one
- page title and one primary action
- summary metrics
- service or product cards
- billing or plan card
- recent activity
- support and settings routes
- honest partial, stale, degraded and unavailable states

### Operator dashboard

- persistent desktop rail and accessible mobile drawer
- page-level filters with explicit applied state
- KPI summary with source and timestamp
- dense but readable table or queue
- audit/event timeline
- safe command preview and confirmation
- role/capability-aware actions
- no fake controls for backend operations that do not exist

### Data-heavy and financial products

- product accent is not used for gains, losses, success or danger
- tables support keyboard navigation and horizontal overflow
- charts include text summaries and unavailable states
- timestamps, data freshness and source authority remain visible
- mutation flows show preview, confirmation, submission, durable receipt and reconciliation state

## Component contract

Horizon v1 includes framework-neutral CSS for:

- containers, sections, stacks, clusters and grids
- display, title, heading, lead, eyebrow and metadata roles
- primary, secondary, accent, ghost, small, large and block buttons
- cards, raised cards, contrast cards and statistics
- status badges and alert panels
- form fields, help text and errors
- tabs and horizontal overflow behavior
- responsive tables
- application shell, sidebar, top bar and navigation items
- hero sections
- empty and skeleton states

Applications may compose these primitives into product-specific components. They must not fork the tokens or redefine the foundational class behavior without an approved design-system change.

## Accessibility requirements

- WCAG 2.2 AA target for all customer and operator flows.
- Visible keyboard focus on every interactive control.
- Touch targets should be at least 44px except where a documented dense-data exception is required.
- Skip links on multi-region pages.
- Semantic headings and landmarks.
- Labels are not replaced by placeholders.
- Errors identify the field, cause and recovery action.
- Color is never the only status signal.
- Reduced-motion preference disables nonessential movement.
- Responsive layouts work at 320px width and up to large desktop widths.
- Zoom at 200% must not hide essential content or actions.

## Content tone

- direct, calm, trustworthy and specific
- short headings with meaningful supporting copy
- active voice
- no exaggerated technology claims
- no false real-time claims when data is cached or delayed
- no fake testimonials, activity, balances, orders, campaigns or operational states
- product terminology remains accurate for the underlying API

## Integration contract

At the application root:

```html
<html
  data-horizon-root
  data-horizon-theme="codestra"
  data-horizon-appearance="dark"
>
```

Import the style layer once:

```ts
import "@codestra/intake-ui/horizon/styles";
```

Framework adapters may call `applyHorizonTheme` or use `getHorizonThemeAttributes` for server rendering.

Third-party products such as Keycloak, Odoo, Grafana and Superset must use their supported theme/plugin/branding mechanisms. Do not patch upstream core files or inject uncontrolled global CSS into vendor applications.

## Required page-state matrix

Every migrated page must define and test:

| State | Requirement |
|---|---|
| Loading | skeleton or progress with preserved layout |
| Empty | explain why the page is empty and offer a valid next action |
| Partial | identify missing regions without hiding available data |
| Stale | show the last successful update time and refresh action |
| Degraded | identify the affected capability and safe fallback |
| Unauthorized | distinguish sign-in, insufficient role and tenant mismatch |
| Validation error | field-level message plus summary for long forms |
| Server error | correlation/reference ID where available and safe retry guidance |
| Offline | block unsafe mutations and preserve readable cached data where supported |
| Success | durable receipt or clear completed state, not a transient toast alone |

## Quality gates

A product is not Horizon-complete until all applicable gates pass:

- tokens consumed from the shared package; no duplicated foundational palette
- no third-party assets or proprietary page copy copied into the repository
- representative public, account and operator pages migrated
- mobile, tablet, desktop and large-desktop screenshots reviewed
- keyboard-only path passes
- automated accessibility checks pass with manual follow-up
- visual regression coverage for core page templates and all states
- performance budget defined and measured on production-equivalent builds
- forms and mutations retain their existing security, CSRF, idempotency and authorization behavior
- localization does not break layout
- release and rollback evidence names the exact package and application commits

## Rollout rule

The shared contract lands first. Product repositories then adopt Horizon in separate reviewable pull requests. Do not perform a blind global stylesheet replacement. Each migration must preserve routes, data contracts, authentication, authorization, analytics, SEO, form semantics and mutation safety.
