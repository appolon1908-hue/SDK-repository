import { describe, expect, it } from "vitest";
import { assertSafeWebhookDestination } from "../src/webhooks/ssrf.js";

describe("assertSafeWebhookDestination", () => {
  it("accepts an https destination that resolves publicly", async () => {
    const result = await assertSafeWebhookDestination("https://example.com/webhooks/codestra");
    expect(result.hostname).toBe("example.com");
    expect(result.addresses.length).toBeGreaterThan(0);
  });

  it("rejects http (non-TLS) destinations", async () => {
    await expect(assertSafeWebhookDestination("http://example.com/webhooks")).rejects.toMatchObject({
      code: "INVALID_WEBHOOK_DESTINATION",
    });
  });

  it("rejects destinations that embed credentials", async () => {
    await expect(assertSafeWebhookDestination("https://user:pass@example.com/webhooks")).rejects.toMatchObject({
      code: "INVALID_WEBHOOK_DESTINATION",
    });
  });

  it("rejects malformed URLs", async () => {
    await expect(assertSafeWebhookDestination("not a url")).rejects.toMatchObject({ code: "INVALID_WEBHOOK_DESTINATION" });
  });

  it.each([
    ["loopback", "https://127.0.0.1/webhooks"],
    ["loopback range", "https://127.5.6.7/webhooks"],
    ["rfc1918 10/8", "https://10.0.0.5/webhooks"],
    ["rfc1918 172.16/12", "https://172.16.0.5/webhooks"],
    ["rfc1918 192.168/16", "https://192.168.1.5/webhooks"],
    ["link-local", "https://169.254.169.254/webhooks"],
    ["cgnat", "https://100.64.0.5/webhooks"],
    ["this-network", "https://0.0.0.0/webhooks"],
    ["test-net-1", "https://192.0.2.10/webhooks"],
    ["test-net-2", "https://198.51.100.10/webhooks"],
    ["test-net-3", "https://203.0.113.10/webhooks"],
    ["multicast", "https://224.0.0.1/webhooks"],
    ["broadcast", "https://255.255.255.255/webhooks"],
  ])("rejects private/reserved IPv4 destination: %s", async (_label, url) => {
    await expect(assertSafeWebhookDestination(url)).rejects.toMatchObject({ code: "PRIVATE_WEBHOOK_DESTINATION" });
  });

  it.each([
    ["loopback", "https://[::1]/webhooks"],
    ["link-local", "https://[fe80::1]/webhooks"],
    ["unique-local", "https://[fc00::1]/webhooks"],
    ["unique-local fd", "https://[fd12:3456:789a::1]/webhooks"],
    ["ipv4-mapped private", "https://[::ffff:10.0.0.5]/webhooks"],
    ["documentation range", "https://[2001:db8::1]/webhooks"],
  ])("rejects private/reserved IPv6 destination: %s", async (_label, url) => {
    await expect(assertSafeWebhookDestination(url)).rejects.toMatchObject({ code: "PRIVATE_WEBHOOK_DESTINATION" });
  });

  it.each([
    "https://localhost/webhooks",
    "https://LOCALHOST/webhooks",
    "https://service.local/webhooks",
    "https://foo.localhost/webhooks",
  ])("rejects loopback/local-network hostnames: %s", async (url) => {
    await expect(assertSafeWebhookDestination(url)).rejects.toMatchObject({ code: "PRIVATE_WEBHOOK_DESTINATION" });
  });

  it("accepts a public IPv4 literal", async () => {
    const result = await assertSafeWebhookDestination("https://93.184.216.34/webhooks");
    expect(result.addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects an unresolvable hostname", async () => {
    await expect(assertSafeWebhookDestination("https://this-host-should-not-resolve.invalid.codestra-test/webhooks")).rejects.toMatchObject(
      { code: "UNRESOLVABLE_WEBHOOK_DESTINATION" },
    );
  });
});
