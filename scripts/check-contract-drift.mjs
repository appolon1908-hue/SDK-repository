import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const [basePath, currentPath = "contracts/openapi/codestra-public.openapi.yaml"] = process.argv.slice(2);
if (!basePath) {
  console.error("Usage: node scripts/check-contract-drift.mjs <base-openapi.yaml> [current-openapi.yaml]");
  process.exit(2);
}

const base = parse(await readFile(basePath, "utf8"));
const current = parse(await readFile(currentPath, "utf8"));
const failures = [];
const methods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

for (const [path, basePathItem] of Object.entries(base.paths ?? {})) {
  const currentPathItem = current.paths?.[path];
  if (!currentPathItem) {
    failures.push(`removed path: ${path}`);
    continue;
  }
  for (const method of methods) {
    const baseOperation = basePathItem?.[method];
    if (!baseOperation) continue;
    const currentOperation = currentPathItem?.[method];
    if (!currentOperation) {
      failures.push(`removed operation: ${method.toUpperCase()} ${path}`);
      continue;
    }
    for (const responseCode of Object.keys(baseOperation.responses ?? {})) {
      if (!(responseCode in (currentOperation.responses ?? {}))) {
        failures.push(`removed response ${responseCode}: ${method.toUpperCase()} ${path}`);
      }
    }
  }
}

const baseSchemas = base.components?.schemas ?? {};
const currentSchemas = current.components?.schemas ?? {};
for (const [schemaName, baseSchema] of Object.entries(baseSchemas)) {
  const currentSchema = currentSchemas[schemaName];
  if (!currentSchema) {
    failures.push(`removed schema: ${schemaName}`);
    continue;
  }
  compareSchema(`components.schemas.${schemaName}`, baseSchema, currentSchema, failures);
}

if (failures.length > 0) {
  console.error("Breaking contract drift detected:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("No breaking OpenAPI drift detected.");

function compareSchema(path, before, after, output) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return;
  const beforeEnum = Array.isArray(before.enum) ? before.enum : undefined;
  const afterEnum = Array.isArray(after.enum) ? after.enum : undefined;
  if (beforeEnum && afterEnum) {
    for (const value of beforeEnum) {
      if (!afterEnum.includes(value)) output.push(`removed enum value ${JSON.stringify(value)} at ${path}`);
    }
  }
  const beforeProperties = before.properties ?? {};
  const afterProperties = after.properties ?? {};
  for (const [property, definition] of Object.entries(beforeProperties)) {
    if (!(property in afterProperties)) output.push(`removed property ${path}.${property}`);
    else compareSchema(`${path}.${property}`, definition, afterProperties[property], output);
  }
  const beforeRequired = new Set(before.required ?? []);
  for (const property of after.required ?? []) {
    if (!beforeRequired.has(property)) output.push(`new required property ${path}.${property}`);
  }
  if (before.items && after.items) compareSchema(`${path}[]`, before.items, after.items, output);
}
