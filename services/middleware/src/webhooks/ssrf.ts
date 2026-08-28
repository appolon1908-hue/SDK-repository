import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { unprocessable } from "../errors.js";

export interface ResolvedDestination {
  hostname: string;
  port: number;
  /** Every A/AAAA record the hostname resolved to, all proven public. */
  addresses: readonly { address: string; family: 4 | 6 }[];
}

export interface DestinationPolicyOptions {
  /**
   * Test/local-development escape hatch ONLY: skips the private/loopback/
   * link-local/reserved-address rejection so integration tests can dispatch
   * a real, genuinely TLS-terminated request to a local receiver. HTTPS is
   * still mandatory either way — this never relaxes the protocol check.
   * Never set from request data, never enabled by default, and never
   * reachable from any production code path: it is wired from
   * WEBHOOK_SSRF_ALLOW_INSECURE_FOR_TESTS, which defaults to false and
   * every deployment config leaves unset. See
   * services/middleware/README.md.
   */
  allowInsecureForTests?: boolean;
}

/**
 * Enforces the webhook destination policy required everywhere Middleware
 * signs and sends an outbound delivery: HTTPS only, no private/loopback/
 * link-local/reserved address, and — by resolving here and pinning the
 * connection to exactly these resolved addresses at dispatch time — no
 * window for DNS-rebinding to swap in an unsafe address between this check
 * and the actual HTTP connection.
 */
export async function assertSafeWebhookDestination(
  rawUrl: string,
  options: DestinationPolicyOptions = {},
): Promise<ResolvedDestination> {
  const allowInsecure = options.allowInsecureForTests === true;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw unprocessable("INVALID_WEBHOOK_DESTINATION", "Webhook endpointUrl must be an absolute URL.");
  }

  if (url.protocol !== "https:") {
    throw unprocessable("INVALID_WEBHOOK_DESTINATION", "Webhook endpointUrl must use https://.");
  }
  if (url.username || url.password) {
    throw unprocessable("INVALID_WEBHOOK_DESTINATION", "Webhook endpointUrl must not embed credentials.");
  }

  const hostname = url.hostname;
  const port = url.port ? Number(url.port) : 443;

  // WHATWG URL keeps the brackets in .hostname for an IPv6 literal (e.g.
  // "[::1]"), which node:net's isIP() does not recognize as an IP at all —
  // it would fall through to the DNS-lookup branch below and fail as
  // "unresolvable" instead of being rejected as private/reserved. Strip
  // them before the IP check; both the check and the returned address use
  // the bracket-free form.
  const literalAddress = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  const ipFamily = isIP(literalAddress);
  if (ipFamily !== 0) {
    if (!allowInsecure && !isPublicAddress(literalAddress, ipFamily === 4 ? 4 : 6)) {
      throw unprocessable("PRIVATE_WEBHOOK_DESTINATION", "Webhook endpointUrl resolves to a private, loopback, or reserved address.");
    }
    return { hostname, port, addresses: [{ address: literalAddress, family: ipFamily === 4 ? 4 : 6 }] };
  }

  if (!allowInsecure && (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local"))) {
    throw unprocessable("PRIVATE_WEBHOOK_DESTINATION", "Webhook endpointUrl must not target a loopback or local-network hostname.");
  }

  let records: { address: string; family: number }[];
  try {
    records = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch {
    throw unprocessable("UNRESOLVABLE_WEBHOOK_DESTINATION", "Webhook endpointUrl hostname could not be resolved.");
  }
  if (records.length === 0) {
    throw unprocessable("UNRESOLVABLE_WEBHOOK_DESTINATION", "Webhook endpointUrl hostname did not resolve to any address.");
  }

  const addresses: { address: string; family: 4 | 6 }[] = [];
  for (const record of records) {
    const family = record.family === 6 ? 6 : 4;
    if (!allowInsecure && !isPublicAddress(record.address, family)) {
      throw unprocessable(
        "PRIVATE_WEBHOOK_DESTINATION",
        "Webhook endpointUrl resolves to a private, loopback, link-local, or reserved address.",
        { hostname, resolvedAddress: record.address },
      );
    }
    addresses.push({ address: record.address, family });
  }

  return { hostname, port, addresses };
}

function isPublicAddress(address: string, family: 4 | 6): boolean {
  return family === 4 ? isPublicIPv4(address) : isPublicIPv6(address);
}

function isPublicIPv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets as [number, number, number, number];

  if (a === 0) return false; // 0.0.0.0/8 "this network"
  if (a === 10) return false; // RFC1918
  if (a === 127) return false; // loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return false; // link-local
  if (a === 172 && b >= 16 && b <= 31) return false; // RFC1918
  if (a === 192 && b === 0 && octets[2] === 0) return false; // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 0 && octets[2] === 2) return false; // TEST-NET-1
  if (a === 192 && b === 88 && octets[2] === 99) return false; // 6to4 relay anycast
  if (a === 192 && b === 168) return false; // RFC1918
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && octets[2] === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && octets[2] === 113) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast (224/4) + reserved (240/4) + broadcast

  return true;
}

function isPublicIPv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "::1") return false; // loopback
  if (normalized === "::") return false; // unspecified

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible/NAT64 addresses: judge
  // by the embedded IPv4 address instead. WHATWG URL's IPv6 serializer
  // never keeps the dotted-quad form for a bracketed URL literal -- it
  // always emits the embedded IPv4 as compressed hex groups (so
  // "[::ffff:10.0.0.5]" becomes hostname "[::ffff:a00:5]", not
  // "[::ffff:10.0.0.5]") -- so both forms have to be checked, not just the
  // dotted one a resolved DNS record might still use.
  const mappedIPv4 = extractMappedIPv4(normalized);
  if (mappedIPv4) return isPublicIPv4(mappedIPv4);

  const firstGroup = normalized.split(":")[0] ?? "";
  const firstHextet = Number.parseInt(firstGroup.padStart(1, "0") || "0", 16);

  if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return false; // fe80::/10 link-local
  }
  if (!Number.isNaN(firstHextet) && (firstHextet & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if (normalized.startsWith("2001:db8:")) return false; // documentation range
  if (normalized.startsWith("ff")) return false; // multicast

  return true;
}

/**
 * Returns the embedded IPv4 address (dotted-quad) for an IPv4-mapped
 * (`::ffff:.../96`) or IPv4-compatible/NAT64 (`64:ff9b::/96`) IPv6 address,
 * accepting both the dotted-quad suffix a resolved DNS record might carry
 * and the compressed-hex-groups suffix WHATWG URL always serializes for a
 * bracketed literal. Returns null for anything else.
 */
function extractMappedIPv4(normalized: string): string | null {
  const dottedMatch =
    /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(normalized) ?? /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/u.exec(normalized);
  if (dottedMatch?.[1]) return dottedMatch[1];

  const hexMatch =
    /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(normalized) ??
    /^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(normalized);
  if (hexMatch) {
    const hi = Number.parseInt(hexMatch[1]!, 16);
    const lo = Number.parseInt(hexMatch[2]!, 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }

  return null;
}
