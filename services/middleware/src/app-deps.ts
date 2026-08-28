import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { ConnectorIdempotencyStore } from "@codestra/connector-kit";
import type { Env } from "./env.js";
import type { JwtAuthenticator } from "./auth/jwt.js";
import type { RestrictedGatewayClient } from "./connectors/restricted-gateway-client.js";

/**
 * Dependencies threaded into every route module. `authenticate` verifies
 * the request's bearer JWT and returns the tenant ID pulled from it — the
 * only source of tenant scoping every route is allowed to use.
 */
export interface AppDeps {
  env: Env;
  prisma: PrismaClient;
  idempotencyStore: ConnectorIdempotencyStore;
  restrictedGatewayClient: RestrictedGatewayClient;
  jwtAuthenticator: JwtAuthenticator;
  authenticate: (request: FastifyRequest) => Promise<string>;
}
