#!/usr/bin/env node
// Regenerates public/api-reference.html from the canonical public OpenAPI
// contract using Redocly's `build-docs`, the same @redocly/cli this repo's
// scripts/validate-contracts.mjs already depends on. Runs before `dev` and
// `build` so the API reference page always reflects the current contract.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(appDir, "..", "..");
const source = join(repoRoot, "contracts", "openapi", "codestra-public.openapi.yaml");
const outDir = join(appDir, "public");
const output = join(outDir, "api-reference.html");
const require = createRequire(import.meta.url);
const redoclyCli = require.resolve("@redocly/cli/bin/cli.js");

mkdirSync(outDir, { recursive: true });

const result = spawnSync(
  process.execPath,
  [redoclyCli, "build-docs", source, "-o", output, "--title", "Codestra Public API Reference"],
  { stdio: "inherit", cwd: repoRoot },
);

if (result.status !== 0) {
  if (result.error !== undefined) console.error(result.error);
  console.error(
    "Failed to generate public/api-reference.html from contracts/openapi/codestra-public.openapi.yaml.",
  );
  process.exit(result.status ?? 1);
}
