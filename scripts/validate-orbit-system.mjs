import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orbit = path.join(root, 'orbit');
const version = '2.0.0';
const expectedPackages = [
  '@corporate/design-tokens',
  '@corporate/ui',
  '@corporate/icons',
  '@corporate/brand-registry',
  '@corporate/content-sdk',
  '@corporate/auth-ui',
  '@corporate/eslint-config',
  '@corporate/stylelint-config',
  '@corporate/testing',
];
const expectedSocialNetworks = [
  'linkedin',
  'facebook',
  'instagram',
  'x',
  'youtube',
  'github',
  'tiktok',
  'threads',
];
const expectedFooterVariants = ['full', 'compact', 'auth-compact', 'legal-only'];
const errors = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const assert = (condition, message) => { if (!condition) errors.push(message); };
const requireText = (text, values, context) => {
  for (const value of values) assert(text.includes(value), `${context} missing ${value}`);
};

assert(fs.existsSync(orbit), 'orbit authority directory is missing');

const token = readJson('orbit/packages/design-tokens/tokens/design-tokens.json');
const expectedColors = {
  canvas: '#000000',
  surface: '#101010',
  surfaceElevated: '#171717',
  surfaceSecondary: '#202020',
  textPrimary: '#FFFFFF',
  textSecondary: '#D8D8D8',
  textMuted: '#9A9A9A',
  border: '#353535',
  borderStrong: '#5A5A5A',
  actionPrimaryBackground: '#FFFFFF',
  actionPrimaryText: '#000000',
  actionPrimaryHover: '#E7E7E7',
  actionPrimaryActive: '#CCCCCC',
  focus: '#FFFFFF',
};
for (const [key, value] of Object.entries(expectedColors)) {
  assert(token.color?.[key] === value, `token color ${key} must be ${value}`);
}
const expectedStatusColors = {
  success: '#36C98F',
  warning: '#F4B860',
  error: '#FF6469',
  danger: '#FF6469',
  info: '#79B8FF',
};
for (const [key, value] of Object.entries(expectedStatusColors)) {
  assert(token.color?.status?.[key] === value, `status color ${key} must be ${value}`);
}
assert(token.version === version, 'token version mismatch');
const expectedSizes = {
  control: 52,
  controlCompact: 44,
  touchTargetMinimum: 44,
  socialIconVisual: 20,
  socialIconTarget: 44,
  headerDesktop: 76,
  headerTablet: 64,
  headerMobile: 56,
  authColumnMaximum: 480,
  contentMain: 1280,
  contentWide: 1440,
  textColumn: 720,
};
for (const [key, value] of Object.entries(expectedSizes)) {
  assert(token.size?.[key] === value, `token size ${key} must be ${value}`);
}
assert(token.radius?.control === 2, 'control radius must be 2');
assert(token.radius?.standardMaximum === 6, 'maximum standard radius must be 6');
assert(token.policy?.gradients === 'prohibited-in-shared-shell', 'shared-shell gradients must be prohibited');
assert(token.policy?.glassmorphism === 'prohibited', 'glass effects must be prohibited');
assert(token.policy?.glow === 'prohibited', 'glow must be prohibited');
assert(token.policy?.largeRoundedCards === 'prohibited', 'large rounded cards must be prohibited');
assert(token.policy?.defaultCorporateActionColor === 'monochrome-white-not-blue', 'default action color must remain monochrome');

const tokenCss = read('orbit/packages/design-tokens/css/orbit.css');
requireText(tokenCss, [
  '--orbit-surface-secondary: #202020;',
  '--orbit-action-primary-hover: #E7E7E7;',
  '--orbit-action-primary-active: #CCCCCC;',
  '--orbit-success: #36C98F;',
  '--orbit-warning: #F4B860;',
  '--orbit-error: #FF6469;',
  '--orbit-info: #79B8FF;',
  '--orbit-control-height: 52px;',
  '--orbit-control-compact-height: 44px;',
  '--orbit-social-icon-size: 20px;',
  '--orbit-social-target-size: 44px;',
  '--orbit-content-main: 1280px;',
  '--orbit-content-wide: 1440px;',
  '--orbit-text-column-max: 720px;',
], 'token CSS');

const packageDirs = fs.readdirSync(path.join(orbit, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const discovered = [];
for (const dir of packageDirs) {
  const pkgPath = path.join(orbit, 'packages', dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  discovered.push(pkg.name);
  assert(pkg.version === version, `${pkg.name} version mismatch`);
  assert(pkg.license === 'MIT', `${pkg.name} must declare MIT license`);
  assert(pkg.publishConfig?.provenance === true, `${pkg.name} must require provenance`);
}
for (const name of expectedPackages) assert(discovered.includes(name), `missing package ${name}`);
assert(discovered.length === expectedPackages.length, 'unexpected Orbit package count');

const registry = readJson('orbit/packages/brand-registry/registry/brand-registry.json');
assert(registry.identity?.issuer === 'https://auth.codestra.co/realms/codestra', 'identity issuer mismatch');
assert(registry.footerAttribution === 'Powered by Codestra.co', 'footer attribution mismatch');
const hosts = new Set(registry.domains.map((item) => item.host));
for (const host of ['codestra.co', 'auth.codestra.co', 'api.codestra.co', 'social.codestra.co']) {
  assert(hosts.has(host), `missing domain record ${host}`);
}
assert(hosts.size === registry.domains.length, 'duplicate domain records');

const catalog = readJson('orbit/repository-catalog.json');
assert(catalog.repositories.length === 56, `repository catalog expected 56 entries, found ${catalog.repositories.length}`);
const entries = catalog.repositories.map((row) => Object.fromEntries(
  catalog.columns.map((column, index) => [column, row[index]]),
));
const repoNames = new Set(entries.map((item) => item.repository));
assert(repoNames.size === entries.length, 'duplicate repository catalog entries');
for (const entry of entries) {
  assert(entry.targetBranch.startsWith('codex/codestra-orbit-v2-'), `invalid target branch for ${entry.repository}`);
  const requirements = catalog.requirementsByClassification?.[entry.classification];
  assert(Boolean(requirements), `missing classification requirements for ${entry.repository}`);
  if (entry.classification === 'first-party-ui') {
    assert(requirements.loginLogoutRequired === true, `${entry.repository} must require login/logout logic`);
    assert(requirements.sharedHeaderFooterRequired === true, `${entry.repository} must require shared header/footer`);
  }
  if (['backend-api', 'observability-backend', 'runtime-infrastructure'].includes(entry.classification)) {
    assert(requirements.sharedHeaderFooterRequired === false, `${entry.repository} must not receive fabricated UI shell`);
  }
}

for (const file of [
  'adoption-manifest.schema.json',
  'route-manifest.schema.json',
  'footer-social.schema.json',
  'page-template-manifest.schema.json',
]) {
  readJson(`orbit/contracts/${file}`);
}

const footerSchema = readJson('orbit/contracts/footer-social.schema.json');
const schemaNetworks = footerSchema.properties?.social?.items?.properties?.network?.enum || [];
assert(JSON.stringify(schemaNetworks) === JSON.stringify(expectedSocialNetworks), 'footer social networks must match the approved eight-network set');
assert(footerSchema.properties?.published?.type === 'boolean', 'footer publication state is required');

const authContract = read('orbit/contracts/auth-session.openapi.yaml');
for (const endpoint of ['/auth/login:', '/auth/session:', '/auth/logout:', '/auth/logout-all:']) {
  assert(authContract.includes(endpoint), `auth contract missing ${endpoint}`);
}
const contentContract = read('orbit/contracts/brand-content.openapi.yaml');
for (const endpoint of [
  '/brands/{brand}/footer:',
  '/admin/brands/{brand}/footer:',
  '/admin/brands/{brand}/footer/publish:',
  '/admin/pages/{pageId}/publish:',
  '/admin/releases/{releaseId}/rollback:',
]) {
  assert(contentContract.includes(endpoint), `content contract missing ${endpoint}`);
}
for (const header of ['Idempotency-Key', 'X-Correlation-ID', 'Expected-Version', 'X-Change-Reason']) {
  assert(contentContract.includes(header), `content contract missing governed header ${header}`);
}
for (const evidence of ['approvalHistory', 'auditEvidence', 'publicationEvidenceId', 'rollbackEvidenceId']) {
  assert(contentContract.includes(evidence), `content contract missing ${evidence}`);
}

const contentSdk = read('orbit/packages/content-sdk/src/index.js');
for (const marker of [
  "'Idempotency-Key'",
  "'Expected-Version'",
  "'X-Correlation-ID'",
  "'X-Change-Reason'",
  "credentials: 'include'",
  '/brands/${enc(brand)}/footer',
  '/admin/brands/${enc(brand)}/footer',
  '/admin/brands/${enc(brand)}/footer/publish',
]) {
  assert(contentSdk.includes(marker), `content SDK missing ${marker}`);
}
assert(contentSdk.includes('idempotencyKey is required for mutations'), 'content SDK must fail closed without idempotency');
assert(contentSdk.includes('expectedVersion is required for mutations'), 'content SDK must fail closed without expected version');
assert(contentSdk.includes('reason is required for mutations'), 'content SDK must fail closed without safe reason');

const uiSource = read('orbit/packages/ui/src/index.js');
for (const variant of expectedFooterVariants) assert(uiSource.includes(`'${variant}'`), `UI missing footer variant ${variant}`);
for (const network of expectedSocialNetworks) assert(uiSource.includes(`'${network}'`), `UI missing social network ${network}`);
requireText(uiSource, [
  "footer.dataset.socialSource = 'GET /api/v1/brands/{brand}/footer'",
  "resourcePublished && resolvedSocial.length",
  "item?.enabled !== true",
  "item?.validated !== true",
], 'footer renderer');
const uiCss = read('orbit/packages/ui/css/orbit-ui.css');
requireText(uiCss, [
  'width: var(--orbit-social-target-size);',
  'width: var(--orbit-social-icon-size);',
  '.orbit-footer[data-variant="auth-compact"]',
  '.orbit-footer[data-variant="legal-only"]',
], 'UI CSS');

const authSource = read('orbit/packages/auth-ui/src/index.js');
assert(!/accessToken\s*[:=].*localStorage|localStorage.*accessToken/i.test(authSource), 'auth package persists browser tokens');
for (const prohibited of ['ReturnUrl', 'code_challenge', 'client_id=', 'redirect_uri=', 'starlink']) {
  assert(!authSource.toLowerCase().includes(prohibited.toLowerCase()), `auth source contains prohibited external reference ${prohibited}`);
}

const releasePath = path.join(orbit, 'release/orbit-v2.0.0.json');
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
assert(release.status === 'superseded-source-candidate', 'pre-correction tarballs must be marked superseded');
assert(release.installAllowed === false, 'superseded tarballs must not be installable');
assert(/^[0-9a-f]{40}$/.test(release.sourceCommit || ''), 'historical release sourceCommit must be an immutable SHA');
for (const artifact of release.artifacts || []) {
  assert(artifact.installAllowed === false, `superseded artifact remains installable: ${artifact.path}`);
  const full = path.join(root, artifact.path);
  assert(fs.existsSync(full), `missing historical release artifact ${artifact.path}`);
  if (fs.existsSync(full)) {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    assert(digest === artifact.sha256, `digest mismatch for historical artifact ${artifact.path}`);
  }
}

const workflow = read('.github/workflows/orbit-system.yml');
requireText(workflow, [
  'Build exact-head candidate packages',
  'sha256sum orbit/build/*.tgz',
  'SOURCE_COMMIT',
  'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
  'test "$(find orbit/build -maxdepth 1 -name \'*.tgz\' | wc -l)" -eq 9',
], 'Orbit workflow');

if (errors.length) {
  console.error('CODESTRA_ORBIT_VALIDATION=FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('CODESTRA_ORBIT_VALIDATION=PASS');
console.log(`PACKAGES=${expectedPackages.length}/${expectedPackages.length}`);
console.log(`REPOSITORIES_CATALOGED=${catalog.repositories.length}/${catalog.repositories.length}`);
console.log('EXACT_APPROVED_TOKEN_SET=PASS');
console.log('FOOTER_VARIANTS=4/4');
console.log('SOCIAL_NETWORKS=8/8');
console.log('GOVERNED_CONTENT_MUTATIONS=PASS');
console.log('BROWSER_TOKEN_STORAGE=PROHIBITED');
console.log('NEW_PAGE_GATE=ENFORCED_BY_CONTRACT');
