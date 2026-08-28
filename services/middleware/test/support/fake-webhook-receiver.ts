import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as https from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface ReceivedRequest {
  headers: IncomingMessage["headers"];
  body: string;
}

/**
 * A real local HTTPS server (a genuine, self-signed TLS handshake — not a
 * mock) standing in for a tenant's webhook endpoint. Middleware's outbound
 * dispatch (src/webhooks/dispatch.ts) connects to it exactly as it would
 * connect to a real destination, with certificate verification disabled
 * only via the same test-only flag that relaxes the SSRF private-address
 * check (WEBHOOK_SSRF_ALLOW_INSECURE_FOR_TESTS) — HTTPS itself is never
 * bypassed.
 */
export class FakeWebhookReceiver {
  private server: https.Server | undefined;
  received: ReceivedRequest[] = [];
  responseStatus = 200;
  redirectTo: string | undefined;
  url = "";

  async start(): Promise<void> {
    const dir = mkdtempSync(join(tmpdir(), "codestra-webhook-cert-"));
    const keyPath = join(dir, "key.pem");
    const certPath = join(dir, "cert.pem");
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", keyPath, "-out", certPath,
      "-days", "1", "-subj", "/CN=127.0.0.1",
    ], { stdio: "pipe" });

    const key = readFileSync(keyPath);
    const cert = readFileSync(certPath);

    this.server = https.createServer({ key, cert }, (request: IncomingMessage, response: ServerResponse) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        this.received.push({ headers: request.headers, body: Buffer.concat(chunks).toString("utf8") });
        if (this.redirectTo) {
          response.writeHead(302, { location: this.redirectTo });
          response.end();
          return;
        }
        response.writeHead(this.responseStatus, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: this.responseStatus < 300 }));
      });
    });

    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", resolve));
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind fake webhook receiver.");
    this.url = `https://127.0.0.1:${address.port}/hooks`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => this.server?.close((error) => (error ? reject(error) : resolve())));
  }
}
