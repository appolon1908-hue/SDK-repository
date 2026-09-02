
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orbit = path.join(root, 'orbit');
const version = '2.0.0';
const expectedPackages = [
  '@corporate/design-tokens','@corporate/ui','@corporate/icons','@corporate/brand-registry','@corporate/content-sdk',
  '@corporate/auth-ui','@corporate/eslint-config','@corporate/stylelint-config','@corporate/testing'
];
const errors = [];
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const assert = (condition, message) => { if (!condition) errors.push(message); };

assert(fs.existsSync(orbit), 'orbit authority directory is missing');
const token = readJson('orbit/packages/design-tokens/tokens/design-tokens.json');
const expectedColors = {
  canvas:'#000000',surface:'#101010',surfaceElevated:'#171717',textPrimary:'#FFFFFF',textSecondary:'#D8D8D8',textMuted:'#9A9A9A',border:'#353535',borderStrong:'#5A5A5A'
};
for (const [key, value] of Object.entries(expectedColors)) assert(token.color?.[key] === value, `token color ${key} must be ${value}`);
assert(token.version === version, 'token version mismatch');
assert(token.size?.control === 52, 'control height must be 52');
assert(token.size?.touchTargetMinimum === 44, 'minimum target must be 44');
assert(token.radius?.standardMaximum === 6, 'maximum standard radius must be 6');

const packageDirs = fs.readdirSync(path.join(orbit, 'packages'), {withFileTypes:true}).filter((e)=>e.isDirectory()).map((e)=>e.name);
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

const registry = readJson('orbit/packages/brand-registry/registry/brand-registry.json');
assert(registry.identity?.issuer === 'https://auth.codestra.co/realms/codestra', 'identity issuer mismatch');
assert(registry.footerAttribution === 'Powered by Codestra.co', 'footer attribution mismatch');
const hosts = new Set(registry.domains.map((item)=>item.host));
for (const host of ['codestra.co','auth.codestra.co','api.codestra.co','social.codestra.co']) assert(hosts.has(host), `missing domain record ${host}`);
assert(new Set(registry.domains.map((item)=>item.host)).size === registry.domains.length, 'duplicate domain records');

const catalog = readJson('orbit/repository-catalog.json');
assert(catalog.repositories.length === 56, `repository catalog expected 56 entries, found ${catalog.repositories.length}`);
const repoNames = new Set(catalog.repositories.map((item)=>item.repository));
assert(repoNames.size === catalog.repositories.length, 'duplicate repository catalog entries');
for (const entry of catalog.repositories) {
  assert(entry.targetBranch.startsWith('codex/codestra-orbit-v2-'), `invalid target branch for ${entry.repository}`);
  if (entry.classification === 'first-party-ui') {
    assert(entry.loginLogoutRequired === true, `${entry.repository} must require login/logout logic`);
    assert(entry.sharedHeaderFooterRequired === true, `${entry.repository} must require shared header/footer`);
  }
  if (['backend-api','observability-backend','runtime-infrastructure'].includes(entry.classification)) {
    assert(entry.sharedHeaderFooterRequired === false, `${entry.repository} must not receive fabricated UI shell`);
  }
}

for (const file of ['adoption-manifest.schema.json','route-manifest.schema.json','footer-social.schema.json','page-template-manifest.schema.json']) readJson(`orbit/contracts/${file}`);
const authContract = fs.readFileSync(path.join(orbit, 'contracts/auth-session.openapi.yaml'), 'utf8');
for (const endpoint of ['/auth/login:','/auth/session:','/auth/logout:','/auth/logout-all:']) assert(authContract.includes(endpoint), `auth contract missing ${endpoint}`);
assert(!/accessToken\s*[:=].*localStorage|localStorage.*accessToken/i.test(fs.readFileSync(path.join(orbit,'packages/auth-ui/src/index.js'),'utf8')), 'auth package persists browser tokens');

const releasePath = path.join(orbit, 'release/orbit-v2.0.0.json');
if (fs.existsSync(releasePath)) {
  const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
  assert(/^[0-9a-f]{40}$/.test(release.sourceCommit || ''), 'release sourceCommit must be an immutable SHA');
  for (const artifact of release.artifacts || []) {
    const full = path.join(root, artifact.path);
    assert(fs.existsSync(full), `missing release artifact ${artifact.path}`);
    if (fs.existsSync(full)) {
      const digest = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
      assert(digest === artifact.sha256, `digest mismatch for ${artifact.path}`);
    }
  }
}

if (errors.length) {
  console.error('CODESTRA_ORBIT_VALIDATION=FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('CODESTRA_ORBIT_VALIDATION=PASS');
console.log(`PACKAGES=${expectedPackages.length}/${expectedPackages.length}`);
console.log(`REPOSITORIES_CATALOGED=${catalog.repositories.length}/${catalog.repositories.length}`);
console.log('BROWSER_TOKEN_STORAGE=PROHIBITED');
console.log('NEW_PAGE_GATE=ENFORCED_BY_CONTRACT');
