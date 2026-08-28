# Optional Apache Camel protocol gateway

This directory is a **disabled, fail-closed foundation** for protocol-heavy integrations that cannot be expressed safely through the normal HTTP connector packages.

It does not include SMTP, SMPP, JMS, Kafka, AMQP, telephony, or database connector dependencies. It therefore cannot transmit production traffic in this release.

## Authority model

```text
approved Codestra Middleware command
        -> private authenticated ingress (future stage)
        -> protocol and operation allowlists
        -> direct:protocol-command policy boundary
        -> protocol-specific route (future stage)
```

Middleware remains responsible for service authorization, tenant isolation, idempotency, inbox/outbox state, retries, reconciliation, audit, and business policy. Camel may translate and transport an already-approved command; it must not become a second orchestration or business-rule authority.

## Safety defaults

- `CODESTRA_CAMEL_ENABLED` must equal exactly `true` or the JVM exits.
- Empty protocol and operation allowlists deny every command.
- No host port is published by Compose.
- The container joins only the externally managed private Codestra network.
- The image runs read-only, without Linux capabilities, as an unprivileged user.
- No provider credentials belong in Git, image layers, Compose files, or environment examples.
- Installation, image publication, and deployment do not constitute permission to enable live traffic.

## Adding a protocol

A protocol-specific pull request must add all of the following before the protocol can be enabled:

1. A narrowly scoped Camel component dependency.
2. A typed command and response contract.
3. Header filtering and payload-size limits.
4. Runtime secrets loaded from the approved secret manager.
5. Tenant and provider-account mapping owned by Middleware.
6. Idempotency and reconciliation tests against a disposable provider fixture.
7. Failure, timeout, duplicate-delivery, replay, and rollback tests.
8. An explicit capability name and disabled-by-default configuration.
9. Network-policy evidence proving that only Middleware can reach the command ingress.
10. Security-owner approval for the exact immutable image digest.

## Local verification

```bash
mvn --batch-mode --no-transfer-progress verify
```

For an image build, provide immutable base-image references:

```bash
docker build \
  --build-arg MAVEN_IMAGE='maven:3.9.11-eclipse-temurin-21@sha256:...' \
  --build-arg RUNTIME_IMAGE='eclipse-temurin:21-jre@sha256:...' \
  -t codestra-camel-protocol-gateway:test \
  services/camel-protocol-gateway
```
