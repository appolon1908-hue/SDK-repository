// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TenantsPage from "../app/(protected)/tenants/page.js";
import { resetTenantStore } from "../lib/tenant-store.js";

describe("TenantsPage", () => {
  beforeEach(() => {
    resetTenantStore();
  });

  it("lists the seeded tenants and renders the create-tenant form", () => {
    render(TenantsPage());

    expect(screen.getByText("Northwind Creative")).toBeInTheDocument();
    expect(screen.getByText("Aster Robotics")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create tenant" })).toBeInTheDocument();
  });
});
