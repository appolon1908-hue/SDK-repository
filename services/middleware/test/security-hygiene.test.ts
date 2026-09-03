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

  it("does not let a spoofed X-Forwarded-For reset the limit when no proxy is trusted (Codex finding on PR #46)", async () => {
    // With no TRUSTED_PROXY_CIDRS configured (the default), trustProxy is
    // false: request.ip always falls back to the real connection address,
    // never a client-supplied header. A caller rotating X-Forwarded-For on
    // every request must not get a fresh bucket each time.
    ctx = await createTestContext({ rateLimitMax: 3 });

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await ctx.app.inject({
        method: "GET",
        url: "/health/ready",
        headers: { "x-forwarded-for": `10.0.0.${i}` },
      });
      statuses.push(response.statusCode);
    }

    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });

  it("honors X-Forwarded-For, with separate buckets per client, once a proxy is explicitly trusted (Codex finding on PR #47)", async () => {
    // A first fix for the above (keying on the raw socket address
    // unconditionally) closed the spoofing gap but broke real multi-tenant
    // traffic: every tenant behind the same real proxy would then share
    // one bucket, so one busy or malicious tenant could get every other
    // tenant rate-limited. The real fix is for trustProxy itself to only
    // honor X-Forwarded-For from an explicitly configured proxy address --
    // app.inject()'s simulated connection is 127.0.0.1, so trusting that
    // address here stands in for trusting Kong's real one in production.
    ctx = await createTestContext({ rateLimitMax: 3, trustedProxyCidrs: "127.0.0.1" });

    const statusesFor = async (clientIp: string): Promise<number[]> => {
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const response = await ctx!.app.inject({
          method: "GET",
          url: "/health/ready",
          headers: { "x-forwarded-for": clientIp },
        });
        statuses.push(response.statusCode);
      }
      return statuses;
    };

    // Two distinct forwarded client IPs behind the one trusted proxy each
    // get their own independent bucket, not one shared between them.
    expect(await statusesFor("10.0.0.1")).toEqual([200, 200, 200, 429]);
    expect(await statusesFor("10.0.0.2")).toEqual([200, 200, 200, 429]);
  });
});
