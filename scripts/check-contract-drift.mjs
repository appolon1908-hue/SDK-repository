import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Detects breaking changes between a base git ref and the current working
 * tree across every contract this repository owns: all three OpenAPI
 * documents (public, enterprise, restricted-gateway) and the AsyncAPI
 * event catalogue.
 *
 * Earlier versions of this script (a) only ever compared the public
 * OpenAPI document, and (b) diffed the raw YAML structurally without
 * resolving any `$ref` -- so a breaking change routed through a shared
 * `components.schemas` entry, an external file ref, parameters, request
 * bodies, security requirements, or operationId never registered at all.
 * This version bundles both sides with `redocly bundle --dereferenced`
 * first (zero `$ref`s left anywhere) and diffs the fully resolved
 * documents.
 */

const [baseSha] = process.argv.slice(2);
if (!baseSha) {
  console.error("Usage: node scripts/check-contract-drift.mjs <base-git-sha>");
  process.exit(2);
}

const OPENAPI_FILES = [
  "contracts/openapi/codestra-public.openapi.yaml",
  "contracts/openapi/codestra-enterprise.openapi.yaml",
  "contracts/openapi/codestra-restricted-gateway.openapi.yaml",
];
const ASYNCAPI_FILE = "contracts/asyncapi/codestra-events.asyncapi.yaml";
const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

const workDir = await mkdtemp(join(tmpdir(), "codestra-contract-drift-"));
const failures = [];

try {
  const baseDir = join(workDir, "base");
  materializeContractsAtRef(baseSha, baseDir);

  for (const relativePath of OPENAPI_FILES) {
    const baseBundle = bundle(join(baseDir, relativePath), join(workDir, `base-${basename(relativePath)}.json`));
    const currentBundle = bundle(relativePath, join(workDir, `current-${basename(relativePath)}.json`));
    if (baseBundle === undefined || currentBundle === undefined) continue; // file didn't exist on one side; nothing to diff
    diffOpenApi(relativePath, baseBundle, currentBundle, failures);
  }

  const baseAsyncApi = bundle(join(baseDir, ASYNCAPI_FILE), join(workDir, "base-asyncapi.json"));
  const currentAsyncApi = bundle(ASYNCAPI_FILE, join(workDir, "current-asyncapi.json"));
  if (baseAsyncApi !== undefined && currentAsyncApi !== undefined) {
    diffAsyncApi(ASYNCAPI_FILE, baseAsyncApi, currentAsyncApi, failures);
  }
} finally {
  await rm(workDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`Breaking contract drift detected against ${baseSha}:\n` + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`No breaking drift detected in any contract against ${baseSha}.`);

function basename(relativePath) {
  return relativePath.replace(/[\\/]/g, "_");
}

function materializeContractsAtRef(ref, destination) {
  const archive = spawnSync("git", ["archive", ref, "--", "contracts"], { encoding: "buffer", maxBuffer: 50 * 1024 * 1024 });
  if (archive.status !== 0) {
    throw new Error(`Failed to materialize contracts/ at ${ref}: ${archive.stderr?.toString() ?? "unknown error"}`);
  }
  const tar = spawnSync("tar", ["-x", "-C", ensureDir(destination)], { input: archive.stdout });
  if (tar.status !== 0) {
    throw new Error(`Failed to extract contracts/ at ${ref}: ${tar.stderr?.toString() ?? "unknown error"}`);
  }
}

function ensureDir(path) {
  spawnSync("mkdir", ["-p", path]);
  return path;
}

/** Returns the parsed, fully dereferenced bundle, or undefined if the source file does not exist. */
function bundle(sourcePath, outputPath) {
  const result = spawnSync("pnpm", ["exec", "redocly", "bundle", sourcePath, "--output", outputPath, "--ext", "json", "--dereferenced"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, REDOCLY_TELEMETRY: "off", REDOCLY_SUPPRESS_UPDATE_NOTICE: "true" },
  });
  if (result.status !== 0) {
    if (/does not exist/i.test(result.stdout ?? "") || /ENOENT/.test(result.stderr ?? "")) return undefined;
    throw new Error(`redocly bundle failed for ${sourcePath}:\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`);
  }
  return JSON.parse(readFileSyncOrThrow(outputPath));
}

function readFileSyncOrThrow(path) {
  const result = spawnSync("cat", [path], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Failed to read bundled output at ${path}`);
  return result.stdout;
}

function diffOpenApi(file, base, current, output) {
  for (const [path, basePathItem] of Object.entries(base.paths ?? {})) {
    const currentPathItem = current.paths?.[path];
    if (!currentPathItem) {
      output.push(`[${file}] removed path: ${path}`);
      continue;
    }
    for (const method of METHODS) {
      const baseOperation = basePathItem?.[method];
      if (!baseOperation) continue;
      const currentOperation = currentPathItem?.[method];
      const label = `${method.toUpperCase()} ${path}`;
      if (!currentOperation) {
        output.push(`[${file}] removed operation: ${label}`);
        continue;
      }
      diffOperation(file, label, baseOperation, currentOperation, base.security, current.security, output);
    }
  }
}

function diffOperation(file, label, base, current, documentBaseSecurity, documentCurrentSecurity, output) {
  if (base.operationId && current.operationId && base.operationId !== current.operationId) {
    output.push(`[${file}] operationId changed for ${label}: ${base.operationId} -> ${current.operationId}`);
  }

  for (const responseCode of Object.keys(base.responses ?? {})) {
    const baseResponse = base.responses[responseCode];
    const currentResponse = current.responses?.[responseCode];
    if (!currentResponse) {
      output.push(`[${file}] removed response ${responseCode}: ${label}`);
      continue;
    }
    for (const mediaType of Object.keys(baseResponse.content ?? {})) {
      const baseSchema = baseResponse.content[mediaType]?.schema;
      const currentSchema = currentResponse.content?.[mediaType]?.schema;
      if (baseResponse.content[mediaType] && !currentResponse.content?.[mediaType]) {
        output.push(`[${file}] removed response media type ${mediaType} for ${responseCode} ${label}`);
        continue;
      }
      if (baseSchema && currentSchema) compareSchema(`${label} responses.${responseCode}.${mediaType}`, baseSchema, currentSchema, output, file);
    }
  }

  const baseParams = new Map((base.parameters ?? []).map((parameter) => [`${parameter.in}:${parameter.name}`, parameter]));
  const currentParams = new Map((current.parameters ?? []).map((parameter) => [`${parameter.in}:${parameter.name}`, parameter]));
  for (const [key, baseParam] of baseParams) {
    const currentParam = currentParams.get(key);
    if (!currentParam) {
      output.push(`[${file}] removed parameter ${key} on ${label}`);
      continue;
    }
    if (!baseParam.required && currentParam.required) {
      output.push(`[${file}] parameter ${key} on ${label} became required`);
    }
    if (baseParam.schema && currentParam.schema) compareSchema(`${label} parameters.${key}`, baseParam.schema, currentParam.schema, output, file);
  }
  for (const [key, currentParam] of currentParams) {
    if (!baseParams.has(key) && currentParam.required) {
      output.push(`[${file}] new required parameter ${key} on ${label}`);
    }
  }

  const baseBody = base.requestBody;
  const currentBody = current.requestBody;
  if (baseBody) {
    if (!currentBody) {
      output.push(`[${file}] removed request body on ${label}`);
    } else {
      if (!baseBody.required && currentBody.required) output.push(`[${file}] request body on ${label} became required`);
      for (const mediaType of Object.keys(baseBody.content ?? {})) {
        if (!currentBody.content?.[mediaType]) {
          output.push(`[${file}] removed request media type ${mediaType} on ${label}`);
          continue;
        }
        const baseSchema = baseBody.content[mediaType]?.schema;
        const currentSchema = currentBody.content[mediaType]?.schema;
        if (baseSchema && currentSchema) compareSchema(`${label} requestBody.${mediaType}`, baseSchema, currentSchema, output, file);
      }
    }
  }

  // Per OpenAPI semantics, an operation's own `security` (even an empty
  // array, meaning explicitly no auth) overrides the document root; only
  // an operation that omits `security` entirely inherits the root's.
  // None of this repo's operations declare it per-operation today, so
  // without this fallback every comparison here was silently comparing
  // two empty arrays -- verified: this is exactly why the check never
  // fired against a real document.
  const baseSecurity = base.security ?? documentBaseSecurity ?? [];
  const currentSecurity = current.security ?? documentCurrentSecurity ?? [];
  const baseSchemes = new Set(baseSecurity.flatMap((requirement) => Object.keys(requirement)));
  const currentSchemes = new Set(currentSecurity.flatMap((requirement) => Object.keys(requirement)));
  for (const scheme of currentSchemes) {
    if (!baseSchemes.has(scheme)) output.push(`[${file}] ${label} now requires security scheme not previously required: ${scheme}`);
  }
}

function diffAsyncApi(file, base, current, output) {
  for (const [channelName, baseChannel] of Object.entries(base.channels ?? {})) {
    const currentChannel = current.channels?.[channelName];
    if (!currentChannel) {
      output.push(`[${file}] removed channel: ${channelName}`);
      continue;
    }
    for (const [messageName, baseMessage] of Object.entries(baseChannel.messages ?? {})) {
      const currentMessage = currentChannel.messages?.[messageName];
      if (!currentMessage) {
        output.push(`[${file}] removed message ${messageName} on channel ${channelName}`);
        continue;
      }
      if (baseMessage.payload && currentMessage.payload) {
        compareSchema(`channel ${channelName} message ${messageName} payload`, baseMessage.payload, currentMessage.payload, output, file);
      }
    }
  }
  for (const operationName of Object.keys(base.operations ?? {})) {
    if (!current.operations?.[operationName]) output.push(`[${file}] removed operation: ${operationName}`);
  }
}

/**
 * Flattens allOf composition into a single merged {properties, required}
 * view -- valid because every allOf branch's constraints apply
 * simultaneously. oneOf/anyOf are deliberately NOT flattened here: they
 * are alternatives, not a union, so merging them the same way as allOf
 * would erase which branch is which -- e.g. a `oneOf [receiptSchema,
 * {type: "null"}]` response would flatten to just receiptSchema's
 * properties, silently accepting the removal of the null alternative
 * (making the response no longer nullable) as a no-op. See
 * compareAlternatives, which handles oneOf/anyOf on their own terms.
 */
function flattenComposedSchema(schema, properties = {}, required = new Set()) {
  if (!schema || typeof schema !== "object") return { properties, required };
  for (const [name, definition] of Object.entries(schema.properties ?? {})) properties[name] = definition;
  for (const name of schema.required ?? []) required.add(name);
  for (const branch of schema.allOf ?? []) {
    flattenComposedSchema(branch, properties, required);
  }
  return { properties, required };
}

/**
 * oneOf/anyOf branches are alternatives: each base branch must still have
 * a structurally equivalent branch on the current side, or a valid shape
 * that used to be accepted no longer is (e.g. removing a `{type: "null"}`
 * branch means the field is no longer nullable). Branches are matched by
 * a coarse signature (type/const/required keys) rather than deep
 * equality -- enough to catch a branch disappearing outright without
 * needing full JSON Schema equivalence.
 */
function compareAlternatives(path, keyword, beforeBranches, afterBranches, output, file) {
  if (!Array.isArray(beforeBranches) || !Array.isArray(afterBranches)) return;
  const afterSignatures = new Set(afterBranches.map(branchSignature));
  for (const branch of beforeBranches) {
    if (!afterSignatures.has(branchSignature(branch))) {
      output.push(`[${file}] removed ${keyword} alternative at ${path}: ${branchSignature(branch)}`);
    }
  }
}

function branchSignature(branch) {
  if (!branch || typeof branch !== "object") return JSON.stringify(branch);
  return JSON.stringify({
    type: branch.type,
    const: branch.const,
    required: Array.isArray(branch.required) ? [...branch.required].sort() : undefined,
  });
}

function compareSchema(path, before, after, output, file) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return;

  if (before.type !== undefined && after.type !== undefined && !typesEquivalent(before.type, after.type)) {
    output.push(`[${file}] type changed at ${path}: ${JSON.stringify(before.type)} -> ${JSON.stringify(after.type)}`);
  }
  if (before.format !== undefined && after.format !== undefined && before.format !== after.format) {
    output.push(`[${file}] format changed at ${path}: ${before.format} -> ${after.format}`);
  }
  if (before.additionalProperties !== false && after.additionalProperties === false) {
    output.push(`[${file}] additionalProperties newly restricted to false at ${path}`);
  }

  const beforeEnum = Array.isArray(before.enum) ? before.enum : undefined;
  const afterEnum = Array.isArray(after.enum) ? after.enum : undefined;
  if (beforeEnum && afterEnum) {
    for (const value of beforeEnum) {
      if (!afterEnum.includes(value)) output.push(`[${file}] removed enum value ${JSON.stringify(value)} at ${path}`);
    }
  }

  const beforeFlat = flattenComposedSchema(before);
  const afterFlat = flattenComposedSchema(after);
  for (const [property, definition] of Object.entries(beforeFlat.properties)) {
    if (!(property in afterFlat.properties)) output.push(`[${file}] removed property ${path}.${property}`);
    else compareSchema(`${path}.${property}`, definition, afterFlat.properties[property], output, file);
  }
  for (const property of afterFlat.required) {
    if (!beforeFlat.required.has(property)) output.push(`[${file}] new required property ${path}.${property}`);
  }

  compareAlternatives(path, "oneOf", before.oneOf, after.oneOf, output, file);
  compareAlternatives(path, "anyOf", before.anyOf, after.anyOf, output, file);

  if (before.items && after.items) compareSchema(`${path}[]`, before.items, after.items, output, file);
}

function typesEquivalent(before, after) {
  const normalize = (value) => (Array.isArray(value) ? [...value].sort() : [value]);
  const a = normalize(before);
  const b = normalize(after);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
