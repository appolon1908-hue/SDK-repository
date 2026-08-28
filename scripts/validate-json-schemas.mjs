import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push("contracts/schemas");

const files = [];
for (const root of roots) await walk(root, files);

const failures = [];
const schemas = [];
const ids = new Map();

for (const path of files.sort()) {
  try {
    const schema = JSON.parse(await readFile(path, "utf8"));
    if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
      failures.push(`${path}: expected JSON Schema Draft 2020-12`);
    }
    if (typeof schema.$id !== "string" || !schema.$id.trim()) {
      failures.push(`${path}: schema must declare a non-empty $id`);
    } else if (ids.has(schema.$id)) {
      failures.push(`${path}: duplicate $id also declared by ${ids.get(schema.$id)}`);
    } else {
      ids.set(schema.$id, path);
    }
    schemas.push({ path, schema });
  } catch (error) {
    failures.push(`${path}: invalid JSON: ${formatError(error)}`);
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
  allowUnionTypes: false,
});
addFormats(ajv);

for (const { path, schema } of schemas) {
  if (typeof schema.$id !== "string" || !schema.$id.trim()) continue;
  try {
    ajv.addSchema(schema, schema.$id);
  } catch (error) {
    failures.push(`${path}: schema registration failed: ${formatError(error)}`);
  }
}

for (const { path, schema } of schemas) {
  if (typeof schema.$id !== "string" || !schema.$id.trim()) continue;
  try {
    if (!ajv.getSchema(schema.$id)) {
      failures.push(`${path}: schema did not compile`);
    }
  } catch (error) {
    failures.push(`${path}: schema compilation failed: ${formatError(error)}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Validated ${schemas.length} JSON Schema document(s) with Ajv Draft 2020-12.`);

async function walk(directory, output) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, output);
    else if (entry.isFile() && extname(entry.name) === ".json") output.push(path);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
