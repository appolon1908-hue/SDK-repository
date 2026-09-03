// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventCatalogueView } from "../app/docs/events/EventCatalogueView.js";

describe("EventCatalogueView", () => {
  it("renders each channel's address, message title, and field table", () => {
    render(
      <EventCatalogueView
        channels={[
          {
            key: "socialPostStatus",
            address: "codestra.social.post.status.v1",
            messages: [
              {
                name: "SocialPostStatusChanged",
                title: "Social post status changed",
                cloudEventType: "codestra.social.post.status.v1",
                fields: [
                  { name: "postId", type: "string (uuid)", required: true },
                  { name: "status", type: "string", required: true, enumValues: ["accepted", "published"] },
                ],
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("codestra.social.post.status.v1")).toBeInTheDocument();
    expect(screen.getByText("Social post status changed", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("postId")).toBeInTheDocument();
    expect(screen.getByText("accepted | published")).toBeInTheDocument();
  });
});
