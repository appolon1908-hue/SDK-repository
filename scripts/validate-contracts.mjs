import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const requiredFiles = [
  "contracts/openapi/codestra-public.openapi.yaml",
  "contracts/openapi/codestra-enterprise.openapi.yaml",
  "contracts/asyncapi/codestra-events.asyncapi.yaml",
];

const failures = [];

for (const path of requiredFiles) {
  const source = await readFile(path, "utf8");
  if (!source.endsWith("\n")) failures.push(`${path}: missing final newline`);
  if (path.includes("openapi") && !source.startsWith("openapi: 3.1.0\n")) {
    failures.push(`${path}: expected OpenAPI 3.1.0`);
  }
  if (path.includes("asyncapi") && !source.startsWith("asyncapi: 3.0.0\n")) {
    failures.push(`${path}: expected AsyncAPI 3.0.0`);
  }
  for (const forbidden of ["example.com", "changeme", "TODO_SECRET", "Bearer eyJ"]) {
    if (source.includes(forbidden)) failures.push(`${path}: contains forbidden placeholder or credential material: ${forbidden}`);
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    if (entry.isFile() && extname(entry.name) === ".json") {
      try {
        const document = JSON.parse(await readFile(path, "utf8"));
        if (path.includes("contracts/schemas") && typeof document.$schema !== "string") {
          failures.push(`${path}: JSON Schema must declare $schema`);
        }
      } catch (error) {
        failures.push(`${path}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

await walk("contracts/schemas");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Contract structure validation passed.");
}
