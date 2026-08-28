import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { Env } from "../env.js";
import { unauthorized } from "../errors.js";

export interface AuthenticatedRequest {
  tenantId: string;
  subject: string;
  claims: JWTPayload;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Verifies a bearer JWT against a configurable JWKS URL/issuer/audience and
 * extracts the tenant ID claim.
 *
 * There is no real identity provider deployed with this repository. This is
 * the seam a real OIDC provider (e.g. Keycloak) plugs into in production —
 * point OIDC_JWKS_URL/OIDC_ISSUER/OIDC_AUDIENCE at it. In production, Kong
 * sits in front of Middleware, but Middleware still verifies the JWT itself
 * rather than trusting an upstream header, because Kong is a routing layer,
 * not a trust boundary this service should rely on blindly.
 */
export class JwtAuthenticator {
  private readonly jwks: JWTVerifyGetKey;

  constructor(private readonly env: Env) {
    this.jwks = createRemoteJWKSet(new URL(env.OIDC_JWKS_URL));
  }

  async authenticate(authorizationHeader: string | undefined): Promise<AuthenticatedRequest> {
    if (!authorizationHeader) {
      throw unauthorized("UNAUTHENTICATED", "Missing Authorization header.");
    }
    const match = /^Bearer\s+(\S+)$/iu.exec(authorizationHeader.trim());
    if (!match?.[1]) {
      throw unauthorized("UNAUTHENTICATED", "Authorization header must be a Bearer token.");
    }
    const token = match[1];

    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(token, this.jwks, {
        issuer: this.env.OIDC_ISSUER,
        audience: this.env.OIDC_AUDIENCE,
        clockTolerance: this.env.JWT_CLOCK_TOLERANCE_SECONDS,
      });
      payload = verified.payload;
    } catch (error) {
      throw unauthorized("UNAUTHENTICATED", describeJwtFailure(error));
    }

    const tenantClaim = payload[this.env.OIDC_TENANT_CLAIM];
    if (typeof tenantClaim !== "string" || !UUID_PATTERN.test(tenantClaim)) {
      throw unauthorized(
        "UNAUTHENTICATED",
        `Token is missing a valid "${this.env.OIDC_TENANT_CLAIM}" tenant claim.`,
      );
    }
    const subject = typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : "unknown-subject";

    return { tenantId: tenantClaim.toLowerCase(), subject, claims: payload };
  }
}

function describeJwtFailure(error: unknown): string {
  if (error instanceof Error) {
    switch (error.name) {
      case "JWTExpired":
        return "Token has expired.";
      case "JWTClaimValidationFailed":
        return `Token claim validation failed: ${error.message}`;
      case "JWSSignatureVerificationFailed":
        return "Token signature is invalid.";
      case "JWKSNoMatchingKey":
        return "No matching signing key was found for this token.";
      default:
        return "Token could not be verified.";
    }
  }
  return "Token could not be verified.";
}
