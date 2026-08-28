import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ChannelDelivery, JsonObject, SocialPost, SocialPostStatus } from "@codestra/contracts";
import { writeOutboxEvent } from "../outbox/writer.js";
import { runIdempotentMutation } from "../idempotency/run-mutation.js";
import { CodestraError, badRequest, conflict, notFound } from "../errors.js";
import type { AppDeps } from "../app-deps.js";

const SOCIAL_CHANNELS = ["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"] as const;
const SOCIAL_POST_STATUSES = [
  "accepted",
  "scheduled",
  "publishing",
  "published",
  "partially_published",
  "failed",
  "cancelled",
] as const;
const CANCELLABLE_STATUSES: readonly SocialPostStatus[] = ["accepted", "scheduled", "publishing"];

const CreateSocialPostRequest = z
  .object({
    workspaceId: z.string().uuid(),
    channels: z.array(z.enum(SOCIAL_CHANNELS)).min(1),
    content: z
      .object({
        text: z.string().min(1).max(10_000),
        mediaUrls: z.array(z.string().url()).max(20).optional(),
        linkUrl: z.string().url().optional(),
      })
      .strict(),
    publishAt: z.string().datetime({ offset: true }).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const ListQuery = z.object({
  cursor: z.string().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  workspaceId: z.string().uuid().optional(),
  status: z.enum(SOCIAL_POST_STATUSES).optional(),
});

interface SocialPostRow {
  id: string;
  tenantId: string;
  workspaceId: string;
  status: string;
  content: unknown;
  channels: unknown;
  publishAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(row: SocialPostRow): SocialPost {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    status: row.status as SocialPostStatus,
    channels: row.channels as ChannelDelivery[],
    content: row.content as SocialPost["content"],
    ...(row.publishAt ? { publishAt: row.publishAt.toISOString() } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): string {
  try {
    const id = Buffer.from(cursor, "base64url").toString("utf8");
    if (!z.string().uuid().safeParse(id).success) throw new Error("invalid");
    return id;
  } catch {
    throw badRequest("cursor is not a valid pagination token.");
  }
}

export function registerSocialPostRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.post("/v1/social/posts", async (request, reply) => {
    const tenantId = await deps.authenticate(request);
    const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
    const parsed = CreateSocialPostRequest.safeParse(request.body);
    if (!parsed.success) throw badRequest("Invalid create-social-post request body.", { issues: parsed.error.issues as unknown as JsonObject });
    const input = parsed.data;

    const { outcome, replayed } = await runIdempotentMutation(
      deps.idempotencyStore,
      { tenantId, namespace: "api", operation: "socialPost.create", idempotencyKey, payload: input as unknown as JsonObject },
      async () => {
        const id = randomUUID();
        const channels: ChannelDelivery[] = input.channels.map((channel) => ({ channel, status: "accepted" }));
        const row = await deps.prisma.$transaction(async (tx) => {
          const created = await tx.socialPost.create({
            data: {
              id,
              tenantId,
              workspaceId: input.workspaceId,
              status: "accepted",
              content: input.content,
              channels: channels as unknown as JsonObject[],
              publishAt: input.publishAt ? new Date(input.publishAt) : null,
              ...(input.metadata === undefined ? {} : { metadata: input.metadata as JsonObject }),
            },
          });
          await writeOutboxEvent(tx, {
            tenantId,
            eventType: "codestra.social.post.status.v1",
            subject: created.id,
            payload: {
              postId: created.id,
              tenantId,
              status: "accepted",
              deliveries: channels as unknown as JsonObject[],
              occurredAt: created.createdAt.toISOString(),
            },
          });
          return created;
        });
        return { status: 202, body: serialize(row) as unknown as JsonObject };
      },
    );

    reply.code(replayed ? outcome.status : 202);
    return outcome.body;
  });

  app.get("/v1/social/posts", async (request) => {
    const tenantId = await deps.authenticate(request);
    const parsed = ListQuery.safeParse(request.query);
    if (!parsed.success) throw badRequest("Invalid list-social-posts query.", { issues: parsed.error.issues as unknown as JsonObject });
    const { cursor, limit = 20, workspaceId, status } = parsed.data;

    const rows = await deps.prisma.socialPost.findMany({
      where: { tenantId, ...(workspaceId ? { workspaceId } : {}), ...(status ? { status } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: decodeCursor(cursor) }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map(serialize),
      ...(hasMore && last ? { nextCursor: encodeCursor(last.id) } : {}),
    };
  });

  app.get<{ Params: { postId: string } }>("/v1/social/posts/:postId", async (request) => {
    const tenantId = await deps.authenticate(request);
    const { postId } = request.params;
    if (!z.string().uuid().safeParse(postId).success) throw notFound("SocialPost", postId);
    const row = await deps.prisma.socialPost.findFirst({ where: { id: postId, tenantId } });
    if (!row) throw notFound("SocialPost", postId);
    return serialize(row);
  });

  app.post<{ Params: { postId: string } }>("/v1/social/posts/:postId/cancel", async (request, reply) => {
    const tenantId = await deps.authenticate(request);
    const { postId } = request.params;
    const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
    if (!z.string().uuid().safeParse(postId).success) throw notFound("SocialPost", postId);

    const { outcome, replayed } = await runIdempotentMutation(
      deps.idempotencyStore,
      { tenantId, namespace: "api", operation: "socialPost.cancel", idempotencyKey, payload: { postId } },
      async () => {
        const row = await deps.prisma.$transaction(async (tx) => {
          const existing = await tx.socialPost.findFirst({ where: { id: postId, tenantId } });
          if (!existing) throw notFound("SocialPost", postId);
          if (!CANCELLABLE_STATUSES.includes(existing.status as SocialPostStatus)) {
            throw conflict("INVALID_STATE_TRANSITION", `SocialPost ${postId} cannot be cancelled from status ${existing.status}.`, {
              details: { status: existing.status },
            });
          }
          const updated = await tx.socialPost.update({ where: { id: postId }, data: { status: "cancelled" } });
          await writeOutboxEvent(tx, {
            tenantId,
            eventType: "codestra.social.post.status.v1",
            subject: updated.id,
            payload: {
              postId: updated.id,
              tenantId,
              previousStatus: existing.status,
              status: "cancelled",
              deliveries: updated.channels as unknown as JsonObject[],
              occurredAt: updated.updatedAt.toISOString(),
            },
          });
          return updated;
        });
        return { status: 202, body: serialize(row) as unknown as JsonObject };
      },
    );

    reply.code(replayed ? outcome.status : 202);
    return outcome.body;
  });
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
