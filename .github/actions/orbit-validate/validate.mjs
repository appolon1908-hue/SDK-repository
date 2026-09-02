#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, relative } from "node:path";

const BRANDS = new Set([
  "codestra",
  "breero",
  "beyvra",
  "moneybee",
  "larim",
  "transportation",
  "telnexa",
  "klyrow",
  "social",
  "restaurant",
  "neutral",
]);
const SURFACES = new Set(["public", "customer", "operator", "admin", "vendor"]);
const HEADER_VARIANTS = new Set(["standard", "compact", "auth"]);
const FOOTER_VARIANTS = new Set(["full", "compact", "auth-compact", "legal-only"]);
const AUTH_MODES = new Set([
  "public-only",
  "same-origin-bff",
  "oidc-pkce",
  "api-session",
  "vendor-native",
]);
const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".mjs",
  ".cjs",
  ".vue",
  ".html",
]);
const CANONICAL_ISSUER = "https://auth.codestra.co/realms/codestra";
const CONTENT_KEY = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){2,}$/;
const ASSET_ID = /^ast_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\s*\(/i;
const PROHIBITED_VISUAL = [
  [/(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\s*\(/i, "gradients are prohibited"],
  [/backdrop-filter\s*:/i, "glass/backdrop filters are prohibited"],
  [/filter\s*:\s*[^;]*(?:blur|drop-shadow)\s*\(/i, "blur and glow filters are prohibited"],
  [/(?:box|text)-shadow\s*:\s*(?!none\b)/i, "decorative shadows are prohibited"],
];
const SOCIAL_HOST = /https:\/\/(?:www\.)?(?:linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com|youtu\.be|tiktok\.com|threads\.net)\//i;
const AUTH_REFERENCE = /starlink|spacex|returnurl|client[_-]?secret|code_challenge|code_verifier/i;

const EXACT_TOKENS = new Map([
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

function parseArgs(argv) {
  const result = {
    root: ".",
    manifest: "orbit/suite.json",
    baseRef: "",
    selfTest: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--self-test") result.selfTest = true;
    else if (value === "--root") result.root = argv[++index];
    else if (value === "--manifest") result.manifest = argv[++index];
    else if (value === "--base-ref") result.baseRef = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return result;
}

const list = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);
const requireRule = (errors, condition, message) => {
  if (!condition) errors.push(message);
};

function readText(root, path, errors, label) {
  if (!path || typeof path !== "string") {
    errors.push(`${label} is required`);
    return "";
  }
  const absolute = join(root, path);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    errors.push(`${label} does not exist: ${path}`);
    return "";
  }
  try {
    return readFileSync(absolute, "utf8");
  } catch {
    errors.push(`${label} must be UTF-8 text: ${path}`);
    return "";
  }
}

function validateHttps(value, label, errors) {
  try {
    const parsed = new URL(value);
    requireRule(
      errors,
      parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password,
      `${label} must be a credential-free absolute HTTPS URL`,
    );
  } catch {
    errors.push(`${label} must be a credential-free absolute HTTPS URL`);
  }
}

function parseCssTokens(source) {
  const values = new Map();
  for (const match of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    values.set(match[1].toLowerCase(), match[2].trim().toLowerCase());
  }
  return values;
}

function validateTokenSource(root, shell, errors, id) {
  const source = readText(root, shell.tokensFile, errors, `${id} shell.tokensFile`);
  if (!source) return;
  if (shell.tokenSource === "package-import") {
    requireRule(
      errors,
      source.includes("@codestra/intake-ui/orbit") || source.includes("styles/orbit"),
      `${id}: package-import tokensFile must import Codestra Orbit`,
    );
    return;
  }
  requireRule(errors, shell.tokenSource === "local-exact", `${id}: shell.tokenSource is invalid`);
  const tokens = parseCssTokens(source);
  for (const [name, value] of EXACT_TOKENS) {
    requireRule(errors, tokens.get(name) === value, `${id}: ${name} must equal ${value}`);
  }
}

function validateShell(root, suite, errors) {
  const id = suite.id ?? "<unknown>";
  const shell = suite.shell;
  if (!shell || typeof shell !== "object" || Array.isArray(shell)) {
    errors.push(`${id}: shell must be an object`);
    return;
  }
  requireRule(errors, HEADER_VARIANTS.has(shell.headerVariant), `${id}: unsupported header variant`);
  requireRule(errors, FOOTER_VARIANTS.has(shell.footerVariant), `${id}: unsupported footer variant`);
  requireRule(errors, typeof shell.socialAllowed === "boolean", `${id}: socialAllowed must be boolean`);
  const rootSource = readText(root, shell.rootFile, errors, `${id} shell.rootFile`);
  requireRule(errors, rootSource.includes("data-orbit-root"), `${id}: rootFile must declare data-orbit-root`);
  requireRule(errors, rootSource.includes("data-orbit-brand"), `${id}: rootFile must declare data-orbit-brand`);
  requireRule(errors, rootSource.includes("data-orbit-header"), `${id}: rootFile must declare data-orbit-header`);
  requireRule(errors, rootSource.includes("data-orbit-footer"), `${id}: rootFile must declare data-orbit-footer`);
  validateTokenSource(root, shell, errors, id);

  const header = readText(root, shell.headerFile, errors, `${id} shell.headerFile`);
  const footer = readText(root, shell.footerFile, errors, `${id} shell.footerFile`);
  requireRule(errors, !AUTH_REFERENCE.test(header), `${id}: header contains prohibited external auth reference`);
  requireRule(errors, !SOCIAL_HOST.test(footer), `${id}: footer hard-codes a social profile URL`);
  requireRule(
    errors,
    footer.includes("/api/v1/brands/") || footer.includes("mountOrbitFooter") || footer.includes("OrbitBrandClient"),
    `${id}: footer must load the Orbit footer resource from the API`,
  );

  const pageRoots = list(shell.pageRoots);
  requireRule(errors, pageRoots.length > 0, `${id}: shell.pageRoots must not be empty`);
  for (const pageRoot of pageRoots) {
    requireRule(errors, existsSync(join(root, pageRoot)), `${id}: page root does not exist: ${pageRoot}`);
  }
}

function validateAuth(root, suite, errors) {
  const id = suite.id ?? "<unknown>";
  const auth = suite.auth;
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) {
    errors.push(`${id}: auth must be an object`);
    return;
  }
  requireRule(errors, AUTH_MODES.has(auth.mode), `${id}: unsupported auth mode`);
  requireRule(errors, typeof auth.protectedRoutes === "boolean", `${id}: protectedRoutes must be boolean`);
  requireRule(errors, auth.browserTokenStorage === "forbidden" || auth.browserTokenStorage === "vendor-managed", `${id}: browser token storage policy is invalid`);

  if (auth.mode === "public-only") {
    requireRule(errors, auth.protectedRoutes === false, `${id}: public-only suite cannot have protected routes`);
    return;
  }

  requireRule(errors, auth.protectedRoutes === true, `${id}: authenticated suite requires protectedRoutes=true`);
  requireRule(errors, auth.backendAuthorizationRequired === true, `${id}: backendAuthorizationRequired must be true`);
  requireRule(errors, typeof auth.loginSourceFile === "string", `${id}: loginSourceFile is required`);
  requireRule(errors, typeof auth.logoutSourceFile === "string", `${id}: logoutSourceFile is required`);
  requireRule(errors, typeof auth.guardSourceFile === "string", `${id}: guardSourceFile is required`);

  const login = readText(root, auth.loginSourceFile, errors, `${id} auth.loginSourceFile`);
  const logout = readText(root, auth.logoutSourceFile, errors, `${id} auth.logoutSourceFile`);
  const guard = readText(root, auth.guardSourceFile, errors, `${id} auth.guardSourceFile`);
  requireRule(errors, !AUTH_REFERENCE.test(login), `${id}: login source contains copied external auth values`);
  requireRule(errors, /login|authorize|oidc/i.test(login), `${id}: login source has no approved auth marker`);
  requireRule(errors, /logout|revoke|end_session/i.test(logout), `${id}: logout source has no revocation marker`);
  requireRule(errors, /guard|middleware|unauthorized|session|redirect|navigate|router/i.test(guard), `${id}: guard source has no fail-closed marker`);

  if (["same-origin-bff", "oidc-pkce", "vendor-native"].includes(auth.mode)) {
    requireRule(
      errors,
      String(auth.issuer ?? "").replace(/\/$/, "") === CANONICAL_ISSUER,
      `${id}: issuer must be ${CANONICAL_ISSUER}`,
    );
    requireRule(errors, auth.durableIdentity === "issuer+subject", `${id}: durable identity must be issuer+subject`);
  }
}

function validateContent(suite, errors) {
  const id = suite.id ?? "<unknown>";
  const content = suite.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    errors.push(`${id}: content must be an object`);
    return;
  }
  requireRule(errors, content.source === "orbit-brand-api", `${id}: content source must be orbit-brand-api`);
  requireRule(errors, content.footerEndpoint === "/api/v1/brands/{brand}/footer", `${id}: footer endpoint is invalid`);
  requireRule(errors, content.pageEndpoint === "/api/v1/brands/{brand}/pages/{page_key}", `${id}: page endpoint is invalid`);
  requireRule(errors, content.assetEndpoint === "/api/v1/assets/{asset_id}", `${id}: asset endpoint is invalid`);
  requireRule(errors, content.stableContentKeys === true, `${id}: stableContentKeys must be true`);
  requireRule(errors, content.assetApiIds === true, `${id}: assetApiIds must be true`);
  requireRule(errors, content.hardcodedSocialUrls === false, `${id}: hardcodedSocialUrls must be false`);
  for (const key of list(content.contentKeys)) {
    requireRule(errors, typeof key === "string" && CONTENT_KEY.test(key), `${id}: invalid content key ${String(key)}`);
  }
  for (const asset of list(content.assetIds)) {
    requireRule(errors, typeof asset === "string" && ASSET_ID.test(asset), `${id}: invalid asset ID ${String(asset)}`);
  }
}

function validateNewPagePolicy(suite, errors) {
  const id = suite.id ?? "<unknown>";
  const policy = suite.newPagePolicy;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    errors.push(`${id}: newPagePolicy must be an object`);
    return;
  }
  for (const key of [
    "inheritsRootShell",
    "declaresHeaderVariant",
    "declaresFooterVariant",
    "declaresSocialPolicy",
    "usesOrbitTokens",
    "requiresStateMatrix",
  ]) {
    requireRule(errors, policy[key] === true, `${id}: newPagePolicy.${key} must be true`);
  }
}

function addedLines(root, baseRef) {
  const diff = execFileSync(
    "git",
    ["-C", root, "diff", "--unified=0", `${baseRef}...HEAD`, "--"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const rows = [];
  let path = "";
  let line = 0;
  for (const value of diff.split("\n")) {
    if (value.startsWith("+++ b/")) {
      path = value.slice(6);
      continue;
    }
    if (value.startsWith("@@")) {
      line = Number(/\+(\d+)/.exec(value)?.[1] ?? 0);
      continue;
    }
    if (value.startsWith("+") && !value.startsWith("+++")) {
      rows.push({ path, line, value: value.slice(1) });
      line += 1;
    } else if (!value.startsWith("-")) {
      line += 1;
    }
  }
  return rows;
}

function validateAddedSource(root, manifest, baseRef, errors) {
  const allowedColorFiles = new Set();
  for (const suite of manifest.suites) {
    if (suite.shell?.tokensFile) allowedColorFiles.add(suite.shell.tokensFile);
    for (const path of list(suite.colorPolicy?.allowedColorFiles)) {
      allowedColorFiles.add(path);
    }
  }

  for (const row of addedLines(root, baseRef)) {
    if (!row.path || !SOURCE_EXTENSIONS.has(extname(row.path).toLowerCase())) continue;
    for (const [pattern, message] of PROHIBITED_VISUAL) {
      if (pattern.test(row.value)) errors.push(`${row.path}:${row.line}: ${message}`);
    }
    const radius = /border-radius\s*:\s*(\d+(?:\.\d+)?)px/i.exec(row.value);
    if (radius && Number(radius[1]) > 6) {
      errors.push(`${row.path}:${row.line}: border radius exceeds Orbit maximum 6px`);
    }
    if (!allowedColorFiles.has(row.path) && RAW_COLOR.test(row.value)) {
      errors.push(`${row.path}:${row.line}: new raw color is forbidden; use an Orbit token`);
    }
    if (/primary/i.test(row.value) && /(?:#79b8ff|--cx-information)/i.test(row.value)) {
      errors.push(`${row.path}:${row.line}: informational blue cannot be a primary action`);
    }
    if (SOCIAL_HOST.test(row.value)) {
      errors.push(`${row.path}:${row.line}: social profile URLs must come from the footer API`);
    }
    if (AUTH_REFERENCE.test(row.value) && /starlink|spacex|returnurl|code_challenge|code_verifier/i.test(row.value)) {
      errors.push(`${row.path}:${row.line}: copied external authentication reference is prohibited`);
    }
  }
}

function discoverSuites(root, manifest, errors) {
  const registered = new Set(manifest.suites.map((suite) => suite.root));
  for (const rule of list(manifest.suiteDiscovery)) {
    const base = join(root, rule.root ?? "");
    if (!rule.root || !existsSync(base)) {
      errors.push(`suiteDiscovery root does not exist: ${rule.root ?? "<missing>"}`);
      continue;
    }
    const excluded = new Set(list(rule.exclude));
    for (const name of readdirSync(base)) {
      const directory = join(base, name);
      if (excluded.has(name) || !statSync(directory).isDirectory()) continue;
      if (!existsSync(join(directory, rule.packageFile ?? "package.json"))) continue;
      const candidate = relative(root, directory).replaceAll("\\", "/");
      if (!registered.has(candidate)) errors.push(`unregistered Orbit suite discovered at ${candidate}`);
    }
  }
}

export function validate(root, manifestPath, baseRef = "") {
  const errors = [];
  const manifestSource = readText(root, manifestPath, errors, "Orbit manifest");
  if (!manifestSource) return errors;
  let manifest;
  try {
    manifest = JSON.parse(manifestSource);
  } catch (error) {
    return [`invalid Orbit manifest ${manifestPath}: ${error.message}`];
  }

  requireRule(errors, manifest.schemaVersion === "2.0", "schemaVersion must be 2.0");
  requireRule(errors, typeof manifest.repository === "string" && manifest.repository.includes("/"), "repository is required");
  requireRule(errors, manifest.visualContract?.system === "orbit", "visualContract.system must be orbit");
  requireRule(errors, manifest.visualContract?.repository === "appolon1908-hue/SDK-repository", "visualContract.repository is invalid");
  requireRule(errors, manifest.visualContract?.package === "@codestra/intake-ui", "visualContract.package is invalid");
  requireRule(errors, manifest.visualContract?.module === "orbit", "visualContract.module is invalid");
  requireRule(errors, /^[0-9a-f]{40}$/.test(manifest.visualContract?.commit ?? ""), "visualContract.commit must be a full SHA");
  requireRule(errors, Array.isArray(manifest.suites) && manifest.suites.length > 0, "suites must be a non-empty array");
  if (!Array.isArray(manifest.suites)) return errors;

  const ids = new Set();
  const roots = new Set();
  for (const suite of manifest.suites) {
    if (!suite || typeof suite !== "object" || Array.isArray(suite)) {
      errors.push("suite entries must be objects");
      continue;
    }
    requireRule(errors, typeof suite.id === "string" && suite.id.length > 0, "suite.id is required");
    requireRule(errors, typeof suite.root === "string" && suite.root.length > 0, `${suite.id}: root is required`);
    requireRule(errors, !ids.has(suite.id), `duplicate suite id: ${suite.id}`);
    requireRule(errors, !roots.has(suite.root), `duplicate suite root: ${suite.root}`);
    ids.add(suite.id);
    roots.add(suite.root);
    requireRule(errors, existsSync(join(root, suite.root ?? "")), `${suite.id}: suite root does not exist`);
    requireRule(errors, SURFACES.has(suite.surface), `${suite.id}: unsupported surface`);
    requireRule(errors, BRANDS.has(suite.brand), `${suite.id}: unsupported brand`);
    validateHttps(suite.canonicalOrigin, `${suite.id}.canonicalOrigin`, errors);
    validateShell(root, suite, errors);
    validateAuth(root, suite, errors);
    validateContent(suite, errors);
    validateNewPagePolicy(suite, errors);
    requireRule(errors, suite.colorPolicy?.rejectNewRawColors === true, `${suite.id}: rejectNewRawColors must be true`);
    requireRule(errors, suite.colorPolicy?.prohibitGradients === true, `${suite.id}: prohibitGradients must be true`);
    requireRule(errors, suite.colorPolicy?.maximumRadiusPx === 6, `${suite.id}: maximumRadiusPx must be 6`);
  }

  discoverSuites(root, manifest, errors);
  if (baseRef) {
    try {
      validateAddedSource(root, manifest, baseRef, errors);
    } catch (error) {
      errors.push(`unable to inspect source diff against ${baseRef}: ${error.message}`);
    }
  }
  return errors;
}

function validFixture(root) {
  for (const directory of ["app/pages", "orbit"]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  writeFileSync(
    join(root, "app/root.html"),
    '<html data-orbit-root data-orbit-brand="codestra" data-orbit-header="standard" data-orbit-footer="full"></html>',
  );
  writeFileSync(join(root, "app/header.html"), "<header>Codestra</header>");
  writeFileSync(join(root, "app/footer.js"), "new OrbitBrandClient().getFooter('codestra'); mountOrbitFooter(root, footer);");
  writeFileSync(join(root, "app/login.js"), "location.assign('/api/v1/auth/oidc/login');");
  writeFileSync(join(root, "app/logout.js"), "fetch('/api/v1/auth/oidc/logout', {method:'POST'});");
  writeFileSync(join(root, "app/guard.js"), "if (!session) router.replace('/login');");
  writeFileSync(join(root, "app/orbit.css"), '@import "@codestra/intake-ui/orbit/styles";');
  const manifest = {
    schemaVersion: "2.0",
    repository: "appolon1908-hue/test-ui",
    visualContract: {
      system: "orbit",
      repository: "appolon1908-hue/SDK-repository",
      package: "@codestra/intake-ui",
      module: "orbit",
      commit: "1".repeat(40),
    },
    suites: [
      {
        id: "test-ui",
        root: "app",
        surface: "customer",
        brand: "codestra",
        canonicalOrigin: "https://test.codestra.co",
        shell: {
          rootFile: "app/root.html",
          tokensFile: "app/orbit.css",
          tokenSource: "package-import",
          headerFile: "app/header.html",
          footerFile: "app/footer.js",
          headerVariant: "standard",
          footerVariant: "full",
          socialAllowed: true,
          pageRoots: ["app/pages"],
        },
        auth: {
          mode: "same-origin-bff",
          protectedRoutes: true,
          browserTokenStorage: "forbidden",
          backendAuthorizationRequired: true,
          issuer: CANONICAL_ISSUER,
          durableIdentity: "issuer+subject",
          loginSourceFile: "app/login.js",
          logoutSourceFile: "app/logout.js",
          guardSourceFile: "app/guard.js",
        },
        content: {
          source: "orbit-brand-api",
          footerEndpoint: "/api/v1/brands/{brand}/footer",
          pageEndpoint: "/api/v1/brands/{brand}/pages/{page_key}",
          assetEndpoint: "/api/v1/assets/{asset_id}",
          stableContentKeys: true,
          assetApiIds: true,
          hardcodedSocialUrls: false,
          contentKeys: ["codestra.test.page.title"],
          assetIds: ["ast_codestra_logo_primary"],
        },
        newPagePolicy: {
          inheritsRootShell: true,
          declaresHeaderVariant: true,
          declaresFooterVariant: true,
          declaresSocialPolicy: true,
          usesOrbitTokens: true,
          requiresStateMatrix: true,
        },
        colorPolicy: {
          rejectNewRawColors: true,
          prohibitGradients: true,
          maximumRadiusPx: 6,
          allowedColorFiles: [],
        },
      },
    ],
  };
  writeFileSync(join(root, "orbit/suite.json"), JSON.stringify(manifest, null, 2));
}

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), "orbit-contract-"));
  validFixture(root);
  const valid = validate(root, "orbit/suite.json");
  if (valid.length) throw new Error(`valid self-test fixture failed: ${valid.join("; ")}`);

  writeFileSync(join(root, "app/footer.js"), "const url='https://linkedin.com/company/copied';");
  const social = validate(root, "orbit/suite.json");
  if (!social.some((error) => error.includes("social profile URL"))) {
    throw new Error("self-test did not reject a hard-coded social URL");
  }

  writeFileSync(join(root, "app/footer.js"), "new OrbitBrandClient().getFooter('codestra');");
  writeFileSync(join(root, "app/header.html"), "<header>Starlink ReturnUrl</header>");
  const auth = validate(root, "orbit/suite.json");
  if (!auth.some((error) => error.includes("external auth reference"))) {
    throw new Error("self-test did not reject copied authentication material");
  }

  console.log("Codestra Orbit validator self-test: PASS");
}

const args = parseArgs(process.argv);
if (args.selfTest) {
  selfTest();
} else {
  const errors = validate(args.root, args.manifest, args.baseRef);
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }
  console.log("Codestra Orbit adoption contract: PASS");
}
