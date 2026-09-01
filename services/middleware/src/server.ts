import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { PrismaClient } from "@prisma/client";
import type { ConnectorIdempotencyStore } from "@codestra/connector-kit";
import type { Env } from "./env.js";
import { JwtAuthenticator } from "./auth/jwt.js";
import { RestrictedGatewayClient } from "./connectors/restricted-gateway-client.js";
import { CodestraError, forbidden, tooManyRequests } from "./errors.js";
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

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    genReqId: () => randomUUID(),
    // Only trust X-Forwarded-For from explicitly configured proxy
    // addresses (TRUSTED_PROXY_CIDRS -- e.g. Kong's real address once
    // deployed). An unconditional `true` here previously let request.ip
    // be taken from a client-supplied header regardless of whether the
    // request actually came through a trusted proxy -- both a direct
    // caller and one reaching Middleware through an edge that merely
    // appends (rather than strips and re-sets) forwarding headers could
    // spoof it. With no proxy configured, request.ip falls back to the
    // real socket peer address.
    trustProxy: options.env.TRUSTED_PROXY_CIDRS.length > 0 ? options.env.TRUSTED_PROXY_CIDRS : false,
  });

  // Defense-in-depth headers and per-IP rate limiting. Kong (or whatever
  // sits in front of this service in production) is expected to carry the
  // primary, tenant-aware rate limit and edge security policy; this
  // ensures the service itself is never defenseless if that layer is
  // misconfigured, bypassed, or the service is reached directly.
  //
  // These registrations are awaited deliberately: an un-awaited
  // `app.register(...)` call still queues the plugin, but its hooks are
  // not reliably attached by the time `app.ready()`/`app.listen()`
  // resolves -- verified directly against a real running server, where an
  // un-awaited registration silently no-ops the rate limit with no error
  // at all (no x-ratelimit-* headers, no 429s, ever). Awaiting each
  // registration here is what makes it real.
  await app.register(helmet, { global: true });
  await app.register(rateLimit, {
    max: options.env.RATE_LIMIT_MAX,
    timeWindow: options.env.RATE_LIMIT_WINDOW_MS,
    // Uses @fastify/rate-limit's default key (request.ip). That's now
    // safe to rely on: trustProxy above only honors X-Forwarded-For from
    // an explicitly configured proxy, so request.ip is either the real
    // client address (forwarded by a trusted proxy) or the real socket
    // peer address (nothing trusted) -- never a value the client itself
    // can set. A previous version of this code keyed on the raw socket
    // address directly to close the same spoofing gap, but that breaks
    // real multi-tenant traffic once a real proxy IS configured: every
    // tenant behind the same proxy would then share one bucket.
    // @fastify/rate-limit throws whatever this returns; a plain object has
    // no statusCode, so without going through CodestraError here it falls
    // into the generic 500 branch of setErrorHandler below instead of
    // actually responding 429 -- verified against a real running server.
    errorResponseBuilder: (_request, context) => tooManyRequests(`Rate limit exceeded, retry after ${context.after}.`),
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
