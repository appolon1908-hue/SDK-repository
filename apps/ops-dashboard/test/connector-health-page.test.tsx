// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ConnectorHealthPage from "../app/(protected)/connector-health/page.js";

describe("ConnectorHealthPage", () => {
  it("renders every connector's health status and the derived command outcomes", () => {
    render(ConnectorHealthPage());

    expect(screen.getByRole("heading", { level: 1, name: "Connector command health" })).toBeInTheDocument();

    // Six connectors from the SocialChannel enum, each with a health row.
    for (const connector of ["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"]) {
      expect(screen.getAllByText(connector).length).toBeGreaterThan(0);
    }

    // The derived operator-facing outcome buckets from connector-kit's states.
    for (const outcome of ["pending", "dispatched", "succeeded", "failed", "indeterminate"]) {
      expect(screen.getAllByText(outcome).length).toBeGreaterThan(0);
    }

    expect(screen.getByRole("heading", { level: 2, name: "Recent connector commands" })).toBeInTheDocument();
  });
});
