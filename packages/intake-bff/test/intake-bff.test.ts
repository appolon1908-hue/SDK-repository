import { describe, expect, it, vi } from "vitest";
import { createIntakeBff } from "../src/index.js";

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/codestra/intake", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": "tenant-a",
      "X-Correlation-ID": "corr-1",
      "Idempotency-Key": "idem-1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function tokenResponse(token = "token-1234567890") {
  return new Response(JSON.stringify({ access_token: token, expires_in: 300, token_type: "Bearer" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("@codestra/intake-bff", () => {
  it("rejects tenant mismatch before requesting a service token", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const bff = createIntakeBff({ clientSecret: "secret", fetchImpl });
    const response = await bff.handle(request({ tenantId: "tenant-b" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "tenant_mismatch" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("enforces an explicit tenant allowlist", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const bff = createIntakeBff({ clientSecret: "secret", allowedTenantIds: ["tenant-b"], fetchImpl });
    const response = await bff.handle(request({ tenantId: "tenant-a" }));
    expect(response.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("obtains a client-credentials token and forwards the canonical headers", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        event_id: "event-1",
        correlation_id: "corr-1",
        duplicate: false,
        status: "accepted",
      }), { status: 202, headers: { "Content-Type": "application/json" } }));

    const bff = createIntakeBff({ clientSecret: "secret", fetchImpl });
    const response = await bff.handle(request({ tenantId: "tenant-a", siteId: "site-1", source: "form" }));

    expect(response.status).toBe(202);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenInit] = fetchImpl.mock.calls[0];
    expect(String(tokenUrl)).toContain("/protocol/openid-connect/token");
    expect(String(tokenInit?.body)).toContain("grant_type=client_credentials");
    expect(String(tokenInit?.body)).toContain("client_id=sdk-intake");
    expect(String(tokenInit?.body)).toContain("scope=leads.write");

    const [intakeUrl, intakeInit] = fetchImpl.mock.calls[1];
    expect(intakeUrl).toBe("https://api.codestra.co/v1/intake/leads");
    const forwarded = new Headers(intakeInit?.headers);
    expect(forwarded.get("Authorization")).toBe("Bearer token-1234567890");
    expect(forwarded.get("X-Tenant-ID")).toBe("tenant-a");
    expect(forwarded.get("X-Correlation-ID")).toBe("corr-1");
    expect(forwarded.get("Idempotency-Key")).toBe("idem-1");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reuses a cached token across requests", async () => {
    const accepted = () => new Response("{}", { status: 202, headers: { "Content-Type": "application/json" } });
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(accepted())
      .mockResolvedValueOnce(accepted());
    const bff = createIntakeBff({ clientSecret: "secret", fetchImpl, now: () => 1_000 });

    await bff.handle(request({ tenantId: "tenant-a" }));
    await bff.handle(request({ tenantId: "tenant-a" }, { "X-Correlation-ID": "corr-2", "Idempotency-Key": "idem-2" }));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("preserves idempotency and correlation headers on a retry", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 202 }));
    const bff = createIntakeBff({ clientSecret: "secret", fetchImpl, maxAttempts: 2 });

    const response = await bff.handle(request({ tenantId: "tenant-a" }));
    expect(response.status).toBe(202);
    const first = new Headers(fetchImpl.mock.calls[1][1]?.headers);
    const second = new Headers(fetchImpl.mock.calls[2][1]?.headers);
    expect(second.get("Idempotency-Key")).toBe(first.get("Idempotency-Key"));
    expect(second.get("X-Correlation-ID")).toBe(first.get("X-Correlation-ID"));
  });

  it("refreshes the service token once after a 401", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse("token-old-123456"))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(tokenResponse("token-new-123456"))
      .mockResolvedValueOnce(new Response("{}", { status: 202 }));
    const bff = createIntakeBff({ clientSecret: "secret", fetchImpl, maxAttempts: 2 });

    const response = await bff.handle(request({ tenantId: "tenant-a" }));
    expect(response.status).toBe(202);
    expect(new Headers(fetchImpl.mock.calls[3][1]?.headers).get("Authorization")).toBe("Bearer token-new-123456");
  });

  it("rejects oversized payloads without contacting upstreams", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const bff = createIntakeBff({ clientSecret: "secret", fetchImpl, maxBodyBytes: 8 });
    const response = await bff.handle(request({ tenantId: "tenant-a", message: "too large" }));
    expect(response.status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
