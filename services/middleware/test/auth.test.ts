import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SignJWT, generateKeyPair } from "jose";
import { createTestContext, type TestContext } from "./support/app.js";

/**
 * Exercises real end-to-end JWT verification (a real RS256 keypair, a real
 * local JWKS HTTP endpoint, real `jose` verification) rather than mocking
 * the auth layer — proving Middleware rejects missing, malformed, expired,
 * and wrong-audience/issuer tokens, and a token missing a valid tenant
 * claim, with the exact error shape from
 * contracts/schemas/common/error.schema.json.
 */
let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

function assertsErrorShape(body: unknown): asserts body is { error: { code: string; message: string; requestId: string; retryable: boolean } } {
  const parsed = body as { error?: { code?: unknown; message?: unknown; requestId?: unknown; retryable?: unknown } };
  expect(parsed.error).toBeDefined();
  expect(typeof parsed.error?.code).toBe("string");
  expect(typeof parsed.error?.message).toBe("string");
  expect(typeof parsed.error?.requestId).toBe("string");
  expect(typeof parsed.error?.retryable).toBe("boolean");
}

describe("JWT authentication", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await ctx.app.inject({ method: "GET", url: "/v1/social/posts" });
    expect(response.statusCode).toBe(401);
    assertsErrorShape(response.json());
  });

  it("rejects a malformed Authorization header", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/social/posts",
      headers: { authorization: "NotBearer abc.def.ghi" },
    });
    expect(response.statusCode).toBe(401);
    assertsErrorShape(response.json());
  });

  it("rejects a syntactically invalid token", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/social/posts",
      headers: { authorization: "Bearer not-a-jwt" },
    });
    expect(response.statusCode).toBe(401);
    assertsErrorShape(response.json());
  });

  it("rejects an expired token", async () => {
    const tenantId = randomUUID();
    const token = await ctx.jwks.issueToken({ tenantId, expiresInSeconds: -60 });
    const response = await ctx.app.inject({ method: "GET", url: "/v1/social/posts", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(401);
    assertsErrorShape(response.json());
  });

  it("rejects a token with the wrong audience", async () => {
    const tenantId = randomUUID();
    const token = await ctx.jwks.issueToken({ tenantId, audience: "some-other-service" });
    const response = await ctx.app.inject({ method: "GET", url: "/v1/social/posts", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(401);
    assertsErrorShape(response.json());
  });

  it("rejects a token with the wrong issuer", async () => {
    const tenantId = randomUUID();
    const token = await ctx.jwks.issueToken({ tenantId, issuer: "https://not-codestra.invalid" });
    const response = await ctx.app.inject({ method: "GET", url: "/v1/social/posts", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(401);
    assertsErrorShape(response.json());
  });

  it("rejects a token signed by a key not present in the JWKS (forged signature)", async () => {
    const { privateKey } = await generateKeyPair("RS256");
    const now = Math.floor(Date.now() / 1000);
    const forged = await new SignJWT({ tenant_id: randomUUID() })
      .setProtectedHeader({ alg: "RS256", kid: "not-a-real-kid" })
      .setIssuedAt(now)
      .setIssuer(ctx.jwks.issuer)
      .setAudience(ctx.jwks.audience)
      .setExpirationTime(now + 3600)
      .sign(privateKey);
    const response = await ctx.app.inject({ method: "GET", url: "/v1/social/posts", headers: { authorization: `Bearer ${forged}` } });
    expect(response.statusCode).toBe(401);
    assertsErrorShape(response.json());
  });

  it("rejects a token missing a valid tenant claim", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await (async () => {
      // Reuse the real signing key but omit tenant_id entirely.
      const raw = await ctx.jwks.issueToken({ tenantId: "not-a-uuid" });
      return raw;
    })();
    const response = await ctx.app.inject({ method: "GET", url: "/v1/social/posts", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(401);
    assertsErrorShape(response.json());
    void now;
  });

  it("accepts a well-formed, correctly signed token and scopes the request to its tenant", async () => {
    const tenantId = await ctx.createTenant();
    const header = await ctx.authHeader(tenantId);
    const response = await ctx.app.inject({ method: "GET", url: "/v1/social/posts", headers: { authorization: header } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ items: [] });
  });

  it("rejects a request whose X-Codestra-Tenant-Id header does not match the verified tenant claim", async () => {
    const tenantId = await ctx.createTenant();
    const otherTenantId = randomUUID();
    const header = await ctx.authHeader(tenantId);
    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/social/posts",
      headers: { authorization: header, "x-codestra-tenant-id": otherTenantId },
    });
    expect(response.statusCode).toBe(403);
    assertsErrorShape(response.json());
    expect(response.json().error.code).toBe("TENANT_MISMATCH");
  });
});
