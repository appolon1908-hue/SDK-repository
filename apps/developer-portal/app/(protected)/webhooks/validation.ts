export interface CreateSubscriptionFormInput {
  endpointUrl: string;
  eventTypes: string[];
  description?: string;
}

export interface CreateSubscriptionValidation {
  valid: boolean;
  errors: Partial<Record<"endpointUrl" | "eventTypes", string>>;
}

/**
 * Mirrors the constraints `CreateWebhookSubscriptionRequest` declares in
 * `contracts/openapi/codestra-public.openapi.yaml`: `endpointUrl` must
 * match `^https://`, and `eventTypes` must have at least one entry.
 */
export function validateCreateSubscriptionInput(input: CreateSubscriptionFormInput): CreateSubscriptionValidation {
  const errors: CreateSubscriptionValidation["errors"] = {};
  const endpointUrl = input.endpointUrl.trim();

  if (!endpointUrl) {
    errors.endpointUrl = "Endpoint URL is required.";
  } else if (!endpointUrl.startsWith("https://")) {
    errors.endpointUrl = "Endpoint URL must start with https:// -- Codestra's destination policy blocks non-HTTPS endpoints.";
  }

  if (input.eventTypes.length === 0) {
    errors.eventTypes = "Select at least one event type.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
