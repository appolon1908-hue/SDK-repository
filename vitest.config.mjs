import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    globals: false,
    include: [
      "test/**/*.test.ts",
      "packages/**/test/**/*.test.ts",
      "integrations/**/test/**/*.test.ts",
      "apps/**/test/**/*.test.ts",
      "apps/**/test/**/*.test.tsx",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/test/pact/**",
    ],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "packages/contracts/src/**/*.ts",
        "packages/social-sdk/src/**/*.ts",
        "packages/webhook-sdk/src/**/*.ts",
        "packages/connector-kit/src/**/*.ts",
        "packages/provider-adapters/src/**/*.ts",
        "packages/svix-delivery/src/**/*.ts",
        "integrations/n8n-nodes/src/**/*.ts",
      ],
      exclude: ["**/*.d.ts"],
      // Raised from the pre-remediation baseline (20/15/20/20) to reflect
      // real current coverage (73/61.3/89.49/73 as of this change) with a
      // deliberate margin below actual so normal work doesn't trip CI on
      // minor fluctuation -- while still catching a real regression, like
      // a package losing its test file outright or a large new module
      // landing untested.
      thresholds: {
        statements: 65,
        branches: 55,
        functions: 80,
        lines: 65,
      },
    },
  },
});
