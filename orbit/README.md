# Codestra Orbit v2 source authority

This directory is the source authority for the Codestra Orbit shared shell, design tokens, browser-session controls, domain registry, content client, policy configurations, test helpers, schemas, package tarballs, and repository rollout catalog.

## Absolute rules

- First-party rendered applications consume the pinned packages; they do not copy tokens, headers, footers, auth layouts, social links, or browser-session code.
- Browser OAuth/OIDC tokens remain server-side. JavaScript receives only a same-origin session summary.
- Public and authenticated pages use the shared header/footer variants and registered content/asset resources.
- Vendor operator tools use supported theming and SSO rather than invasive source forks.
- Backend and exporter repositories never receive fabricated login pages.
- A hostname is not live merely because it matches the naming convention. Registry, DNS, TLS, routing, and rollback evidence are all required.
- Every new page updates the route, content, asset, shell/footer, domain, state, test, and rollback manifests in the same pull request.

Run `npm run orbit:validate` from the repository root.
