#!/usr/bin/env node
// Regenerates public/api-reference.html from the canonical public OpenAPI
// contract using Redocly's `build-docs`, the same @redocly/cli this repo's
// scripts/validate-contracts.mjs already depends on. Runs before `dev` and
// `build` so the API reference page always reflects the current contract.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(appDir, "..", "..");
const source = join(repoRoot, "contracts", "openapi", "codestra-public.openapi.yaml");
const outDir = join(appDir, "public");
const output = join(outDir, "api-reference.html");

mkdirSync(outDir, { recursive: true });

const command = process.env.npm_execpath ? process.execPath : "pnpm";
const args = process.env.npm_execpath
  ? [process.env.npm_execpath, "exec", "redocly", "build-docs", source, "-o", output, "--title", "Codestra Public API Reference"]
  : ["exec", "redocly", "build-docs", source, "-o", output, "--title", "Codestra Public API Reference"];
const result = spawnSync(
  command,
  args,
  { stdio: "inherit", cwd: repoRoot },
);

if (result.status !== 0) {
  if (result.error) console.error(result.error.message);
  console.error(
    "Failed to generate public/api-reference.html from contracts/openapi/codestra-public.openapi.yaml.",
  );
  process.exit(result.status ?? 1);
}
