import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "contracts/middleware-runtime-current.openapi.json";
const outputPath = "contracts/openapi/codestra-middleware-client.openapi.json";
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const paths = {};

for (const [path, item] of Object.entries(source.paths ?? {})) {
  if (isApprovedClientPath(path)) paths[path] = withTypedSdkErrors(path, item);
}

const components = structuredClone(source.components ?? {});
components.schemas ??= {};
components.schemas.CodestraSdkError = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        request_id: { type: "string" },
        correlation_id: { type: "string" },
        operation_id: { type: "string" },
        retryable: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
};

const output = {
  openapi: source.openapi,
  info: {
    title: "Codestra Middleware SDK Client API",
    version: source.info.version,
    description: "Generated SDK-facing subset of the pinned canonical Middleware runtime contract.",
    license: { name: "Proprietary" },
  },
  servers: [{ url: "https://api.codestra.co" }],
  "x-codestra-generated-from": source["x-codestra-source-authority"],
  paths,
  components,
  security: [{ bearerAuth: [] }],
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated ${Object.keys(paths).length} approved Middleware SDK path items.`);

function isApprovedClientPath(path) {
  if (["/health", "/readiness", "/version", "/dependencies", "/capabilities"].includes(path)) return true;
  if (/^\/v1\/operations(?:\/\{[^}]+\}\/(?:cancel|reconcile))?$/u.test(path)) return true;
  if ([
    "/v1/communications/messages",
    "/v1/communications/messages/{messageId}",
    "/v1/communications/messages/{messageId}/events",
    "/v1/communications/messages/{messageId}/cancel",
    "/v1/communications/provider-health",
    "/v1/communications/usage",
    "/v1/communications/reputation",
  ].includes(path)) return true;
  if (path.startsWith("/v1/operations-dashboard/")) return true;
  if (/^\/v1\/(?:marketing|ai|crm|odoo|social|telephony)\/(?:commands|operations(?:\/\{[^}]+\}(?:\/(?:cancel|reconcile))?)?)$/u.test(path)) return true;
  return /^\/v1\/integrations\/n8n\/(?:commands|operations(?:\/\{[^}]+\}(?:\/(?:cancel|reconcile))?)?)$/u.test(path);
}

function withTypedSdkErrors(path, pathItem) {
  const output = structuredClone(pathItem);
  for (const operation of Object.values(output)) {
    if (!operation?.responses) continue;
    if (["/health", "/readiness", "/version", "/dependencies", "/capabilities"].includes(path)) operation.security = [];
    for (const [status, response] of Object.entries(operation.responses)) {
      if (!/^[45]/u.test(status) || response.content !== undefined) continue;
      response.content = {
        "application/json": { schema: { $ref: "#/components/schemas/CodestraSdkError" } },
      };
    }
  }
  return output;
}
