import { loadEnv } from "./env.js";
import { createPrismaClient } from "./db/prisma.js";
import { PrismaIdempotencyStore } from "./idempotency/prisma-store.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  const idempotencyStore = new PrismaIdempotencyStore(prisma);
  const app = await buildServer({ env, prisma, idempotencyStore });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "Shutting down Codestra Middleware");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Codestra Middleware failed to start:", error);
  process.exit(1);
});
