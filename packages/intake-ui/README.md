# `@codestra/intake-ui`

Framework-neutral accessible UI controllers plus the canonical Codestra Orbit V2 corporate shell, authentication, content, asset, and API-driven footer contract.

## Orbit authority

```ts
import {
  applyOrbitShell,
  createOrbitBrandClient,
  mountOrbitFooter,
} from "@codestra/intake-ui/orbit";
import "@codestra/intake-ui/orbit/styles";
```

See [`ORBIT.md`](ORBIT.md) for exact colors, geometry, shell variants, dynamic-content rules, authentication protection, footer/social behavior, accessibility, and production gates.

`@codestra/intake-ui/horizon` remains a deprecated compatibility alias. New applications and pages use Orbit names.

## Intake boundaries

The package also renders forms, surveys, callbacks, and popup experiences while keeping transport in `@codestra/intake-sdk` and credentials in the same-origin `@codestra/intake-bff`.

- UI never stores service, identity, provider, database, or infrastructure credentials.
- UI never chooses Odoo models or privileged connector methods.
- UI consumes reviewed definitions and submits through the SDK/BFF path.
- Popup triggers are presentation behavior only; authorization and routing remain server-side.
- Callback controls collect intent and consent only; they do not place PSTN calls directly from browser code.
- Social profile URLs are read only from the published Orbit footer resource.
- Dynamic content uses stable content keys and Asset API IDs rather than executable source.

## Canonical paths

```text
Browser UI
  -> same-origin application/BFF
  -> Caddy/Kong
  -> authoritative backend or Middleware
```

```text
Intake UI
  -> intake-form/intake-survey
  -> intake-sdk
  -> intake-bff
  -> Caddy
  -> Kong
  -> Middleware
```

Orbit changes presentation and content delivery only. It does not authorize protected operations, provider effects, financial mutations, production deployments, or live traffic.
