import { describe, expect, it, vi } from "vitest";
import { CodestraClient, CodestraConfigurationError } from "../src/index.js";

const post = {
  id: "d0313dba-09f7-4cce-8894-195f72c62126",
  tenantId: "042880db-aa51-4f16-83b5-ae858ee45ad6",
  workspaceId: "204ddc3a-3a33-445f-bfc5-0bb15167b624",
  status: "accepted",
  channels: [{ channel: "linkedin", status: "accepted" }],
  content: { text: "Hello" },
  createdAt: "2026-08-27T00:00:00Z",
  updatedAt: "2026-08-27T00:00:00Z",
} as const;

describe("CodestraClient", () => {
  it("adds tenant, correlation, authorization and idempotency headers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(post), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new CodestraClient({
      baseUrl: "https://api.codestra.co",
      tenantId: post.tenantId,
      getAccessToken: () => "test-token",
      fetch: fetchMock,
      correlationIdFactory: () => "correlation-0001",
    });

    await client.social.posts.create(
      {
        workspaceId: post.workspaceId,
        channels: ["linkedin"],
        content: { text: "Hello" },
      },
      { idempotencyKey: "idempotency-key-0001" },
    );

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("x-codestra-tenant-id")).toBe(post.tenantId);
    expect(headers.get("x-correlation-id")).toBe("correlation-0001");
    expect(headers.get("idempotency-key")).toBe("idempotency-key-0001");
    expect(init?.cache).toBe("no-store");
  });

  it("rejects insecure non-loopback base URLs", () => {
    expect(
      () =>
        new CodestraClient({
          baseUrl: "http://api.codestra.co",
          tenantId: post.tenantId,
          getAccessToken: () => "test-token",
        }),
    ).toThrow(CodestraConfigurationError);
  });
});
