#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';

const THEMES = new Set(['neutral','codestra','breero','beyvra','moneybee','larim','transport','telnexa','klyrow','social']);
const SURFACES = new Set(['public','customer','operator','admin','vendor']);
const SHELL_MODES = new Set(['public','application','operator','vendor-supported']);
const AUTH_MODES = new Set(['public-only','oidc-pkce','api-session','same-origin-bff','vendor-native']);
const STORAGE = new Set(['forbidden','legacy-session-storage-migration-required','vendor-managed','n/a']);
const SOURCE_EXTENSIONS = new Set(['.css','.scss','.sass','.less','.tsx','.ts','.jsx','.js','.vue','.html']);
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\s*\(/i;
const LOGIN_MARKERS = [
  '/auth/login',
  '.login(',
  ' login(',
  'useLogin(',
  'loginPost',
  'protocol/openid-connect/auth',
  'authorization_code',
];
const LOGOUT_MARKERS = [
  '/auth/logout',
  '.logout(',
  ' logout(',
  'logoutSession',
  'logoutCustomerSession',
  'VITE_AUTH_LOGOUT_ENDPOINT',
  'protocol/openid-connect/logout',
  'end_session',
];
const GUARD_MARKERS = ['router.replace','router.push','<Navigate','beforeEach','middleware','requireAuth','onUnauthorized','session-expired'];
const CANONICAL_ISSUER = 'https://auth.codestra.co/realms/codestra';

function parseArgs(argv) {
  const result = { root: '.', manifest: 'horizon/suite.json', baseRef: '', selfTest: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--self-test') result.selfTest = true;
    else if (argv[i] === '--root') result.root = argv[++i];
    else if (argv[i] === '--manifest') result.manifest = argv[++i];
    else if (argv[i] === '--base-ref') result.baseRef = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return result;
}

const asList = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const requireRule = (errors, condition, message) => { if (!condition) errors.push(message); };

function readText(root, path, errors, label) {
  const absolute = join(root, path ?? '');
  if (!path || !existsSync(absolute) || !statSync(absolute).isFile()) {
    errors.push(`${label} does not exist: ${path ?? '<missing>'}`);
    return '';
  }
  try { return readFileSync(absolute, 'utf8'); }
  catch { errors.push(`${label} must be UTF-8 text: ${path}`); return ''; }
}

function validateHttpsUrl(value, label, errors) {
  try {
    const parsed = new URL(value);
    requireRule(
      errors,
      parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password,
      `${label} must be a credential-free absolute HTTPS URL: ${JSON.stringify(value)}`,
    );
  } catch {
    errors.push(`${label} must be a credential-free absolute HTTPS URL: ${JSON.stringify(value)}`);
  }
}

function validateDomains(value, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const [role, entries] of Object.entries(value)) {
    asList(entries).forEach((entry, index) => validateHttpsUrl(entry, `${label}.${role}[${index}]`, errors));
  }
}

function validateShell(root, suite, errors) {
  const id = suite.id ?? '<unknown>';
  const shell = suite.shell;
  if (!shell || typeof shell !== 'object' || Array.isArray(shell)) {
    errors.push(`${id}: shell must be an object`);
    return;
  }
  requireRule(errors, SHELL_MODES.has(shell.mode), `${id}: unsupported shell.mode ${JSON.stringify(shell.mode)}`);
  requireRule(errors, typeof shell.rootFile === 'string' && shell.rootFile, `${id}: shell.rootFile is required`);
  requireRule(errors, typeof shell.tokensFile === 'string' && shell.tokensFile, `${id}: shell.tokensFile is required`);
  const rootText = readText(root, shell.rootFile, errors, `${id} rootFile`);
  const tokenText = readText(root, shell.tokensFile, errors, `${id} tokensFile`);
  for (const marker of asList(shell.requiredRootMarkers)) {
    if (typeof marker === 'string') {
      requireRule(errors, rootText.includes(marker), `${id}: rootFile missing marker ${JSON.stringify(marker)}`);
    }
  }
  for (const token of ['--hz-accent','--hz-bg','--hz-text']) {
    requireRule(errors, tokenText.includes(token), `${id}: tokensFile missing ${token}`);
  }
  if (shell.mode === 'public' || shell.mode === 'application') {
    for (const field of ['headerFile','footerFile']) readText(root, shell[field], errors, `${id} ${field}`);
  } else if (shell.mode === 'operator') {
    readText(root, shell.topbarFile ?? shell.headerFile, errors, `${id} operator header`);
  } else if (shell.mode === 'vendor-supported') {
    readText(root, shell.brandConfigFile, errors, `${id} brandConfigFile`);
  }
  const pageRoots = asList(shell.pageRoots);
  requireRule(errors, pageRoots.length > 0, `${id}: shell.pageRoots must not be empty`);
  for (const pageRoot of pageRoots) {
    requireRule(errors, existsSync(join(root, pageRoot)), `${id}: page root does not exist: ${pageRoot}`);
  }
  const page = suite.newPagePolicy;
  requireRule(errors, page && typeof page === 'object', `${id}: newPagePolicy must be an object`);
  if (page && typeof page === 'object') {
    requireRule(errors, page.inheritsRootShell === true, `${id}: new pages must inherit the root shell`);
    requireRule(errors, page.usesHorizonTokens === true, `${id}: new pages must use Horizon tokens`);
    requireRule(errors, page.requiresStateMatrix === true, `${id}: new pages must define applicable loading/empty/error/success states`);
  }
}

function validateAuth(root, suite, errors) {
  const id = suite.id ?? '<unknown>';
  const auth = suite.auth;
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
    errors.push(`${id}: auth must be an object`);
    return;
  }
  requireRule(errors, AUTH_MODES.has(auth.mode), `${id}: unsupported auth.mode ${JSON.stringify(auth.mode)}`);
  requireRule(errors, typeof auth.protectedRoutes === 'boolean', `${id}: auth.protectedRoutes must be boolean`);
  requireRule(errors, STORAGE.has(auth.browserTokenStorage), `${id}: auth.browserTokenStorage must state the approved policy`);

  if (auth.mode === 'public-only') {
    requireRule(errors, auth.protectedRoutes === false, `${id}: public-only suites cannot declare protected routes`);
    requireRule(errors, !auth.loginPath, `${id}: public-only suites cannot expose loginPath`);
    requireRule(errors, !auth.logoutSourceFile, `${id}: public-only suites cannot expose logout logic`);
    if (suite.shell?.headerFile) {
      const header = readText(root, suite.shell.headerFile, errors, `${id} headerFile`);
      requireRule(errors, !/\b(?:sign|log)\s+(?:in|out)\b/i.test(header), `${id}: public-only header contains fake authentication controls`);
    }
    return;
  }

  requireRule(errors, auth.protectedRoutes === true, `${id}: ${auth.mode} requires protectedRoutes=true`);
  for (const field of ['loginPath','loginSourceFile','logoutSourceFile','guardSourceFile']) {
    requireRule(errors, typeof auth[field] === 'string' && auth[field], `${id}: auth.${field} is required`);
  }
  requireRule(errors, auth.backendAuthorizationRequired === true, `${id}: backendAuthorizationRequired must be true`);
  requireRule(errors, auth.headerReflectsSession === true, `${id}: headerReflectsSession must be true`);

  if (['oidc-pkce','same-origin-bff','vendor-native'].includes(auth.mode)) {
    validateHttpsUrl(auth.issuer, `${id}.auth.issuer`, errors);
    requireRule(
      errors,
      String(auth.issuer ?? '').replace(/\/$/, '') === CANONICAL_ISSUER,
      `${id}: OIDC issuer must be ${CANONICAL_ISSUER}`,
    );
    requireRule(errors, auth.durableIdentity === 'issuer+subject', `${id}: OIDC identity must be issuer+subject`);
  } else if (auth.mode === 'api-session') {
    requireRule(
      errors,
      ['backend-user-id','issuer+subject'].includes(auth.durableIdentity),
      `${id}: API session identity must be backend-user-id or issuer+subject`,
    );
    if (auth.durableIdentity !== 'issuer+subject') {
      requireRule(errors, auth.migrationTarget === 'issuer+subject', `${id}: legacy API sessions must migrate to issuer+subject`);
    }
  }

  const login = readText(root, auth.loginSourceFile, errors, `${id} loginSourceFile`);
  const logout = readText(root, auth.logoutSourceFile, errors, `${id} logoutSourceFile`);
  const guard = readText(root, auth.guardSourceFile, errors, `${id} guardSourceFile`);
  requireRule(errors, LOGIN_MARKERS.some((marker) => login.includes(marker)), `${id}: login source has no provider/API login marker`);
  requireRule(errors, LOGOUT_MARKERS.some((marker) => logout.includes(marker)), `${id}: logout source has no provider/API revocation marker`);
  requireRule(errors, GUARD_MARKERS.some((marker) => guard.includes(marker)), `${id}: guard source has no fail-closed route/session marker`);
}

function discoverSuites(root, manifest, errors) {
  const registered = new Set(manifest.suites.map((suite) => suite.root));
  for (const rule of asList(manifest.suiteDiscovery)) {
    const base = join(root, rule.root ?? '');
    if (!rule.root || !existsSync(base)) {
      errors.push(`suiteDiscovery root does not exist: ${rule.root ?? '<missing>'}`);
      continue;
    }
    const excluded = new Set(asList(rule.exclude));
    for (const name of readdirSync(base)) {
      const directory = join(base, name);
      if (excluded.has(name) || !statSync(directory).isDirectory() || !existsSync(join(directory, rule.packageFile ?? 'package.json'))) continue;
      const candidate = relative(root, directory).replaceAll('\\','/');
      if (!registered.has(candidate)) errors.push(`unregistered suite discovered at ${candidate}`);
    }
  }
}

function addedLines(root, baseRef) {
  const diff = execFileSync('git', ['-C', root, 'diff', '--unified=0', `${baseRef}...HEAD`, '--'], { encoding: 'utf8' });
  const rows = [];
  let path = '';
  let line = 0;
  for (const value of diff.split('\n')) {
    if (value.startsWith('+++ b/')) { path = value.slice(6); continue; }
    if (value.startsWith('@@')) { line = Number(/\+(\d+)/.exec(value)?.[1] ?? 0); continue; }
    if (value.startsWith('+') && !value.startsWith('+++')) {
      rows.push({ path, line, value: value.slice(1) });
      line += 1;
    } else if (!value.startsWith('-')) line += 1;
  }
  return rows;
}

function validateColors(root, manifest, baseRef, errors) {
  const allowed = new Set();
  for (const suite of manifest.suites) {
    if (suite.shell?.tokensFile) allowed.add(suite.shell.tokensFile);
    for (const path of asList(suite.colorPolicy?.allowedColorFiles)) allowed.add(path);
  }
  for (const row of addedLines(root, baseRef)) {
    if (!row.path || !SOURCE_EXTENSIONS.has(extname(row.path).toLowerCase()) || allowed.has(row.path)) continue;
    if (RAW_COLOR.test(row.value)) {
      errors.push(`${row.path}:${row.line}: new raw color is forbidden; use a registered Horizon token`);
    }
  }
}

export function validate(root, manifestPath, baseRef = '') {
  const errors = [];
  const absolute = join(root, manifestPath);
  if (!existsSync(absolute)) return [`manifest not found: ${manifestPath}`];
  let manifest;
  try { manifest = JSON.parse(readFileSync(absolute, 'utf8')); }
  catch (error) { return [`invalid JSON manifest ${manifestPath}: ${error.message}`]; }

  requireRule(errors, manifest.schemaVersion === '1.0', 'schemaVersion must be 1.0');
  requireRule(errors, typeof manifest.repository === 'string' && manifest.repository, 'repository is required');
  requireRule(errors, manifest.visualContract?.repository === 'appolon1908-hue/SDK-repository', 'visualContract.repository is invalid');
  requireRule(errors, /^[0-9a-f]{40}$/.test(manifest.visualContract?.commit ?? ''), 'visualContract.commit must be a full SHA');
  requireRule(errors, Array.isArray(manifest.suites) && manifest.suites.length > 0, 'suites must be a non-empty array');
  if (!Array.isArray(manifest.suites)) return errors;

  const ids = new Set();
  const roots = new Set();
  for (const suite of manifest.suites) {
    requireRule(errors, suite && typeof suite === 'object', 'suite entries must be objects');
    if (!suite || typeof suite !== 'object') continue;
    requireRule(errors, typeof suite.id === 'string' && suite.id, 'suite.id is required');
    requireRule(errors, typeof suite.root === 'string' && suite.root, `${suite.id}: root is required`);
    requireRule(errors, !ids.has(suite.id), `duplicate suite id: ${suite.id}`);
    ids.add(suite.id);
    requireRule(errors, !roots.has(suite.root), `duplicate suite root: ${suite.root}`);
    roots.add(suite.root);
    requireRule(errors, existsSync(join(root, suite.root ?? '')), `${suite.id}: suite root does not exist: ${suite.root}`);
    requireRule(errors, SURFACES.has(suite.surface), `${suite.id}: unsupported surface ${JSON.stringify(suite.surface)}`);
    requireRule(errors, THEMES.has(suite.theme), `${suite.id}: unsupported theme ${JSON.stringify(suite.theme)}`);
    validateHttpsUrl(suite.canonicalOrigin, `${suite.id}.canonicalOrigin`, errors);
    validateDomains(suite.domains, `${suite.id}.domains`, errors);
    validateShell(root, suite, errors);
    validateAuth(root, suite, errors);
    requireRule(errors, suite.colorPolicy?.rejectNewRawColors === true, `${suite.id}: rejectNewRawColors must be true`);
  }

  discoverSuites(root, manifest, errors);
  if (baseRef) {
    try { validateColors(root, manifest, baseRef, errors); }
    catch (error) { errors.push(`unable to inspect color diff against ${baseRef}: ${error.message}`); }
  }
  return errors;
}

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'horizon-contract-'));
  for (const directory of ['app/pages','horizon']) mkdirSync(join(root, directory), { recursive: true });
  writeFileSync(join(root,'app/layout.tsx'), '<html data-horizon-root data-horizon-theme="codestra"><body /></html>');
  writeFileSync(join(root,'app/header.tsx'), "fetch('/auth/login'); fetch('/auth/logout');");
  writeFileSync(join(root,'app/footer.tsx'), 'footer');
  writeFileSync(join(root,'app/guard.tsx'), "router.replace('/login')");
  writeFileSync(join(root,'app/tokens.css'), ':root{--hz-accent:#fff;--hz-bg:#000;--hz-text:#fff}');
  const manifest = {
    schemaVersion: '1.0',
    repository: 'example/repo',
    visualContract: { repository: 'appolon1908-hue/SDK-repository', commit: '7db4c6549a0a007922355090f03c082a308f3855' },
    suites: [{
      id: 'example', root: 'app', surface: 'customer', theme: 'codestra', canonicalOrigin: 'https://example.com',
      domains: { public: ['https://example.com'] },
      shell: { mode: 'application', rootFile: 'app/layout.tsx', headerFile: 'app/header.tsx', footerFile: 'app/footer.tsx', tokensFile: 'app/tokens.css', requiredRootMarkers: ['data-horizon-root','data-horizon-theme="codestra"'], pageRoots: ['app/pages'] },
      auth: { mode: 'api-session', protectedRoutes: true, loginPath: '/login', loginSourceFile: 'app/header.tsx', logoutSourceFile: 'app/header.tsx', guardSourceFile: 'app/guard.tsx', backendAuthorizationRequired: true, headerReflectsSession: true, durableIdentity: 'backend-user-id', migrationTarget: 'issuer+subject', browserTokenStorage: 'legacy-session-storage-migration-required' },
      colorPolicy: { rejectNewRawColors: true, allowedColorFiles: ['app/tokens.css'] },
      newPagePolicy: { inheritsRootShell: true, usesHorizonTokens: true, requiresStateMatrix: true },
    }],
  };
  writeFileSync(join(root,'horizon/suite.json'), JSON.stringify(manifest));
  const valid = validate(root,'horizon/suite.json');
  if (valid.length) throw new Error(`valid fixture failed:\n${valid.join('\n')}`);
  manifest.suites[0].auth.logoutSourceFile = 'missing.ts';
  writeFileSync(join(root,'horizon/suite.json'), JSON.stringify(manifest));
  const invalid = validate(root,'horizon/suite.json');
  if (!invalid.some((error) => error.includes('logoutSourceFile does not exist'))) throw new Error('invalid fixture did not fail closed');
  console.log('Horizon validator self-test: PASS');
}

const options = parseArgs(process.argv);
if (options.selfTest) selfTest();
else {
  const errors = validate(resolve(options.root), options.manifest, options.baseRef);
  if (errors.length) {
    console.error('HORIZON_CONTRACT=FAIL');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log('HORIZON_CONTRACT=PASS');
}
