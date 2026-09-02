import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [sourcePath] = process.argv.slice(2);
if (!sourcePath) {
  console.error("Usage: node scripts/import-middleware-runtime-contract.mjs <openapi-json>");
  process.exit(2);
}

const authority = JSON.parse(await readFile("contracts/middleware-runtime-current.source.json", "utf8"));
const raw = await readFile(sourcePath, "utf8");
const document = JSON.parse(raw);

if (document.openapi !== "3.1.0") throw new Error("Canonical Middleware contract must use OpenAPI 3.1.0.");
if (document.info?.title !== "Codestra Middleware API") throw new Error("Unexpected Middleware contract identity.");

const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
const operationCount = Object.values(document.paths ?? {}).reduce(
  (count, item) => count + Object.keys(item).filter((key) => methods.has(key)).length,
  0,
);
if (operationCount !== 116) {
  throw new Error(`Expected 116 registered operations at ${authority.source_sha}; found ${operationCount}.`);
}

const canonicalBytes = `${JSON.stringify(document, null, 2)}\n`;
document["x-codestra-source-authority"] = {
  repository: authority.repository,
  source_sha: authority.source_sha,
  source_path: authority.source_path,
  source_sha256: createHash("sha256").update(canonicalBytes).digest("hex"),
};

await writeFile("contracts/middleware-runtime-current.openapi.json", `${JSON.stringify(document, null, 2)}\n`);
console.log(`Imported ${operationCount} Middleware operations from ${authority.source_sha}.`);
