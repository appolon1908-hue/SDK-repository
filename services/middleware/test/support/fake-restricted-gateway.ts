import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export type GatewayHandler = (
  request: { method: string; path: string; headers: IncomingMessage["headers"]; body: unknown },
  response: ServerResponse,
) => void | Promise<void>;

/**
 * A real local HTTP server standing in for a product-local restricted
 * gateway (contracts/openapi/codestra-restricted-gateway.openapi.yaml) —
 * no such gateway ships in this repository, so tests exercise
 * `RestrictedGatewayClient`'s real HTTP behavior (timeouts, non-2xx
 * handling, connection resets) against this stand-in rather than mocking
 * `fetch`.
 */
export class FakeRestrictedGateway {
  private server: Server | undefined;
  url = "";

  constructor(private handler: GatewayHandler) {}

  setHandler(handler: GatewayHandler): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let body: unknown;
        try {
          body = raw.length > 0 ? JSON.parse(raw) : undefined;
        } catch {
          body = raw;
        }
        void this.handler({ method: request.method ?? "GET", path: request.url ?? "/", headers: request.headers, body }, response);
      });
    });
    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", resolve));
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind fake restricted gateway.");
    this.url = `http://127.0.0.1:${address.port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => this.server?.close((error) => (error ? reject(error) : resolve())));
  }
}

export function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(text);
}
