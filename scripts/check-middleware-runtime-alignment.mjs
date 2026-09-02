import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const runtimePath = process.env.MIDDLEWARE_RUNTIME_CONTRACT ?? "contracts/middleware-runtime-current.openapi.json";
const authorityPath = process.env.MIDDLEWARE_RUNTIME_AUTHORITY ?? "contracts/middleware-runtime-current.source.json";
const sdkContracts = process.env.MIDDLEWARE_SDK_CONTRACTS?.split(",") ?? [
  "contracts/openapi/codestra-middleware-client.openapi.json",
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
if (!/^[0-9a-f]{64}$/.test(authority.source_sha256)) failures.push("authority source_sha256 must be a 64-character lowercase SHA-256");
const embedded = runtime["x-codestra-source-authority"];
if (embedded?.repository !== authority.repository) failures.push("runtime snapshot repository identity differs from its authority pin");
if (embedded?.source_sha !== authority.source_sha) failures.push("runtime snapshot source SHA differs from its authority pin");
if (embedded?.source_path !== authority.source_path) failures.push("runtime snapshot source path differs from its authority pin");
if (embedded?.source_sha256 !== authority.source_sha256) failures.push("runtime snapshot digest differs from its authority pin");

const normalized = structuredClone(runtime);
delete normalized["x-codestra-source-authority"];
const canonicalBytes = `${JSON.stringify(normalized, null, 2)}\n`;
const canonicalDigest = createHash("sha256").update(canonicalBytes).digest("hex");
if (authority.source_sha256 !== canonicalDigest) failures.push("runtime snapshot content digest does not match the independently pinned source digest");

const runtimeOperations = operationMap(runtime);
const declaredSdkOperations = new Map();
const declaredSdkOperationOccurrences = [];
let generatedClientDocument;
for (const file of sdkContracts) {
  const document = parse(await readFile(file, "utf8"));
  if (file.endsWith("codestra-middleware-client.openapi.json")) generatedClientDocument = document;
  for (const [key, operation] of operationMap(document)) {
    declaredSdkOperationOccurrences.push([key, { ...operation, file, document }]);
    if (!declaredSdkOperations.has(key)) declaredSdkOperations.set(key, { ...operation, file, document });
  }
}
const sdkOperations = declaredSdkOperations;

// Contracts in this list are asserted to describe the canonical Middleware
// runtime. Provider gateway contracts are deliberately excluded: they are
// independently owned server-only APIs and are never browser SDK routes.
const requiredSdkOperations = new Set([
  "GET /health",
  "GET /readiness",
  "GET /version",
  "GET /dependencies",
  "GET /capabilities",
  "GET /v1/operations",
  "GET /v1/operations/{command_id}",
  "POST /v1/operations/{command_id}/cancel",
  "POST /v1/operations/{command_id}/reconcile",
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
  "GET /v1/operations-dashboard/tenants/{tenant_id}",
  ...["marketing", "ai", "crm", "odoo", "social", "telephony"].flatMap((domain) => [
    `POST /v1/${domain}/commands`,
    `GET /v1/${domain}/operations`,
    `GET /v1/${domain}/operations/{operation_id}`,
    `POST /v1/${domain}/operations/{operation_id}/cancel`,
    `POST /v1/${domain}/operations/{operation_id}/reconcile`,
  ]),
  "POST /v1/integrations/n8n/commands",
  "GET /v1/integrations/n8n/operations",
  "GET /v1/integrations/n8n/operations/{operation_id}",
  "POST /v1/integrations/n8n/operations/{operation_id}/cancel",
  "POST /v1/integrations/n8n/operations/{operation_id}/reconcile",
].map((entry) => entry.replace(/ (\/.*)$/u, (_, path) => ` ${normalizePath(path)}`)));

const generatedClientOperations = operationMap(generatedClientDocument ?? {});
for (const key of requiredSdkOperations) {
  if (!sdkOperations.has(key)) failures.push(`SDK_ROUTE_MISSING: ${key}`);
  if (!runtimeOperations.has(key)) failures.push(`RUNTIME_ROUTE_MISSING: ${key}`);
  if (!generatedClientOperations.has(key)) failures.push(`SDK_GENERATED_ROUTE_MISSING: ${key}`);
}

if (JSON.stringify(generatedClientDocument?.["x-codestra-generated-from"]) !== JSON.stringify(embedded)) {
  failures.push("SDK generated client contract authority does not match the pinned runtime snapshot");
}
for (const key of generatedClientOperations.keys()) {
  if (!requiredSdkOperations.has(key)) failures.push(`SDK_PRIVATE_ROUTE_EXPOSED: ${key}`);
}

for (const [key, sdk] of declaredSdkOperationOccurrences) {
  if (!requiredSdkOperations.has(key)) continue;
  const runtimeOperation = runtimeOperations.get(key);
  if (!runtimeOperation) continue;
  compareOperation(key, runtimeOperation, runtime, sdk, sdk.document, failures);
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

function compareOperation(key, runtimeOperation, runtimeDocument, sdkOperation, sdkDocument, output) {
  const runtimeParameters = parameterMap(runtimeOperation.parameters ?? [], runtimeDocument);
  const sdkParameters = parameterMap(sdkOperation.parameters ?? [], sdkDocument);
  for (const [parameterKey, parameter] of runtimeParameters) {
    if (parameter.required && !sdkParameters.get(parameterKey)?.required) {
      output.push(`HEADER_MISMATCH: ${key} is missing required runtime parameter ${parameterKey}`);
    }
  }

  const runtimeBody = resolve(runtimeOperation.requestBody, runtimeDocument);
  const sdkBody = resolve(sdkOperation.requestBody, sdkDocument);
  if (runtimeBody?.required && !sdkBody?.required) output.push(`REQUEST_SCHEMA_MISMATCH: ${key} request body must be required`);
  const runtimeSchema = resolve(runtimeBody?.content?.["application/json"]?.schema, runtimeDocument);
  const sdkSchema = resolve(sdkBody?.content?.["application/json"]?.schema, sdkDocument);
  for (const property of runtimeSchema?.required ?? []) {
    if (!(sdkSchema?.required ?? []).includes(property)) output.push(`REQUEST_SCHEMA_MISMATCH: ${key} omits required property ${property}`);
  }

  const runtimeSuccess = Object.keys(runtimeOperation.responses ?? {}).filter((status) => /^2/u.test(status));
  const sdkSuccess = new Set(Object.keys(sdkOperation.responses ?? {}).filter((status) => /^2/u.test(status)));
  if (!runtimeSuccess.some((status) => sdkSuccess.has(status))) {
    output.push(`RESPONSE_SCHEMA_MISMATCH: ${key} runtime success ${runtimeSuccess.join("/")} is absent from SDK responses`);
  }
  for (const status of runtimeSuccess.filter((entry) => sdkSuccess.has(entry))) {
    const runtimeResponse = resolve(runtimeOperation.responses?.[status], runtimeDocument);
    const sdkResponse = resolve(sdkOperation.responses?.[status], sdkDocument);
    for (const [mediaType, sdkMedia] of Object.entries(sdkResponse?.content ?? {})) {
      const runtimeMedia = runtimeResponse?.content?.[mediaType];
      if (!runtimeMedia) {
        output.push(`RESPONSE_SCHEMA_MISMATCH: ${key} ${status} omits SDK media type ${mediaType} at runtime`);
        continue;
      }
      const runtimeSchema = resolve(runtimeMedia.schema, runtimeDocument);
      const sdkSchema = resolve(sdkMedia?.schema, sdkDocument);
      for (const property of sdkSchema?.required ?? []) {
        if (!(runtimeSchema?.required ?? []).includes(property)) {
          output.push(`RESPONSE_SCHEMA_MISMATCH: ${key} ${status} does not guarantee SDK property ${property}`);
        }
      }
    }
  }

  const runtimeAuth = authKinds(runtimeOperation.security, runtimeDocument);
  const sdkAuth = authKinds(sdkOperation.security, sdkDocument);
  if (runtimeAuth.has("bearer") && !sdkAuth.has("bearer")) output.push(`AUTH_MISMATCH: ${key} does not declare bearer/OIDC authentication`);

  const runtimeErrors = Object.keys(runtimeOperation.responses ?? {}).filter((status) => /^[45]/u.test(status));
  const sdkHasErrorContract = runtimeErrors.some((status) => {
    const response = sdkOperation.responses?.[status] ?? sdkOperation.responses?.default;
    const resolved = resolve(response, sdkDocument);
    return Object.values(resolved?.content ?? {}).some((media) => {
      const schema = resolve(media?.schema, sdkDocument);
      return schema?.type === "object" || schema?.properties !== undefined || schema?.oneOf !== undefined || schema?.anyOf !== undefined;
    });
  });
  if (runtimeErrors.length && !sdkHasErrorContract) output.push(`ERROR_SCHEMA_MISMATCH: ${key} has no typed SDK error contract`);
}

function parameterMap(parameters, document) {
  return new Map(parameters.map((entry) => {
    const parameter = resolve(entry, document);
    const location = String(parameter?.in).toLowerCase();
    const name = location === "path" ? "{}" : String(parameter?.name).toLowerCase();
    return [`${location}:${name}`, parameter];
  }));
}

function resolve(value, document) {
  if (!value?.$ref?.startsWith("#/")) return value;
  return value.$ref.slice(2).split("/").reduce((current, segment) => current?.[segment.replace(/~1/gu, "/").replace(/~0/gu, "~")], document);
}

function authKinds(security, document) {
  const kinds = new Set();
  for (const requirement of security ?? document.security ?? []) {
    for (const name of Object.keys(requirement)) {
      const scheme = document.components?.securitySchemes?.[name];
      if (scheme?.type === "openIdConnect" || (scheme?.type === "http" && scheme?.scheme === "bearer")) kinds.add("bearer");
    }
  }
  return kinds;
}
