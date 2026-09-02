
function newCorrelationId() {
  return globalThis.crypto?.randomUUID?.() ?? `orbit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizedBase(value) {
  const base = String(value || '/api/v1').replace(/\/$/, '');
  if (!base.startsWith('/') || base.startsWith('//') || base.includes('://')) throw new TypeError('baseUrl must be a same-origin path');
  return base;
}

export class ContentRequestError extends Error {
  constructor(status, correlationId) {
    super('The requested content is unavailable.');
    this.name = 'ContentRequestError';
    this.status = status;
    this.correlationId = correlationId;
  }
}

export function createContentClient({ baseUrl = '/api/v1', fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  const base = normalizedBase(baseUrl);

  async function request(path, { method = 'GET', body, expectedVersion, reason } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const id = newCorrelationId();
    const headers = { Accept: 'application/json', 'X-Correlation-ID': id };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (expectedVersion !== undefined) headers['If-Match'] = String(expectedVersion);
    if (reason) headers['X-Change-Reason'] = String(reason);
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method, headers, credentials: 'include', cache: 'no-store', signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw new ContentRequestError(0, id);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new ContentRequestError(response.status, response.headers.get('x-correlation-id') || id);
    if (response.status === 204) return null;
    return response.json();
  }

  const enc = encodeURIComponent;
  return Object.freeze({
    getBrand: (brand) => request(`/brands/${enc(brand)}`),
    getTheme: (brand) => request(`/brands/${enc(brand)}/theme`),
    getShell: (brand) => request(`/brands/${enc(brand)}/shell`),
    getFooter: (brand) => request(`/brands/${enc(brand)}/footer`),
    getNavigation: (brand, application) => request(`/navigation/${enc(brand)}/${enc(application)}`),
    getPage: (brand, application, slug) => request(`/pages/${enc(brand)}/${enc(application)}/${enc(slug)}`),
    getContent: (contentKey) => request(`/content/${enc(contentKey)}`),
    getAsset: (assetId) => request(`/assets/${enc(assetId)}`),
    updateFooter: (brand, resource, options = {}) => request(`/admin/brands/${enc(brand)}/footer`, {method: 'PUT', body: resource, ...options}),
    publishFooter: (brand, options = {}) => request(`/admin/brands/${enc(brand)}/footer/publish`, {method: 'POST', body: options.body || {}, ...options}),
    previewPage: (pageId, options = {}) => request(`/admin/pages/${enc(pageId)}/preview`, {method: 'POST', body: options.body || {}, ...options}),
    publishPage: (pageId, options = {}) => request(`/admin/pages/${enc(pageId)}/publish`, {method: 'POST', body: options.body || {}, ...options}),
    rollbackRelease: (releaseId, options = {}) => request(`/admin/releases/${enc(releaseId)}/rollback`, {method: 'POST', body: options.body || {}, ...options})
  });
}

export async function getShellBundle(client, brand, application) {
  const [brandResource, theme, shell, footer, navigation] = await Promise.all([
    client.getBrand(brand), client.getTheme(brand), client.getShell(brand), client.getFooter(brand), client.getNavigation(brand, application)
  ]);
  return Object.freeze({ brand: brandResource, theme, shell, footer, navigation });
}

export const orbitContentVersion = '2.0.0';
