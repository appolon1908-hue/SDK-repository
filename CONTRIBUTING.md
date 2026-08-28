# Contributing

This repository uses a contract-first, stacked-branch release model. A package change must include tests, a Changeset when it changes a published API, and corresponding OpenAPI, AsyncAPI, or JSON Schema updates when applicable.

## Local checks

```bash
corepack enable
pnpm install
pnpm ci
```

Never commit real credentials, tenant identifiers, provider tokens, private certificates, production URLs containing secrets, or customer payloads. Test fixtures must be synthetic.

Breaking contract changes require a new major version and an explicit migration document. Removing a path, operation, response, event, required field, or enum value without that process is prohibited.
