import { createServer, type Server } from "node:http";
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from "jose";
import { randomUUID } from "node:crypto";

/**
 * A real, local JWKS HTTP endpoint used only in tests, standing in for the
 * OIDC provider (Keycloak or similar) that plugs into
 * OIDC_JWKS_URL/OIDC_ISSUER/OIDC_AUDIENCE in production. Tests exercise the
 * genuine `jose` remote-JWKS verification path end to end against it —
 * nothing about JWT verification itself is mocked.
 */
export class TestJwksServer {
  private server: Server | undefined;
  private privateKey: KeyLike | undefined;
  private kid = randomUUID();
  readonly issuer = "https://test-issuer.codestra.invalid/realms/codestra";
  readonly audience = "codestra-middleware-test";

  url = "";

  async start(): Promise<void> {
    const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
    this.privateKey = privateKey;
    const jwk = await exportJWK(publicKey);
    jwk.kid = this.kid;
    jwk.alg = "RS256";
    jwk.use = "sig";

    this.server = createServer((request, response) => {
      if (request.url === "/jwks.json") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      response.writeHead(404);
      response.end();
    });

    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", resolve));
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test JWKS server.");
    this.url = `http://127.0.0.1:${address.port}/jwks.json`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => this.server?.close((error) => (error ? reject(error) : resolve())));
  }

  async issueToken(claims: { tenantId?: string; subject?: string; audience?: string; issuer?: string; expiresInSeconds?: number } = {}): Promise<string> {
    if (!this.privateKey) throw new Error("Test JWKS server has not been started.");
    const now = Math.floor(Date.now() / 1000);
    let jwt = new SignJWT({
      tenant_id: claims.tenantId ?? randomUUID(),
    })
      .setProtectedHeader({ alg: "RS256", kid: this.kid })
      .setIssuedAt(now)
      .setIssuer(claims.issuer ?? this.issuer)
      .setAudience(claims.audience ?? this.audience)
      .setSubject(claims.subject ?? "test-user")
      .setExpirationTime(now + (claims.expiresInSeconds ?? 3600));
    return jwt.sign(this.privateKey);
  }
}
