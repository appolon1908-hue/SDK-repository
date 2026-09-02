import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const [sourcePath] = process.argv.slice(2);
if (!sourcePath) {
  console.error("Usage: node scripts/import-middleware-runtime-contract.mjs <openapi-json>");
  process.exit(2);
}

const authority = JSON.parse(await readFile("contracts/middleware-runtime-current.source.json", "utf8"));
const sourceRepository = git(["-C", dirname(sourcePath), "rev-parse", "--show-toplevel"]);
const sourceRevision = git(["-C", sourceRepository, "rev-parse", "HEAD"]);
const sourceRemote = git(["-C", sourceRepository, "remote", "get-url", "origin"])
  .replace(/\.git$/u, "")
  .replace(/^git@github\.com:/u, "https://github.com/");
if (sourceRevision !== authority.source_sha) {
  throw new Error(`Source checkout is ${sourceRevision}; expected ${authority.source_sha}.`);
}
if (sourceRemote !== authority.repository) {
  throw new Error(`Source checkout repository is ${sourceRemote}; expected ${authority.repository}.`);
}
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

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}
