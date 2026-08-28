# Security policy

Do not open public issues containing credentials, tokens, customer data, provider secrets, private network details, or exploitable vulnerabilities.

Report vulnerabilities through the repository's private GitHub Security Advisory flow. Include the affected package and version, reproduction steps, impact, and a proposed mitigation when available.

## Non-negotiable controls

- Browser SDKs use Authorization Code with PKCE and never embed client secrets.
- Service connectors use short-lived service credentials supplied at runtime.
- Every mutation carries tenant, correlation, and idempotency context.
- Raw webhook bytes are verified before parsing.
- Provider credentials and production mappings never belong in this repository.
- Optional delivery and protocol services remain disabled by default.
