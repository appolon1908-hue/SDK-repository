import type { Tenant } from "@codestra/apps-shared/fixtures";

export interface CreateTenantInput {
  name: string;
  plan: string;
}

export interface CreateTenantValidation {
  valid: boolean;
  errors: { name?: string; plan?: string };
  plan?: Tenant["plan"];
}

const VALID_PLANS: readonly Tenant["plan"][] = ["starter", "growth", "enterprise"];

export function validateCreateTenantInput(input: CreateTenantInput): CreateTenantValidation {
  const errors: CreateTenantValidation["errors"] = {};
  const name = input.name.trim();
  if (!name) errors.name = "Tenant name is required.";

  const plan = VALID_PLANS.find((candidate) => candidate === input.plan);
  if (!plan) errors.plan = `Plan must be one of: ${VALID_PLANS.join(", ")}.`;

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, errors: {}, plan };
}
