import { beforeEach, describe, expect, it } from "vitest";
import { createTenant, getTenant, listTenants, listTenantUsers, resetTenantStore } from "../lib/tenant-store.js";

describe("tenant-store", () => {
  beforeEach(() => {
    resetTenantStore();
  });

  it("seeds from the shared fixtures", () => {
    expect(listTenants().length).toBeGreaterThan(0);
  });

  it("creates a tenant and prepends it to the list", () => {
    const before = listTenants().length;
    const created = createTenant({ name: "Acme Rockets", plan: "enterprise" });
    expect(created.status).toBe("active");
    expect(listTenants().length).toBe(before + 1);
    expect(getTenant(created.id)?.name).toBe("Acme Rockets");
  });

  it("rejects an invalid plan", () => {
    expect(() => createTenant({ name: "Acme", plan: "not-a-real-plan" })).toThrow();
  });

  it("returns a per-tenant user list", () => {
    const tenant = listTenants()[0]!;
    const users = listTenantUsers(tenant.id);
    expect(users.every((user) => user.tenantId === tenant.id)).toBe(true);
  });
});
