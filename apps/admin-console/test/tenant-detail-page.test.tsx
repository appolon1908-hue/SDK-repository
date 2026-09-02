// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TenantDetailPage from "../app/(protected)/tenants/[tenantId]/page.js";
import { listTenants, resetTenantStore } from "../lib/tenant-store.js";

describe("TenantDetailPage", () => {
  beforeEach(() => {
    resetTenantStore();
  });

  it("renders the tenant, its users, and read-only external-config panels", async () => {
    const tenant = listTenants()[0]!;
    render(await TenantDetailPage({ params: Promise.resolve({ tenantId: tenant.id }) }));

    expect(screen.getByRole("heading", { level: 1, name: tenant.name })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Identity provider" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SMTP / email" })).toBeInTheDocument();
    expect(screen.getAllByText(/Configured externally/).length).toBe(2);

    // Per docs/PRODUCTION_CONFIGURATION_CHECKLIST.md: identity and SMTP must
    // be read-only displays here, never editable forms -- this page has no
    // input, textarea, select, or button anywhere on it at all.
    expect(document.querySelector("input, textarea, select, button")).toBeNull();
  });
});
