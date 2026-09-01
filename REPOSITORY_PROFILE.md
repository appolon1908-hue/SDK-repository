# Repository Profile — `SDK-repository`

## Identity

- **Repository:** `appolon1908-hue/SDK-repository`
- **Category:** Developer platform — contracts and SDKs
- **Visibility:** `public`
- **Default branch:** `main`
- **Authority:** Single shared Codestra SDK, API-contract, and developer-tooling authority
- **Status:** Active monorepo with OpenAPI/AsyncAPI contracts, generated clients, helpers, examples, and compatibility gates.

## Purpose

Houses provider-neutral public API and event contracts, generated SDK packages, webhook verification helpers, connector kits, examples, compatibility policy, and developer documentation.

## Owns

- Canonical OpenAPI, AsyncAPI, schema, error, idempotency, and event contracts
- Generated client SDKs and shared developer tooling
- Contract validation, compatibility, drift, examples, fixtures, and release-version policy

## Does not own

- Privileged runtime execution or provider operations
- Middleware/provider implementation logic
- Separate SDK repositories for each service

## Key integrations

- Kong and Middleware
- `communication-platform-`
- Klyrow, Telnexa, VICIdial, marketing, social, AI, and product applications
- Developer portal, webhooks, and n8n connector tooling

## Current priorities

1. Keep frozen contracts unchanged except through governed versioned changes
2. Generate, test, publish, and document versioned clients
3. Expand webhook verification, connector kits, examples, and portal documentation
4. Run cross-repository contract, compatibility, and staging tests

## Governance and safety

- Promotion model: `feature/docs/fix/security/upgrade -> development -> test -> staging -> production -> main`.
- Contract changes require versioning, compatibility evidence, exact-head CI, generated-client updates, and migration notes.
- Never commit provider credentials, access tokens, private keys, customer payloads, or runtime secrets.
- SDKs may request governed actions but never become a privileged write authority.
- This document does not call providers, alter runtime APIs, publish packages, or deploy software.

## Account-wide catalog

See `appolon1908-hue/documentaions/REPOSITORY_CATALOG.md`.
