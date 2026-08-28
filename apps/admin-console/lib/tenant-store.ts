import {
  buildTenantFixtures,
  buildTenantUserFixtures,
  type Tenant,
  type TenantUser,
} from "@codestra/apps-shared/fixtures";
import { validateCreateTenantInput, type CreateTenantInput } from "./tenant-validation";

/**
 * A small in-memory store for the admin console's tenant/user mock domain
 * (see the note in `@codestra/apps-shared/fixtures/tenants.ts` -- there is
 * no `Tenant` type in `@codestra/contracts` yet). Seeded from the shared
 * fixtures and mutated by the "create tenant" Server Action so the page is
 * genuinely interactive in local dev, not a static mockup.
 */

let tenants: Tenant[] = buildTenantFixtures();
const usersByTenant = new Map<string, TenantUser[]>();

function usersFor(tenantId: string): TenantUser[] {
  const existing = usersByTenant.get(tenantId);
  if (existing) return existing;
  const seeded = buildTenantUserFixtures(tenantId);
  usersByTenant.set(tenantId, seeded);
  return seeded;
}

export function listTenants(): Tenant[] {
  return tenants;
}

export function getTenant(tenantId: string): Tenant | undefined {
  return tenants.find((tenant) => tenant.id === tenantId);
}

export function listTenantUsers(tenantId: string): TenantUser[] {
  return usersFor(tenantId);
}

export function createTenant(input: CreateTenantInput): Tenant {
  const validation = validateCreateTenantInput(input);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors).join(" "));
  }
  const tenant: Tenant = {
    id: `admin-console-mock-${tenants.length + 1}-${Date.now()}`,
    name: input.name.trim(),
    plan: validation.plan!,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  tenants = [tenant, ...tenants];
  return tenant;
}

/** Test-only: restores the store to its initial fixture state. */
export function resetTenantStore(): void {
  tenants = buildTenantFixtures();
  usersByTenant.clear();
}
