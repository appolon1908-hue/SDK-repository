import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createWebhookSecret, signWebhook } from "@codestra/webhook-sdk";
import type { JsonObject, WebhookSubscription } from "@codestra/contracts";
import { runIdempotentMutation } from "../idempotency/run-mutation.js";
import { CodestraError, badRequest, conflict, notFound } from "../errors.js";
import { assertSafeWebhookDestination, type DestinationPolicyOptions } from "../webhooks/ssrf.js";
import { dispatchWebhook, type DispatchOptions } from "../webhooks/dispatch.js";
import type { AppDeps } from "../app-deps.js";

const CreateWebhookSubscriptionRequest = z
  .object({
    endpointUrl: z.string().url().startsWith("https://"),
    eventTypes: z.array(z.string().min(1)).min(1),
    description: z.string().max(200).optional(),
  })
  .strict();

interface SubscriptionRow {
  id: string;
  endpointUrl: string;
  eventTypes: string[];
  status: string;
  currentSecret: string;
  verificationStatus: string;
  verificationChallengeId: string | null;
  verifiedAt: Date | null;
  lastAttemptAt: Date | null;
  verificationFailureCode: string | null;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(row: SubscriptionRow): WebhookSubscription {
  return {
    id: row.id,
    endpointUrl: row.endpointUrl,
    eventTypes: row.eventTypes,
    status: row.status as WebhookSubscription["status"],
    verification: {
      status: row.verificationStatus as "pending" | "verified" | "failed",
      ...(row.verificationChallengeId ? { challengeId: row.verificationChallengeId } : {}),
      ...(row.verifiedAt ? { verifiedAt: row.verifiedAt.toISOString() } : {}),
      ...(row.lastAttemptAt ? { lastAttemptAt: row.lastAttemptAt.toISOString() } : {}),
      ...(row.verificationFailureCode ? { failureCode: row.verificationFailureCode } : {}),
    },
    destinationPolicy: { httpsOnly: true, privateAddressBlocked: true, redirectsBlocked: true },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.disabledAt ? { disabledAt: row.disabledAt.toISOString() } : {}),
  };
}

function ssrfOptions(deps: AppDeps): DestinationPolicyOptions {
  return { allowInsecureForTests: deps.env.WEBHOOK_SSRF_ALLOW_INSECURE_FOR_TESTS };
}

function dispatchOptions(deps: AppDeps): DispatchOptions {
  return { insecureSkipCertificateVerification: deps.env.WEBHOOK_SSRF_ALLOW_INSECURE_FOR_TESTS };
}

/**
 * The public OpenAPI contract keeps a subscription `pending_verification`
 * "until verification succeeds" but defines no separate verify endpoint —
 * so Middleware performs the verification handshake itself, immediately
 * after creation: dispatch one real, signed challenge request to the
 * endpoint through the same SSRF-safe path production deliveries use, and
 * treat a 2xx response as proof of control over the destination. Without
 * this, `enable` would be permanently unreachable through the documented
 * API surface. See services/middleware/README.md for the reasoning.
 */
async function attemptVerification(deps: AppDeps, row: SubscriptionRow): Promise<SubscriptionRow> {
  let destination;
  try {
    destination = await assertSafeWebhookDestination(row.endpointUrl, ssrfOptions(deps));
  } catch {
    return deps.prisma.webhookSubscription.update({
      where: { id: row.id },
      data: { verificationStatus: "failed", lastAttemptAt: new Date(), verificationFailureCode: "PRIVATE_WEBHOOK_DESTINATION" },
    });
  }

  const challengeId = row.verificationChallengeId ?? randomUUID();
  const bodyText = JSON.stringify({ challengeId, subscriptionId: row.id, type: "codestra.webhook.verification.v1" });
  const headers = await signWebhook({ id: challengeId, payload: bodyText, secret: row.currentSecret });
  const result = await dispatchWebhook(
    destination,
    new URL(row.endpointUrl),
    { "content-type": "application/json", "webhook-id": headers["webhook-id"], "webhook-timestamp": headers["webhook-timestamp"], "webhook-signature": headers["webhook-signature"] },
    bodyText,
    deps.env.WEBHOOK_DELIVERY_TIMEOUT_MS,
    dispatchOptions(deps),
  );

  return deps.prisma.webhookSubscription.update({
    where: { id: row.id },
    data: result.ok
      ? { verificationStatus: "verified", verifiedAt: new Date(), lastAttemptAt: new Date(), verificationFailureCode: null }
      : { verificationStatus: "pending", lastAttemptAt: new Date(), verificationFailureCode: result.redirected ? "REDIRECT_REFUSED" : "VERIFICATION_DELIVERY_FAILED" },
  });
}

export function registerWebhookSubscriptionRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.post("/v1/webhook-subscriptions", async (request, reply) => {
    const tenantId = await deps.authenticate(request);
    const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
    const parsed = CreateWebhookSubscriptionRequest.safeParse(request.body);
    if (!parsed.success) throw badRequest("Invalid create-webhook-subscription request body.", { issues: parsed.error.issues as unknown as JsonObject });
    const input = parsed.data;

    // Validated before the idempotency ledger is touched so a destination
    // that fails SSRF policy never occupies an idempotency slot.
    await assertSafeWebhookDestination(input.endpointUrl, ssrfOptions(deps));

    const { outcome, replayed } = await runIdempotentMutation(
      deps.idempotencyStore,
      { tenantId, namespace: "api", operation: "webhookSubscription.create", idempotencyKey, payload: input as unknown as JsonObject },
      async () => {
        const id = randomUUID();
        const secret = createWebhookSecret();
        let row: SubscriptionRow = await deps.prisma.webhookSubscription.create({
          data: {
            id,
            tenantId,
            endpointUrl: input.endpointUrl,
            eventTypes: input.eventTypes,
            ...(input.description === undefined ? {} : { description: input.description }),
            status: "pending_verification",
            currentSecret: secret,
            currentSecretCreatedAt: new Date(),
            verificationStatus: "pending",
            verificationChallengeId: randomUUID(),
          },
        });
        row = await attemptVerification(deps, row);
        return {
          status: 201,
          body: { subscription: serialize(row), signingSecret: secret } as unknown as JsonObject,
        };
      },
    );

    // Standard idempotency-key replay semantics: a retry with the same key
    // returns the exact original response, secret included — it is the
    // same disclosure to the same caller, not a new one. "Shown exactly
    // once" governs different calls (read/list/enable/disable/test never
    // return it, and a *new* Idempotency-Key always mints a fresh secret).
    reply.code(replayed ? outcome.status : 201);
    return outcome.body;
  });

  app.get("/v1/webhook-subscriptions", async (request) => {
    const tenantId = await deps.authenticate(request);
    const rows = await deps.prisma.webhookSubscription.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
    return { items: rows.map(serialize) };
  });

  app.get<{ Params: { subscriptionId: string } }>("/v1/webhook-subscriptions/:subscriptionId", async (request) => {
    const tenantId = await deps.authenticate(request);
    const row = await requireOwnedSubscription(deps, tenantId, request.params.subscriptionId);
    return serialize(row);
  });

  app.delete<{ Params: { subscriptionId: string } }>("/v1/webhook-subscriptions/:subscriptionId", async (request, reply) => {
    const tenantId = await deps.authenticate(request);
    requireIdempotencyKey(request.headers["idempotency-key"]);
    await requireOwnedSubscription(deps, tenantId, request.params.subscriptionId);
    await deps.prisma.webhookSubscription.deleteMany({ where: { id: request.params.subscriptionId, tenantId } });
    reply.code(204);
    return null;
  });

  app.post<{ Params: { subscriptionId: string } }>("/v1/webhook-subscriptions/:subscriptionId/enable", async (request) => {
    const tenantId = await deps.authenticate(request);
    requireIdempotencyKey(request.headers["idempotency-key"]);
    const existing = await requireOwnedSubscription(deps, tenantId, request.params.subscriptionId);
    if (existing.verificationStatus !== "verified") {
      throw conflict("VERIFICATION_REQUIRED", "A webhook subscription must be verified before it can be enabled.");
    }
    const row = await deps.prisma.webhookSubscription.update({
      where: { id: existing.id },
      data: { status: "active", disabledAt: null },
    });
    return serialize(row);
  });

  app.post<{ Params: { subscriptionId: string } }>("/v1/webhook-subscriptions/:subscriptionId/disable", async (request) => {
    const tenantId = await deps.authenticate(request);
    requireIdempotencyKey(request.headers["idempotency-key"]);
    const existing = await requireOwnedSubscription(deps, tenantId, request.params.subscriptionId);
    const row = await deps.prisma.webhookSubscription.update({
      where: { id: existing.id },
      data: { status: "disabled", disabledAt: new Date() },
    });
    return serialize(row);
  });

  app.post<{ Params: { subscriptionId: string } }>("/v1/webhook-subscriptions/:subscriptionId/rotate-secret", async (request, reply) => {
    const tenantId = await deps.authenticate(request);
    const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
    const existing = await requireOwnedSubscription(deps, tenantId, request.params.subscriptionId);

    const { outcome } = await runIdempotentMutation(
      deps.idempotencyStore,
      { tenantId, namespace: "api", operation: "webhookSubscription.rotateSecret", idempotencyKey, payload: { subscriptionId: existing.id } },
      async () => {
        const newSecret = createWebhookSecret();
        const overlapHours = deps.env.WEBHOOK_SECRET_OVERLAP_HOURS;
        const previousSecretExpiresAt = new Date(Date.now() + overlapHours * 60 * 60 * 1000);
        const row = await deps.prisma.webhookSubscription.update({
          where: { id: existing.id },
          data: {
            previousSecret: existing.currentSecret,
            previousSecretExpiresAt,
            currentSecret: newSecret,
            currentSecretCreatedAt: new Date(),
          },
        });
        return {
          status: 200,
          body: {
            subscription: serialize(row),
            signingSecret: newSecret,
            previousSecretExpiresAt: previousSecretExpiresAt.toISOString(),
          } as unknown as JsonObject,
        };
      },
    );

    // Same replay semantics as create: retrying rotate-secret with the same
    // Idempotency-Key returns the exact original rotation response rather
    // than rotating again. A genuinely new rotation always requires a new
    // Idempotency-Key.
    reply.code(outcome.status);
    return outcome.body;
  });

  app.post<{ Params: { subscriptionId: string } }>("/v1/webhook-subscriptions/:subscriptionId/test", async (request, reply) => {
    const tenantId = await deps.authenticate(request);
    const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
    const existing = await requireOwnedSubscription(deps, tenantId, request.params.subscriptionId);

    const { outcome } = await runIdempotentMutation(
      deps.idempotencyStore,
      { tenantId, namespace: "api", operation: "webhookSubscription.test", idempotencyKey, payload: { subscriptionId: existing.id } },
      async () => {
        const deliveryId = randomUUID();
        const acceptedAt = new Date();

        let destination;
        try {
          destination = await assertSafeWebhookDestination(existing.endpointUrl, ssrfOptions(deps));
        } catch {
          await deps.prisma.webhookDelivery.create({
            data: {
              id: deliveryId,
              tenantId,
              subscriptionId: existing.id,
              eventType: "codestra.webhook.test.v1",
              status: "rejected",
              failureCode: "PRIVATE_WEBHOOK_DESTINATION",
              failureMessage: "Destination failed SSRF-safety validation at dispatch time.",
            },
          });
          return {
            status: 202,
            body: { deliveryId, subscriptionId: existing.id, status: "rejected", acceptedAt: acceptedAt.toISOString() } as unknown as JsonObject,
          };
        }

        const eventPayload = { deliveryId, subscriptionId: existing.id, message: "Codestra webhook test delivery" };
        const bodyText = JSON.stringify(eventPayload);
        const headers = await signWebhook({ id: deliveryId, payload: bodyText, secret: existing.currentSecret });

        await deps.prisma.webhookDelivery.create({
          data: { id: deliveryId, tenantId, subscriptionId: existing.id, eventType: "codestra.webhook.test.v1", status: "queued" },
        });

        const url = new URL(existing.endpointUrl);
        const result = await dispatchWebhook(
          destination,
          url,
          {
            "content-type": "application/json",
            "webhook-id": headers["webhook-id"],
            "webhook-timestamp": headers["webhook-timestamp"],
            "webhook-signature": headers["webhook-signature"],
          },
          bodyText,
          deps.env.WEBHOOK_DELIVERY_TIMEOUT_MS,
          dispatchOptions(deps),
        );

        await deps.prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: result.ok ? "delivered" : "failed",
            attempt: 1,
            ...(result.statusCode !== undefined ? { responseStatus: result.statusCode } : {}),
            ...(result.errorMessage ? { failureMessage: result.errorMessage } : {}),
            ...(result.redirected ? { failureCode: "REDIRECT_REFUSED", failureMessage: "Destination returned a redirect; Middleware never follows webhook redirects." } : {}),
          },
        });

        return {
          status: 202,
          body: { deliveryId, subscriptionId: existing.id, status: "queued", acceptedAt: acceptedAt.toISOString() } as unknown as JsonObject,
        };
      },
    );

    reply.code(outcome.status);
    return outcome.body;
  });
}

async function requireOwnedSubscription(deps: AppDeps, tenantId: string, subscriptionId: string): Promise<SubscriptionRow> {
  if (!z.string().uuid().safeParse(subscriptionId).success) throw notFound("WebhookSubscription", subscriptionId);
  const row = await deps.prisma.webhookSubscription.findFirst({ where: { id: subscriptionId, tenantId } });
  if (!row) throw notFound("WebhookSubscription", subscriptionId);
  return row;
}

function requireIdempotencyKey(value: string | string[] | undefined): string {
  const key = Array.isArray(value) ? value[0] : value;
  if (!key || key.length < 16 || key.length > 128) {
    throw new CodestraError(400, "IDEMPOTENCY_KEY_REQUIRED", "An Idempotency-Key header between 16 and 128 characters is required.", {
      retryable: false,
    });
  }
  return key;
}
