import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/support/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // These tests write real rows to a shared real Postgres database and
    // assert on exact tenant-scoped result sets, so test files must not run
    // concurrently against it.
    fileParallelism: false,
  },
});
