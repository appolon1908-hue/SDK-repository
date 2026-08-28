// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WebhookSubscription, WebhookSubscriptionCreated } from "@codestra/contracts";
import { WebhookSubscriptionsManager } from "../app/(protected)/webhooks/WebhookSubscriptionsManager.js";

const EXISTING: WebhookSubscription = {
  id: "6f0a2b3c-1111-4222-8333-000000000001",
  endpointUrl: "https://existing.example.test/hooks",
  eventTypes: ["codestra.social.post.status.v1"],
  status: "active",
  verification: { status: "verified" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("WebhookSubscriptionsManager", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // vitest.config.mjs runs with globals:false, so testing-library's
    // automatic afterEach(cleanup) never registers itself -- without this,
    // each test's render stays mounted and later queries in this file match
    // duplicate elements left over from earlier tests.
    cleanup();
  });

  it("renders the initial subscription list", () => {
    render(
      <WebhookSubscriptionsManager
        initialSubscriptions={[EXISTING]}
        eventTypeOptions={["codestra.social.post.status.v1", "codestra.webhook.delivery.status.v1"]}
      />,
    );
    expect(screen.getByText(EXISTING.endpointUrl)).toBeInTheDocument();
  });

  it("shows a validation error instead of submitting when the endpoint is not https", async () => {
    const user = userEvent.setup();
    render(<WebhookSubscriptionsManager initialSubscriptions={[]} eventTypeOptions={["codestra.social.post.status.v1"]} />);

    await user.type(screen.getByLabelText("Endpoint URL"), "http://insecure.example.test/hooks");
    await user.click(screen.getByLabelText("codestra.social.post.status.v1"));
    await user.click(screen.getByRole("button", { name: "Create subscription" }));

    expect(await screen.findByText(/https:\/\//)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a subscription and reveals the one-time signing secret", async () => {
    const created: WebhookSubscriptionCreated = {
      subscription: {
        id: "6f0a2b3c-1111-4222-8333-000000000099",
        endpointUrl: "https://new.example.test/hooks",
        eventTypes: ["codestra.social.post.status.v1"],
        status: "pending_verification",
        verification: { status: "pending" },
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      signingSecret: "whsec_test_abcdefghijklmnopqrstuvwx",
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(created), { status: 201 }));

    const user = userEvent.setup();
    render(<WebhookSubscriptionsManager initialSubscriptions={[]} eventTypeOptions={["codestra.social.post.status.v1"]} />);

    await user.type(screen.getByLabelText("Endpoint URL"), "https://new.example.test/hooks");
    await user.click(screen.getByLabelText("codestra.social.post.status.v1"));
    await user.click(screen.getByRole("button", { name: "Create subscription" }));

    expect(await screen.findByText(created.signingSecret)).toBeInTheDocument();
    expect(screen.getByText(created.subscription.endpointUrl)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/webhook-subscriptions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("disables an active subscription through the row action", async () => {
    const disabled: WebhookSubscription = { ...EXISTING, status: "disabled", disabledAt: "2026-03-01T00:00:00.000Z" };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(disabled), { status: 200 }));

    const user = userEvent.setup();
    render(<WebhookSubscriptionsManager initialSubscriptions={[EXISTING]} eventTypeOptions={[]} />);

    const row = screen.getByText(EXISTING.endpointUrl).closest("tr");
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Disable" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/webhook-subscriptions/${EXISTING.id}/disable`, { method: "POST" });
    });
    expect(await within(row as HTMLElement).findByText("disabled")).toBeInTheDocument();
  });
});
