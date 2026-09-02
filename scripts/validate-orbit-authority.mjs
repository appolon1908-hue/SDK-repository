import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const failures = [];
const requiredExports = [
  "./orbit",
  "./orbit/styles",
  "./orbit/tokens.css",
  "./orbit/themes.css",
  "./orbit/base.css",
  "./orbit/components.css",
  "./orbit/auth.css",
  "./orbit/footer.css",
  "./horizon",
  "./horizon/styles",
];
const exactTokens = new Map([
  ["--cx-canvas", "#000000"],
  ["--cx-surface-primary", "#101010"],
  ["--cx-surface-elevated", "#171717"],
  ["--cx-surface-secondary", "#202020"],
  ["--cx-text-main", "#ffffff"],
  ["--cx-text-supporting", "#d8d8d8"],
  ["--cx-text-muted", "#9a9a9a"],
  ["--cx-border-default", "#353535"],
  ["--cx-border-strong", "#5a5a5a"],
  ["--cx-action-primary-bg", "#ffffff"],
  ["--cx-action-primary-text", "#000000"],
  ["--cx-action-primary-hover", "#e7e7e7"],
  ["--cx-action-primary-active", "#cccccc"],
  ["--cx-success", "#36c98f"],
  ["--cx-warning", "#f4b860"],
  ["--cx-error", "#ff6469"],
  ["--cx-information", "#79b8ff"],
  ["--cx-header-desktop", "76px"],
  ["--cx-header-tablet", "64px"],
  ["--cx-header-mobile", "56px"],
  ["--cx-control-standard", "52px"],
  ["--cx-control-compact", "44px"],
  ["--cx-auth-width", "480px"],
  ["--cx-radius-default", "2px"],
  ["--cx-radius-maximum", "6px"],
  ["--cx-social-icon-size", "20px"],
  ["--cx-social-target-size", "44px"],
  ["--cx-content-main", "1280px"],
  ["--cx-content-wide", "1440px"],
  ["--cx-content-text", "720px"],
]);
const requiredPaths = [
  "/api/v1/brands/{brand}/shell",
  "/api/v1/brands/{brand}/footer",
  "/api/v1/brands/{brand}/pages/{page_key}",
  "/api/v1/assets/{asset_id}",
  "/api/v1/admin/brands/{brand}/footer",
  "/api/v1/admin/brands/{brand}/footer/publish",
  "/api/v1/admin/brands/{brand}/footer/rollback",
  "/api/v1/admin/brands/{brand}/pages/{page_key}",
  "/api/v1/admin/brands/{brand}/pages/{page_key}/publish",
  "/api/v1/admin/brands/{brand}/pages/{page_key}/rollback",
];
const mutationParameters = new Set([
  "#/components/parameters/IdempotencyKey",
  "#/components/parameters/CorrelationId",
  "#/components/parameters/ExpectedResourceVersion",
  "#/components/parameters/SafeReason",
]);

const read = async (path) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    failures.push(`${path}: cannot read: ${error instanceof Error ? error.message : String(error)}`);
    return "";
  }
};

const parseJson = async (path) => {
  const source = await read(path);
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`${path}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

const packageDocument = await parseJson("packages/intake-ui/package.json");
if (packageDocument) {
  if (packageDocument.description?.includes("Horizon visual contract")) {
    failures.push("packages/intake-ui/package.json: Horizon remains the declared authority");
  }
  for (const entry of requiredExports) {
    if (!(entry in (packageDocument.exports ?? {}))) {
      failures.push(`packages/intake-ui/package.json: missing export ${entry}`);
    }
  }
  for (const file of ["ORBIT.md", "HORIZON.md"]) {
    if (!(packageDocument.files ?? []).includes(file)) {
      failures.push(`packages/intake-ui/package.json: package files omit ${file}`);
    }
  }
}

const orbitSource = await read("packages/intake-ui/src/orbit.ts");
for (const marker of [
  'ORBIT_CONTRACT_VERSION = "2.0.0"',
  "ORBIT_COLORS",
  "ORBIT_GEOMETRY",
  "ORBIT_FOOTER_VARIANTS",
  "ORBIT_SOCIAL_NETWORKS",
  "OrbitBrandClient",
  "Idempotency-Key",
  "X-Correlation-ID",
  "X-Expected-Resource-Version",
  "X-Safe-Reason",
  "mountOrbitFooter",
  "assertOrbitPageShell",
]) {
  if (!orbitSource.includes(marker)) failures.push(`orbit.ts: missing ${marker}`);
}
if (/starlink|spacex|returnurl/i.test(orbitSource)) {
  failures.push("orbit.ts: external authentication reference is prohibited");
}

const horizonSource = await read("packages/intake-ui/src/horizon.ts");
if (!horizonSource.includes("@deprecated") || !horizonSource.includes('export * from "./orbit.js"')) {
  failures.push("horizon.ts: Horizon must be an explicit Orbit compatibility alias");
}

const tokenSource = await read("packages/intake-ui/styles/orbit/tokens.css");
const tokenValues = new Map();
for (const match of tokenSource.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
  tokenValues.set(match[1].toLowerCase(), match[2].trim().toLowerCase());
}
for (const [name, value] of exactTokens) {
  if (tokenValues.get(name) !== value) failures.push(`tokens.css: ${name} must equal ${value}`);
}

const orbitCssPaths = [
  "packages/intake-ui/styles/orbit/tokens.css",
  "packages/intake-ui/styles/orbit/themes.css",
  "packages/intake-ui/styles/orbit/base.css",
  "packages/intake-ui/styles/orbit/components.css",
  "packages/intake-ui/styles/orbit/auth.css",
  "packages/intake-ui/styles/orbit/footer.css",
  "packages/intake-ui/styles/orbit/index.css",
];
for (const path of orbitCssPaths) {
  const source = await read(path);
  for (const [pattern, label] of [
    [/(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\s*\(/i, "gradient"],
    [/backdrop-filter\s*:/i, "backdrop filter"],
    [/filter\s*:\s*[^;]*(?:blur|drop-shadow)\s*\(/i, "blur/glow filter"],
    [/(?:box|text)-shadow\s*:\s*(?!none\b)/i, "decorative shadow"],
  ]) {
    if (pattern.test(source)) failures.push(`${path}: contains prohibited ${label}`);
  }
  for (const match of source.matchAll(/border-radius\s*:\s*(\d+(?:\.\d+)?)px/gi)) {
    if (Number(match[1]) > 6) failures.push(`${path}: radius exceeds 6px`);
  }
  if (/primary[^\n]*(?:#79b8ff|--cx-information)|(?:#79b8ff|--cx-information)[^\n]*primary/i.test(source)) {
    failures.push(`${path}: informational blue is used as a primary action`);
  }
}

for (const path of [
  "packages/intake-ui/styles/horizon/tokens.css",
  "packages/intake-ui/styles/horizon/themes.css",
  "packages/intake-ui/styles/horizon/base.css",
  "packages/intake-ui/styles/horizon/components.css",
  "packages/intake-ui/styles/horizon/index.css",
]) {
  const source = await read(path);
  if (!source.includes("orbit")) failures.push(`${path}: does not resolve to Orbit compatibility`);
}

for (const schemaPath of [
  "contracts/schemas/orbit-footer.schema.json",
  "contracts/schemas/orbit-page-shell.schema.json",
  "contracts/schemas/orbit-brand-shell.schema.json",
]) {
  const document = await parseJson(schemaPath);
  if (!document) continue;
  if (document.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    failures.push(`${schemaPath}: must use JSON Schema 2020-12`);
  }
  if (!String(document.$id ?? "").startsWith("https://api.codestra.co/schemas/")) {
    failures.push(`${schemaPath}: canonical schema ID is missing`);
  }
  if (document.additionalProperties !== false) {
    failures.push(`${schemaPath}: root must fail closed on additional properties`);
  }
}

const openApiSource = await read("contracts/openapi/codestra-orbit.openapi.yaml");
let openApi;
try {
  openApi = parse(openApiSource);
} catch (error) {
  failures.push(`contracts/openapi/codestra-orbit.openapi.yaml: invalid YAML: ${error instanceof Error ? error.message : String(error)}`);
}
if (openApi) {
  if (openApi.openapi !== "3.1.0") failures.push("Orbit OpenAPI must use 3.1.0");
  if (openApi.info?.version !== "0.1.0") failures.push("Orbit OpenAPI version must match repository contracts");
  if (openApi.servers?.[0]?.url !== "https://api.codestra.co") failures.push("Orbit OpenAPI server is not canonical");
  for (const path of requiredPaths) {
    if (!(path in (openApi.paths ?? {}))) failures.push(`Orbit OpenAPI is missing ${path}`);
  }
  for (const [path, pathItem] of Object.entries(openApi.paths ?? {})) {
    if (!path.startsWith("/api/v1/admin/")) continue;
    for (const method of ["put", "post", "patch", "delete"]) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      const refs = new Set((operation.parameters ?? []).map((item) => item?.$ref).filter(Boolean));
      for (const required of mutationParameters) {
        if (!refs.has(required)) failures.push(`${method.toUpperCase()} ${path}: missing ${required}`);
      }
      if (!operation.requestBody) failures.push(`${method.toUpperCase()} ${path}: requestBody is required`);
    }
  }
}

const orbitDocumentation = await read("packages/intake-ui/ORBIT.md");
for (const marker of [
  "# Codestra Orbit Design System V2",
  "#000000",
  "#FFFFFF",
  "auth-compact",
  "GET /api/v1/brands/{brand}/footer",
  "Idempotency-Key",
  "X-Correlation-ID",
  "X-Expected-Resource-Version",
  "X-Safe-Reason",
  "Starlink",
  "HORIZON_STATUS=DEPRECATED_COMPATIBILITY_ALIAS",
]) {
  if (!orbitDocumentation.includes(marker)) failures.push(`ORBIT.md: missing ${marker}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Codestra Orbit central design authority: PASS");
