import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { ConnectorIdempotencyStore } from "@codestra/connector-kit";
import type { Env } from "./env.js";
import { JwtAuthenticator } from "./auth/jwt.js";
import { RestrictedGatewayClient } from "./connectors/restricted-gateway-client.js";
import { CodestraError, forbidden } from "./errors.js";
import type { AppDeps } from "./app-deps.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSocialPostRoutes } from "./routes/social-posts.js";
import { registerWebhookSubscriptionRoutes } from "./routes/webhook-subscriptions.js";
import { registerConnectorRoutes } from "./routes/connectors.js";

export interface BuildServerOptions {
  env: Env;
  prisma: PrismaClient;
  idempotencyStore: ConnectorIdempotencyStore;
  jwtAuthenticator?: JwtAuthenticator;
  restrictedGatewayClient?: RestrictedGatewayClient;
  logger?: boolean;
}

export function buildServer(options: BuildServerOptions): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? true,
    genReqId: () => randomUUID(),
    trustProxy: true,
  });

  const jwtAuthenticator = options.jwtAuthenticator ?? new JwtAuthenticator(options.env);
  const restrictedGatewayClient = options.restrictedGatewayClient ?? new RestrictedGatewayClient(options.env);

  const authenticate = async (request: FastifyRequest): Promise<string> => {
    const verified = await jwtAuthenticator.authenticate(request.headers.authorization);
    // Tenant scoping is authoritative from the verified JWT claim only. The
    // public/enterprise OpenAPI contracts also declare an
    // X-Codestra-Tenant-Id header; Middleware accepts it as an optional
    // routing convenience (Kong may forward it) but never as a trust
    // source — if present, it must exactly match the JWT's tenant claim or
    // the request is refused outright, rather than silently preferring
    // either value.
    const headerValue = request.headers["x-codestra-tenant-id"];
    const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (header && header.toLowerCase() !== verified.tenantId) {
      throw forbidden("TENANT_MISMATCH", "X-Codestra-Tenant-Id header does not match the authenticated tenant.");
    }
    return verified.tenantId;
  };

  const deps: AppDeps = {
    env: options.env,
    prisma: options.prisma,
    idempotencyStore: options.idempotencyStore,
    restrictedGatewayClient,
    jwtAuthenticator,
    authenticate,
  };

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof CodestraError) {
      reply.code(error.status).send(error.toBody(String(request.id)));
      return;
    }
    // Fastify's own JSON body-parse failures.
    if (error.statusCode === 400) {
      reply.code(400).send(
        new CodestraError(400, "VALIDATION_ERROR", error.message).toBody(String(request.id)),
      );
      return;
    }
    request.log.error({ err: error }, "Unhandled error");
    reply.code(500).send(
      new CodestraError(500, "INTERNAL_ERROR", "An unexpected error occurred.", { retryable: true }).toBody(String(request.id)),
    );
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send(
      new CodestraError(404, "ROUTE_NOT_FOUND", `No route matches ${request.method} ${request.url}.`, { retryable: false }).toBody(
        String(request.id),
      ),
    );
  });

  registerHealthRoutes(app, deps);
  registerSocialPostRoutes(app, deps);
  registerWebhookSubscriptionRoutes(app, deps);
  registerConnectorRoutes(app, deps);

  return app;
}
