# Production configuration checklist

This SDK repository does not own user passwords, password reset flows, SMTP accounts, provider credentials, DNS, Kong, Keycloak, or deployed Middleware infrastructure. Those must be configured in their owning systems and verified before any production launch.

Do not commit real passwords, SMTP credentials, OAuth client secrets, webhook signing secrets, private hosts, customer data, or provider tokens to this repository.

## Required owner matrix

| Area | Owning system | SDK repo status | Production requirement |
| --- | --- | --- | --- |
| User sign-in | Identity provider, for example Keycloak/OIDC | Public OpenAPI references OIDC only | OIDC issuer, clients, redirect URIs, PKCE, token lifetimes, MFA policy, and tenant claims configured outside this repo |
| Password reset | Identity provider | Not implemented here by design | Reset email templates, token TTL, one-time-use tokens, rate limits, audit logging, and abuse protection configured in the identity provider |
| SMTP email | Identity provider or Middleware notification service | Not implemented here by design | SMTP/API mail provider credentials stored in a secret manager, SPF/DKIM/DMARC configured, bounce handling monitored, sandbox tested |
| Public API auth | Kong and Middleware | SDK sends bearer token, tenant ID, correlation ID | JWT validation, tenant binding, authorization policy, rate limits, request-size limits, and structured errors implemented by Middleware/Kong |
| Idempotency | Middleware durable store | Connector interfaces and in-memory conformance model exist | Atomic durable store with request-hash checks, lease-token transitions, TTLs, and reconciliation workers |
| Webhook subscriptions | Middleware | Public contract and SDK lifecycle methods exist | SSRF-safe destination validation, pending verification, signed test delivery, secret rotation overlap, and delivery audit tables |
| Webhook consumers | Customer app / n8n / Middleware consumers | Webhook SDK supports raw-body verification and scoped processing leases | Durable replay/processing store keyed by tenant, endpoint, signer type, and event ID |
| n8n outbound actions | n8n credential store | `CodestraApi` credential exists | Store only Codestra API base URL, tenant ID, and API token. Do not add provider credentials |
| n8n inbound trigger | n8n credential store and private ingress | `CodestraInternalWebhook` signing credential exists | Private route only, raw-body availability verified, current/previous signing secrets, replay guard endpoint/token, tenant/source/event allowlists |
| Provider adapters | Middleware process | Disabled-by-default adapters exist | Enable only explicit operations, inject service token and workload identity, use private mTLS path to product-local gateways |
| Product-local gateways | Provider/product repos | Restricted gateway OpenAPI exists | Implement gateway contract, validate service identity, tenant, operation payloads, idempotency, reconciliation, and provider webhook normalization |
| Optional Svix delivery | Optional service deployment | Disabled-by-default package/service scaffold exists | Immutable images, secret manager injection, tenant app mapping, dead-letter/reconciliation, and activation approval |
| Optional Camel gateway | Optional service deployment | Disabled-by-default service scaffold exists | Immutable image, empty-default allowlists, protocol-specific contracts, mTLS/private identity, and behavioral route tests |

## Password reset readiness

- Identity provider owns reset request, token generation, token validation, password update, and session invalidation.
- Reset tokens must be single-use, short-lived, tenant-aware, and stored hashed or otherwise non-recoverable.
- Reset requests must be rate-limited by account, IP, tenant, and device/browser signals.
- Responses must not reveal whether an email address exists.
- Successful reset must revoke active sessions and refresh tokens according to the security policy.
- Reset email links must use the production application domain over HTTPS.
- Reset events must be audit logged without storing the reset token.

## SMTP/email readiness

- Production SMTP/API mail credentials must live only in the deployment secret manager.
- DNS must include SPF, DKIM, and DMARC records for the sending domain.
- Reset, verification, and notification templates must be environment-specific and contain no test URLs.
- Delivery provider must have bounce, complaint, suppression, and rate-limit monitoring.
- Staging must use sandbox recipients or a non-delivering sink.
- Production cutover requires a successful password-reset email test using a synthetic user.

## Runtime environment variables

The exact variable names belong to the owning services, but the production deployment must provide these categories:

- OIDC issuer URL, audience, and JWKS source.
- Public API base URL and allowed CORS origins.
- Middleware database URL and idempotency/replay store configuration.
- SMTP/API mail host, port, username, password/API key, sender address, and template IDs.
- Webhook signing current and previous secrets.
- n8n outbound Codestra API token and internal webhook signing secrets.
- Provider gateway service tokens, mTLS certificate references, and workload identity names.
- Optional Svix and Camel service secrets only when those services are explicitly activated.

## Verification gates

- No committed secret scan findings.
- Password reset works for a synthetic user in staging without account enumeration.
- SMTP domain authentication passes SPF, DKIM, and DMARC checks.
- Middleware rejects missing, expired, malformed, or wrong-tenant JWTs.
- Public SDK requests cannot call provider-local gateways directly.
- n8n package contains no provider credentials and calls only Codestra Middleware.
- Internal n8n trigger rejects missing raw body, bad signature, stale timestamp, replay, wrong tenant, denied source, and denied event type.
- Webhook delivery test signs the exact bytes delivered to the consumer.
- Provider gateways reject public network access and require workload mTLS plus scoped bearer identity.
- Live email, SMS, social delivery, callbacks, and PSTN dialing remain disabled until explicit production approval.
