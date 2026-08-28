import { describe, expect, it, vi } from "vitest";
import { Codestra } from "../src/nodes/Codestra/Codestra.node.js";

const credentials = { baseUrl: "https://api.codestra.co" };

describe("Codestra action node", () => {
  it("builds a tenant-scoped social post list request through Middleware", async () => {
    const requestMock = vi.fn().mockResolvedValue({ items: [] });
    const context = executionContext({
      operation: "listSocialPosts",
      workspaceId: "204ddc3a-3a33-445f-bfc5-0bb15167b624",
      socialPostStatus: "accepted",
      limit: 25,
    }, requestMock);

    await new Codestra().execute.call(context);

    expect(requestMock).toHaveBeenCalledWith("codestraApi", expect.objectContaining({
      method: "GET",
      url: "https://api.codestra.co/v1/social/posts?workspaceId=204ddc3a-3a33-445f-bfc5-0bb15167b624&status=accepted&limit=25",
      headers: expect.objectContaining({
        "x-correlation-id": "correlation-0001",
      }),
    }));
  });

  it("builds an idempotent social post cancellation request through Middleware", async () => {
    const requestMock = vi.fn().mockResolvedValue({ status: "cancelled" });
    const context = executionContext({
      operation: "cancelSocialPost",
      postId: "d0313dba-09f7-4cce-8894-195f72c62126",
      idempotencyKey: "idempotency-key-0001",
    }, requestMock);

    await new Codestra().execute.call(context);

    expect(requestMock).toHaveBeenCalledWith("codestraApi", expect.objectContaining({
      method: "POST",
      url: "https://api.codestra.co/v1/social/posts/d0313dba-09f7-4cce-8894-195f72c62126/cancel",
      headers: expect.objectContaining({
        "idempotency-key": "idempotency-key-0001",
        "x-correlation-id": "correlation-0001",
      }),
    }));
  });
});

function executionContext(
  parameters: Record<string, unknown>,
  requestMock: ReturnType<typeof vi.fn>,
): ThisParameterType<Codestra["execute"]> {
  const merged = {
    correlationId: "correlation-0001",
    ...parameters,
  };
  return {
    getInputData: () => [{ json: {} }],
    getCredentials: async () => credentials,
    getNodeParameter: (name: string, _itemIndex: number, fallback?: unknown) => merged[name] ?? fallback,
    helpers: {
      httpRequestWithAuthentication: requestMock,
    },
  } as unknown as ThisParameterType<Codestra["execute"]>;
}
