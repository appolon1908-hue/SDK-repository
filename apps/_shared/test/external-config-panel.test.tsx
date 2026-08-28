// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExternalConfigPanel } from "../src/ui/ExternalConfigPanel.js";

describe("ExternalConfigPanel", () => {
  it("renders fields as read-only text, never as editable form controls", () => {
    render(
      <ExternalConfigPanel
        title="Identity provider"
        ownedBy="Keycloak / OIDC"
        fields={[
          { label: "Issuer", value: "https://auth.codestra.co/realms/codestra" },
          { label: "MFA policy", value: "Required for admin and owner roles" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Identity provider" })).toBeInTheDocument();
    expect(screen.getByText("https://auth.codestra.co/realms/codestra")).toBeInTheDocument();
    expect(screen.getByText(/Configured externally/)).toBeInTheDocument();
    expect(screen.getByText(/owned by Keycloak \/ OIDC/)).toBeInTheDocument();

    // The production-configuration checklist requires these panels to never
    // be editable: no input, textarea, select, or button anywhere in it.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(document.querySelector("input, textarea, select, button")).toBeNull();
  });
});
