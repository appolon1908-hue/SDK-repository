import * as https from "node:https";
import type { LookupFunction } from "node:net";
import type { ResolvedDestination } from "./ssrf.js";

export interface WebhookDispatchResult {
  ok: boolean;
  statusCode?: number;
  redirected: boolean;
  errorMessage?: string;
}

export interface DispatchOptions {
  /**
   * Test-only: accept a self-signed certificate. Threaded from the same
   * WEBHOOK_SSRF_ALLOW_INSECURE_FOR_TESTS flag as
   * `DestinationPolicyOptions.allowInsecureForTests` (see
   * src/webhooks/ssrf.ts) so integration tests can terminate real TLS
   * against a local receiver without a CA-signed certificate. Defaults to
   * false; every deployment config leaves it unset.
   */
  insecureSkipCertificateVerification?: boolean;
}

/**
 * Sends the signed webhook body to a destination already cleared by
 * `assertSafeWebhookDestination`. The connection is pinned to one of the
 * addresses that check resolved (via a custom `lookup`) so a DNS answer
 * that changes between the check and this call cannot redirect the
 * connection to a private address, and redirects are never followed — a
 * 3xx response is reported back as a non-ok delivery, and the Location
 * header is never dereferenced.
 */
export function dispatchWebhook(
  destination: ResolvedDestination,
  url: URL,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
  options: DispatchOptions = {},
): Promise<WebhookDispatchResult> {
  return new Promise((resolve) => {
    const pinned = destination.addresses[0];
    if (!pinned) {
      resolve({ ok: false, redirected: false, errorMessage: "No resolved address to dispatch to." });
      return;
    }

    const lookup: LookupFunction = (_hostname, lookupOptions, callback) => {
      if (lookupOptions.all) {
        callback(null, [{ address: pinned.address, family: pinned.family }]);
      } else {
        callback(null, pinned.address, pinned.family);
      }
    };

    const request = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: destination.port,
        path: `${url.pathname}${url.search}`,
        headers: { ...headers, "content-length": Buffer.byteLength(body) },
        servername: url.hostname, // correct SNI/cert hostname even though we pin the connection below
        timeout: timeoutMs,
        lookup,
        rejectUnauthorized: !options.insecureSkipCertificateVerification,
      },
      (response) => {
        response.resume(); // discard body, we only care about the outcome
        const statusCode = response.statusCode ?? 0;
        const redirected = statusCode >= 300 && statusCode < 400;
        resolve({ ok: statusCode >= 200 && statusCode < 300, statusCode, redirected });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("Webhook delivery timed out."));
    });
    request.on("error", (error) => {
      resolve({ ok: false, redirected: false, errorMessage: error.message });
    });

    request.write(body);
    request.end();
  });
}

