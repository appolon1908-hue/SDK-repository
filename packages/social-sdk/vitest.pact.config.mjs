import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/pact/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
