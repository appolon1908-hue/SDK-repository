import { execFileSync } from "node:child_process";

/**
 * Vitest global setup: applies Prisma migrations to the real Postgres
 * database under test before any test file runs. Requires DATABASE_URL to
 * point at a reachable, disposable Postgres instance — see
 * services/middleware/README.md for the docker-compose/testcontainers
 * options and services/middleware/.env.example for the shape.
 */
export default function setup(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required to run services/middleware's integration tests against a real Postgres instance.",
    );
  }
  execFileSync("node_modules/.bin/prisma", ["migrate", "deploy"], {
    cwd: new URL("../../", import.meta.url).pathname,
    stdio: "inherit",
    env: process.env,
  });
}
