# `@codestra/intake-ui/horizon`

Horizon UI is the framework-neutral visual contract for Codestra-owned websites, customer portals and operator applications. It provides one premium, high-contrast product family while preserving a restrained accent for each brand.

The package contains no API client, authentication flow, business logic or external-write path.

## Design direction

- dark-first monochrome canvas with an equally complete light appearance
- spacious editorial layouts and strong full-width sections
- crisp borders, restrained radii and minimal shadow
- one visually dominant call to action per decision area
- uppercase utility labels paired with readable sentence-case content
- consistent dashboard, table, form, empty, loading and error states
- product accents limited to navigation, focus, charts and selected emphasis
- WCAG-oriented focus, motion and responsive defaults

Horizon is an original Codestra system. Do not copy third-party logos, imagery, page copy, proprietary fonts, source code or private account content into an implementation.

## Install

```bash
pnpm add @codestra/intake-ui
```

Import the complete style layer once:

```ts
import "@codestra/intake-ui/horizon/styles";
```

Apply the contract at the application root:

```html
<body
  data-horizon-root
  data-horizon-theme="codestra"
  data-horizon-appearance="dark"
>
  <!-- application -->
</body>
```

Supported built-in themes are `neutral`, `codestra`, `breero`, `beyvra`, `moneybee`, `larim`, `transport`, `telnexa`, `klyrow`, and `social`. The appearances are `dark`, `light`, and `system`.

## React or Next.js

```tsx
import "@codestra/intake-ui/horizon/styles";
import { getHorizonThemeAttributes } from "@codestra/intake-ui/horizon";

export function RootLayout({ children }: { children: React.ReactNode }) {
  const attributes = getHorizonThemeAttributes({
    theme: "breero",
    appearance: "dark",
  });

  return (
    <html lang="en" {...attributes}>
      <body>{children}</body>
    </html>
  );
}
```

## Vue or Nuxt

```ts
import "@codestra/intake-ui/horizon/styles";
import { applyHorizonTheme } from "@codestra/intake-ui/horizon";

applyHorizonTheme(document.documentElement, {
  theme: "telnexa",
  appearance: "dark",
});
```

## Plain HTML or server-rendered templates

Import the CSS files from the installed package or copy the published stylesheet into the application's approved asset pipeline. Keep the three `data-horizon-*` attributes on the outer application element.

## Core classes

Layout and typography: `hz-container`, `hz-content`, `hz-section`, `hz-stack`, `hz-cluster`, `hz-grid`, `hz-eyebrow`, `hz-display`, `hz-title`, `hz-heading`, `hz-lead`.

Actions and forms: `hz-button`, `hz-button--primary`, `hz-button--secondary`, `hz-button--accent`, `hz-text-link`, `hz-field`, `hz-label`, `hz-input`, `hz-select`, `hz-textarea`.

Applications: `hz-app-shell`, `hz-sidebar`, `hz-topbar`, `hz-main`, `hz-page`, `hz-page-header`, `hz-nav`, `hz-nav__item`.

Data and states: `hz-card`, `hz-stat`, `hz-badge`, `hz-alert`, `hz-tabs`, `hz-table`, `hz-empty-state`, `hz-skeleton`.

## Fonts

Horizon references `Space Grotesk`, `Inter`, and `IBM Plex Mono`, then falls back to system fonts. Font binaries are not included. Each application must load approved, licensed font assets through its own performance and privacy policy.

## Product rule

The black/white action system, layout rhythm, typography, navigation behavior, form behavior, state patterns and accessibility treatment stay consistent across products. A product theme changes only the restrained accent and chart sequence. Semantic success, warning, danger, gain and loss colors must never be replaced with the brand accent.
