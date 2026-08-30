# @codestra/intake-ui

Framework-neutral accessible UI primitives for Codestra intake.

Use it to render forms, surveys, callbacks, and popup experiences while keeping transport in `@codestra/intake-sdk` and credentials in the same-origin `@codestra/intake-bff`.

## Boundaries

- UI never stores service credentials.
- UI never chooses Odoo models or privileged connector methods.
- UI consumes reviewed form/survey definitions and submits through the SDK/BFF path.
- Popup triggers are presentation behavior only; authorization and routing remain server-side.
- Callback controls collect intent/consent only. They do not place PSTN calls directly from browser code.

## Canonical path

`UI -> intake-form/intake-survey -> intake-sdk -> intake-bff -> Caddy -> Kong -> Middleware`
