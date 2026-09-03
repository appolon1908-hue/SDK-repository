import type { CodestraInternalWebhookConfig, InternalCredentialData } from "./internal-event-model.js";
import { InternalEventBoundaryError } from "./internal-event-model.js";
import {
  integerBetween,
  parseLines,
  requireCredentialString,
  requireSecret,
  requireUuid,
  validateInternalBaseUrl,
  validateWebhookSecret,
} from "./internal-event-primitives.js";

export function parseInternalWebhookConfig(credentials: InternalCredentialData): CodestraInternalWebhookConfig {
  const webhookSecrets = parseLines(credentials.webhookSecrets, "webhookSecrets");
  if (webhookSecrets.length === 0) {
    throw new InternalEventBoundaryError("At least one webhook signing secret is required.", "WEBHOOK_SECRETS_REQUIRED", { status: 500 });
  }
  for (const secret of webhookSecrets) validateWebhookSecret(secret);

  const allowedEventTypes = new Set(parseLines(credentials.allowedEventTypes, "allowedEventTypes"));
  const allowedSourcePrefixes = parseLines(credentials.allowedSourcePrefixes, "allowedSourcePrefixes");
  if (allowedEventTypes.size === 0 || allowedSourcePrefixes.length === 0) {
    throw new InternalEventBoundaryError("Event type and source allowlists must not be empty.", "EVENT_ALLOWLIST_REQUIRED", { status: 500 });
  }

  return {
    expectedTenantId: requireUuid(requireCredentialString(credentials.expectedTenantId, "expectedTenantId"), "expectedTenantId"),
    webhookSecrets,
    allowedEventTypes,
    allowedSourcePrefixes,
    replayGuardBaseUrl: validateInternalBaseUrl(requireCredentialString(credentials.replayGuardBaseUrl, "replayGuardBaseUrl")),
    replayGuardAccessToken: requireSecret(requireCredentialString(credentials.replayGuardAccessToken, "replayGuardAccessToken"), "replayGuardAccessToken"),
    timestampToleranceSeconds: integerBetween(credentials.timestampToleranceSeconds ?? 300, 0, 86_400, "timestampToleranceSeconds"),
    maxBodyBytes: integerBetween(credentials.maxBodyBytes ?? 1_048_576, 1, 5_242_880, "maxBodyBytes"),
    requestTimeoutMs: integerBetween(credentials.requestTimeoutMs ?? 5_000, 100, 30_000, "requestTimeoutMs"),
  };
}
