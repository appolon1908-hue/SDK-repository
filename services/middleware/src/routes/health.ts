import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../app-deps.js";

export function registerHealthRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/health/ready", async (_request, reply) => {
    const checkedAt = new Date().toISOString();
    try {
      await deps.prisma.$queryRaw`SELECT 1`;
      return { status: "ready", checkedAt };
    } catch {
      reply.code(503);
      return { status: "unavailable", checkedAt };
    }
  });
}
