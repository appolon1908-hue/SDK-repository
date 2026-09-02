import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const runtimePath = "contracts/middleware-runtime-current.openapi.json";
const authorityPath = "contracts/middleware-runtime-current.source.json";
const sdkContracts = [
  "contracts/openapi/codestra-public.openapi.yaml",
  "contracts/openapi/codestra-enterprise.openapi.yaml",
  "contracts/openapi/codestra-communications.openapi.yaml",
  "contracts/openapi/codestra-operations-dashboard.openapi.yaml",
  "contracts/openapi/codestra-control-plane.openapi.yaml",
];
const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

const authority = JSON.parse(await readFile(authorityPath, "utf8"));
const runtimeRaw = await readFile(runtimePath, "utf8");
const runtime = JSON.parse(runtimeRaw);
const failures = [];

if (!/^[0-9a-f]{40}$/.test(authority.source_sha)) failures.push("authority source_sha must be a 40-character lowercase Git SHA");
const embedded = runtime["x-codestra-source-authority"];
if (embedded?.repository !== authority.repository) failures.push("runtime snapshot repository identity differs from its authority pin");
if (embedded?.source_sha !== authority.source_sha) failures.push("runtime snapshot source SHA differs from its authority pin");
if (embedded?.source_path !== authority.source_path) failures.push("runtime snapshot source path differs from its authority pin");

const normalized = structuredClone(runtime);
delete normalized["x-codestra-source-authority"];
const canonicalBytes = `${JSON.stringify(normalized, null, 2)}\n`;
const canonicalDigest = createHash("sha256").update(canonicalBytes).digest("hex");
if (embedded?.source_sha256 !== canonicalDigest) failures.push("runtime snapshot content digest does not match the pinned source digest");

const runtimeOperations = operationMap(runtime);
const sdkOperations = new Map();
for (const file of sdkContracts) {
  const document = parse(await readFile(file, "utf8"));
  for (const [key, operation] of operationMap(document)) {
    if (!sdkOperations.has(key)) sdkOperations.set(key, { ...operation, file });
  }
}

// Contracts in this list are asserted to describe the canonical Middleware
// runtime. Provider gateway contracts are deliberately excluded: they are
// independently owned server-only APIs and are never browser SDK routes.
const requiredSdkOperations = new Set([
  "GET /v1/operations/{command_id}",
  "GET /v1/communications/messages",
  "POST /v1/communications/messages",
  "GET /v1/communications/messages/{messageId}",
  "GET /v1/communications/messages/{messageId}/events",
  "POST /v1/communications/messages/{messageId}/cancel",
  "GET /v1/communications/provider-health",
  "GET /v1/communications/usage",
  "GET /v1/communications/reputation",
  "GET /v1/operations-dashboard/overview",
  "GET /v1/operations-dashboard/auth-gateway",
  "GET /v1/operations-dashboard/routes",
  "GET /v1/operations-dashboard/providers",
  "GET /v1/operations-dashboard/messages/lifecycle",
  "GET /v1/operations-dashboard/webhooks",
  "GET /v1/operations-dashboard/queues",
  "GET /v1/operations-dashboard/release-gates",
  "GET /v1/operations-dashboard/canaries",
].map((entry) => entry.replace(/ (\/.*)$/u, (_, path) => ` ${normalizePath(path)}`)));

for (const key of requiredSdkOperations) {
  if (!sdkOperations.has(key)) failures.push(`SDK_ROUTE_MISSING: ${key}`);
  if (!runtimeOperations.has(key)) failures.push(`RUNTIME_ROUTE_MISSING: ${key}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`Middleware runtime alignment passed for ${requiredSdkOperations.size} SDK operations against ${authority.source_sha}.`);

function operationMap(document) {
  const output = new Map();
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(item ?? {})) {
      if (methods.has(method)) output.set(`${method.toUpperCase()} ${normalizePath(path)}`, operation);
    }
  }
  return output;
}

function normalizePath(path) {
  return path.replace(/\{[^}]+\}/gu, "{}");
}
