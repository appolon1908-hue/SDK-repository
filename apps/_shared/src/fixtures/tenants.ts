import type { UUID } from "@codestra/contracts";
import { defaultStubTenantId } from "../auth/session.js";

/**
 * `packages/contracts/src/index.ts` has no `Tenant` or `User` type -- tenant
 * provisioning and user management are not part of the current public
 * contract, only `tenantId: UUID` fields on the resources it does define.
 * These types are this app's own mock domain model, kept intentionally
 * small, so the admin console has something real to render against until
 * Middleware publishes a tenant-provisioning API.
 */
export interface Tenant {
  id: UUID;
  name: string;
  plan: "starter" | "growth" | "enterprise";
  status: "active" | "suspended";
  createdAt: string;
}

export interface TenantUser {
  id: UUID;
  tenantId: UUID;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited" | "disabled";
}

export interface TenantActivitySummary {
  tenantId: UUID;
  socialPostsLast24h: number;
  webhookDeliveriesLast24h: number;
  lastActivityAt: string;
}

function iso(minutesAgo: number): string {
  return new Date(Date.UTC(2026, 7, 28, 12, 0, 0) - minutesAgo * 60_000).toISOString();
}

export function buildTenantFixtures(): Tenant[] {
  return [
    { id: defaultStubTenantId(), name: "Northwind Creative", plan: "growth", status: "active", createdAt: iso(90000) },
    { id: "3c9d7e10-2222-4333-8444-000000000002", name: "Aster Robotics", plan: "enterprise", status: "active", createdAt: iso(200000) },
    { id: "3c9d7e10-2222-4333-8444-000000000003", name: "Loop Media", plan: "starter", status: "suspended", createdAt: iso(5000) },
  ];
}

export function buildTenantUserFixtures(tenantId: UUID): TenantUser[] {
  const base = defaultStubTenantId();
  if (tenantId === base) {
    return [
      { id: "5a1b2c30-0000-4000-8000-000000000001", tenantId, email: "priya@northwind-creative.example", role: "owner", status: "active" },
      { id: "5a1b2c30-0000-4000-8000-000000000002", tenantId, email: "devon@northwind-creative.example", role: "admin", status: "active" },
      { id: "5a1b2c30-0000-4000-8000-000000000003", tenantId, email: "sam@northwind-creative.example", role: "member", status: "invited" },
    ];
  }
  return [
    { id: "5a1b2c30-0000-4000-8000-000000000004", tenantId, email: "ops@tenant.example", role: "owner", status: "active" },
  ];
}

export function buildTenantActivityFixtures(): TenantActivitySummary[] {
  return [
    { tenantId: defaultStubTenantId(), socialPostsLast24h: 4, webhookDeliveriesLast24h: 11, lastActivityAt: iso(1) },
    { tenantId: "3c9d7e10-2222-4333-8444-000000000002", socialPostsLast24h: 21, webhookDeliveriesLast24h: 58, lastActivityAt: iso(6) },
    { tenantId: "3c9d7e10-2222-4333-8444-000000000003", socialPostsLast24h: 0, webhookDeliveriesLast24h: 0, lastActivityAt: iso(50000) },
  ];
}
