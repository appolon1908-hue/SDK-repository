import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./support/app.js";

/**
 * Real coverage for the defense-in-depth headers and rate limiting wired
 * in server.ts. This exists because the initial wiring looked correct but
 * silently did nothing: `void app.register(rateLimit, {...})` (not
 * awaited) queues the plugin, yet its hook is not reliably attached by the
 * time the server starts accepting requests -- verified directly against a
 * real running server, where every burst request kept returning 200 with
 * no x-ratelimit-* headers at all and no error. A test that only checked
 * "the plugin is registered" or "the code typechecks" would never have
 * caught this; only firing real requests at a real server does.
 */

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

describe("security hygiene", () => {
  it("sets real defense-in-depth headers on every response", async () => {
    ctx = await createTestContext();
    const response = await ctx.app.inject({ method: "GET", url: "/health/ready" });

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["strict-transport-security"]).toBeDefined();
  });

  it("returns a real 429 with the standard error envelope once the per-IP limit is exceeded", async () => {
    ctx = await createTestContext({ rateLimitMax: 3 });

    const responses = [];
    for (let i = 0; i < 5; i++) {
      responses.push(await ctx.app.inject({ method: "GET", url: "/health/ready" }));
    }

    const statuses = responses.map((response) => response.statusCode);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);

    const limited = responses[3];
    if (!limited) throw new Error("expected a fourth response");
    expect(limited.headers["x-ratelimit-limit"]).toBe("3");
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(limited.json()).toMatchObject({
      error: { code: "RATE_LIMITED", retryable: true },
    });
  });

  it("still sets the security headers on a rate-limited response", async () => {
    ctx = await createTestContext({ rateLimitMax: 1 });
    await ctx.app.inject({ method: "GET", url: "/health/ready" });
    const limited = await ctx.app.inject({ method: "GET", url: "/health/ready" });

    expect(limited.statusCode).toBe(429);
    expect(limited.headers["x-content-type-options"]).toBe("nosniff");
  });
});
