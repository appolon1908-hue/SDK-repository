import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const checks = [
  {
    name: "unresolved OpenAPI reference",
    command: pnpm,
    args: ["exec", "redocly", "lint", "test/fixtures/contracts/invalid-openapi.yaml"],
  },
  {
    name: "invalid AsyncAPI document",
    command: pnpm,
    args: ["exec", "redocly", "lint", "test/fixtures/contracts/invalid-asyncapi.yaml"],
  },
  {
    name: "invalid JSON Schema keyword value",
    command: process.execPath,
    args: ["scripts/validate-json-schemas.mjs", "test/fixtures/contracts/invalid-json-schema"],
  },
];

const failures = [];
for (const check of checks) {
  const result = spawnSync(check.command, check.args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      REDOCLY_TELEMETRY: "off",
      REDOCLY_SUPPRESS_UPDATE_NOTICE: "true",
    },
  });
  if (result.status === 0) {
    failures.push(`${check.name}: invalid fixture was incorrectly accepted`);
  } else {
    console.log(`Rejected negative fixture: ${check.name}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Contract validator negative fixtures passed.");
