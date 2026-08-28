// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebhookDeliveriesView } from "../app/(protected)/webhook-deliveries/WebhookDeliveriesView.js";
import { buildWebhookDeliveryFixtures } from "@codestra/apps-shared/fixtures";
import { buildWebhookSubscriptionFixtures } from "@codestra/apps-shared/fixtures";

describe("WebhookDeliveriesView", () => {
  it("resolves each delivery's endpoint URL from the subscription list", () => {
    const subscriptions = buildWebhookSubscriptionFixtures();
    const deliveries = buildWebhookDeliveryFixtures(subscriptions.map((s) => s.id));

    render(<WebhookDeliveriesView subscriptions={subscriptions} deliveries={deliveries} />);

    expect(screen.getAllByText(subscriptions[0]!.endpointUrl).length).toBeGreaterThan(0);
    expect(screen.getAllByText("delivered").length).toBeGreaterThan(0);
    expect(screen.getAllByText("dead lettered").length).toBeGreaterThan(0);
  });

  it("shows the empty message when there are no deliveries", () => {
    render(<WebhookDeliveriesView subscriptions={[]} deliveries={[]} />);
    expect(screen.getByText(/No webhook subscriptions to correlate/)).toBeInTheDocument();
  });
});
