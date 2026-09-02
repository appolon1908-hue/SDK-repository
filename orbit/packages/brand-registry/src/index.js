
export const ORBIT_VERSION = '2.0.0';
export const CODESTRA_FOOTER_ATTRIBUTION = 'Powered by Codestra.co';
export const CODESTRA_IDENTITY = Object.freeze({"origin":"https://auth.codestra.co","issuer":"https://auth.codestra.co/realms/codestra","browserFlow":"authorization-code-pkce","tokenStorage":"server-session-cookie-only"});
export const CODESTRA_DOMAIN_RECORDS = Object.freeze([{"host":"codestra.co","purpose":"corporate-site","status":"registered","canonical":true},{"host":"www.codestra.co","purpose":"corporate-site-alias","status":"registered","canonical":false},{"host":"auth.codestra.co","purpose":"identity","status":"registered","canonical":true},{"host":"api.codestra.co","purpose":"public-api-edge","status":"source-authoritative","canonical":true},{"host":"social.codestra.co","purpose":"social-suite","status":"repository-declared","canonical":true},{"host":"automation.codestra.co","purpose":"automation-suite","status":"source-present-verification-required","canonical":true},{"host":"crm.codestra.agency","purpose":"odoo","status":"production-platform-confirmed","canonical":true},{"host":"n8n.codestra.agency","purpose":"automation-operator","status":"production-platform-confirmed","canonical":true},{"host":"api.codestra.agency","purpose":"middleware-legacy-boundary","status":"legacy-migration-required","canonical":false},{"host":"breero.com","purpose":"breero-public","status":"owner-declared","canonical":true},{"host":"partners.breero.com","purpose":"breero-partner-portal","status":"owner-declared-verification-required","canonical":true},{"host":"ops.breero.com","purpose":"breero-operations","status":"owner-declared-verification-required","canonical":true},{"host":"admin.breero.com","purpose":"breero-administration","status":"owner-declared-verification-required","canonical":true},{"host":"klyrow.com","purpose":"klyrow-public","status":"owner-declared","canonical":true}]);
export const CODESTRA_SOCIAL_HOSTS = Object.freeze({"linkedin":["linkedin.com","www.linkedin.com"],"facebook":["facebook.com","www.facebook.com"],"instagram":["instagram.com","www.instagram.com"],"x":["x.com","www.x.com","twitter.com","www.twitter.com"],"youtube":["youtube.com","www.youtube.com","youtu.be"],"github":["github.com","www.github.com"],"tiktok":["tiktok.com","www.tiktok.com"],"threads":["threads.net","www.threads.net"]});

const LOCALHOST = new Set(['localhost', '127.0.0.1', '[::1]']);

export function normalizeHttpsOrigin(value, { allowLocalhost = false } = {}) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  const local = LOCALHOST.has(url.hostname);
  if (url.protocol !== 'https:' && !(allowLocalhost && local && url.protocol === 'http:')) return null;
  if (url.username || url.password) return null;
  return url.origin;
}

export function isRegisteredCodestraHost(hostname) {
  if (typeof hostname !== 'string') return false;
  const host = hostname.trim().toLowerCase();
  return CODESTRA_DOMAIN_RECORDS.some((record) => record.host === host && record.status !== 'legacy-migration-required');
}

export function resolveDomainRecord(hostname) {
  if (typeof hostname !== 'string') return null;
  const host = hostname.trim().toLowerCase();
  return CODESTRA_DOMAIN_RECORDS.find((record) => record.host === host) ?? null;
}

export function suiteHostname(application, environment = 'production', pullRequest) {
  const slug = String(application ?? '').trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
    throw new TypeError('application must be a valid DNS label');
  }
  if (environment === 'production') return `${slug}.codestra.co`;
  if (environment === 'staging') return `${slug}.staging.codestra.co`;
  if (environment === 'preview') {
    const pr = Number(pullRequest);
    if (!Number.isSafeInteger(pr) || pr < 1) throw new TypeError('preview requires a positive pull request number');
    return `pr-${pr}.${slug}.preview.codestra.co`;
  }
  throw new TypeError('environment must be production, staging, or preview');
}

export function validateSocialUrl(network, value) {
  const allowed = CODESTRA_SOCIAL_HOSTS[String(network ?? '').toLowerCase()];
  if (!allowed || typeof value !== 'string') return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === 'https:' && !url.username && !url.password && allowed.includes(url.hostname.toLowerCase());
}

export function validateReturnUrl(value, { currentOrigin, allowedOrigins = [] } = {}) {
  const origin = normalizeHttpsOrigin(currentOrigin, { allowLocalhost: true }) ??
    (typeof globalThis.location?.origin === 'string' ? globalThis.location.origin : null);
  if (!origin || typeof value !== 'string' || value.trim() === '') return null;
  let url;
  try { url = new URL(value, origin); } catch { return null; }
  const normalizedAllowed = new Set([origin, ...allowedOrigins.map((item) => normalizeHttpsOrigin(item, { allowLocalhost: true })).filter(Boolean)]);
  if (!normalizedAllowed.has(url.origin) || url.username || url.password) return null;
  if (url.origin === origin) return `${url.pathname}${url.search}${url.hash}`;
  return url.toString();
}
