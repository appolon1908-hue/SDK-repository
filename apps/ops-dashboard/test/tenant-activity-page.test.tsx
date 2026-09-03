// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TenantActivityPage from "../app/(protected)/tenants/page.js";

describe("TenantActivityPage", () => {
  it("renders each tenant with its activity summary", () => {
    render(TenantActivityPage());

    expect(screen.getByText("Northwind Creative")).toBeInTheDocument();
    expect(screen.getByText("Aster Robotics")).toBeInTheDocument();
    expect(screen.getByText("Loop Media")).toBeInTheDocument();
    expect(screen.getByText("suspended")).toBeInTheDocument();
  });
});
