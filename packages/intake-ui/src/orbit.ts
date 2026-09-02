/**
 * Codestra Orbit is the canonical framework-neutral visual and shell contract
 * for Codestra-owned browser applications. It contains no identity-provider
 * secrets, provider credentials, or authoritative business decisions.
 */

export const ORBIT_CONTRACT_VERSION = "2.0.0" as const;

export const ORBIT_COLORS = Object.freeze({
  canvas: "#000000",
  surfacePrimary: "#101010",
  surfaceElevated: "#171717",
  surfaceSecondary: "#202020",
  textMain: "#FFFFFF",
  textSupporting: "#D8D8D8",
  textMuted: "#9A9A9A",
  borderDefault: "#353535",
  borderStrong: "#5A5A5A",
  actionPrimaryBackground: "#FFFFFF",
  actionPrimaryText: "#000000",
  actionPrimaryHover: "#E7E7E7",
  actionPrimaryActive: "#CCCCCC",
  success: "#36C98F",
  warning: "#F4B860",
  error: "#FF6469",
  information: "#79B8FF",
});

export const ORBIT_GEOMETRY = Object.freeze({
  headerDesktopPx: 76,
  headerTabletPx: 64,
  headerMobilePx: 56,
  controlStandardPx: 52,
  controlCompactPx: 44,
  authenticationMaxWidthPx: 480,
  radiusDefaultPx: 2,
  radiusMaximumPx: 6,
  socialIconVisualPx: 20,
  socialIconTargetPx: 44,
  contentMainPx: 1280,
  contentWidePx: 1440,
  contentTextPx: 720,
});

export const ORBIT_BRANDS = Object.freeze({
  codestra: "Codestra",
  breero: "Breero",
  beyvra: "Beyvra",
  moneybee: "MoneyBee",
  larim: "LARIM-A",
  transportation: "Transportation",
  telnexa: "Telnexa",
  klyrow: "Klyrow",
  social: "Codestra Social",
  restaurant: "Restaurant",
  neutral: "Neutral",
});

export type OrbitBrand = keyof typeof ORBIT_BRANDS;
export const ORBIT_BRAND_NAMES = Object.freeze(
  Object.keys(ORBIT_BRANDS) as OrbitBrand[],
);

export const ORBIT_HEADER_VARIANTS = ["standard", "compact", "auth"] as const;
export type OrbitHeaderVariant = (typeof ORBIT_HEADER_VARIANTS)[number];

export const ORBIT_FOOTER_VARIANTS = [
  "full",
  "compact",
  "auth-compact",
  "legal-only",
] as const;
export type OrbitFooterVariant = (typeof ORBIT_FOOTER_VARIANTS)[number];

export const ORBIT_SOCIAL_NETWORKS = [
  "linkedin",
  "facebook",
  "instagram",
  "x",
  "youtube",
  "github",
  "tiktok",
  "threads",
] as const;
export type OrbitSocialNetwork = (typeof ORBIT_SOCIAL_NETWORKS)[number];

export const ORBIT_DATA_ATTRIBUTES = Object.freeze({
  root: "data-orbit-root",
  brand: "data-orbit-brand",
  header: "data-orbit-header",
  footer: "data-orbit-footer",
  socialAllowed: "data-orbit-social-allowed",
});

export const ORBIT_CONTENT_KEY_PATTERN =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){2,}$/;
export const ORBIT_ASSET_ID_PATTERN =
  /^ast_[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/;

export interface OrbitShellOptions {
  brand?: string | null;
  headerVariant?: string | null;
  footerVariant?: string | null;
  socialAllowed?: boolean;
}

export interface OrbitShellAttributes {
  "data-orbit-root": "";
  "data-orbit-brand": OrbitBrand;
  "data-orbit-header": OrbitHeaderVariant;
  "data-orbit-footer": OrbitFooterVariant;
  "data-orbit-social-allowed": "true" | "false";
}

export interface OrbitAttributeTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface OrbitLegalLink {
  content_key: string;
  href: string;
  label: string;
}

export interface OrbitSocialLink {
  network: OrbitSocialNetwork;
  url: string;
  label: string;
  published: boolean;
}

export interface OrbitFooterResource {
  brand: OrbitBrand;
  resource_version: number;
  publication_status: "draft" | "published" | "withdrawn";
  default_variant: OrbitFooterVariant;
  copyright: {
    content_key: string;
    text: string;
  };
  legal_links: readonly OrbitLegalLink[];
  social_links: readonly OrbitSocialLink[];
  published_at?: string | null;
  publication_id?: string | null;
}

export interface OrbitFooterDraft {
  expected_version: number;
  default_variant: OrbitFooterVariant;
  copyright: OrbitFooterResource["copyright"];
  legal_links: readonly OrbitLegalLink[];
  social_links: readonly OrbitSocialLink[];
}

export interface OrbitMutationContext {
  idempotencyKey: string;
  correlationId: string;
  expectedVersion: number;
  reason: string;
}

export interface OrbitRollbackRequest {
  expected_version: number;
  publication_id: string;
  reason: string;
}

export interface OrbitPageShellDeclaration {
  page_key: string;
  header_variant: OrbitHeaderVariant;
  footer_variant: OrbitFooterVariant;
  social_links_allowed: boolean;
  content_keys: readonly string[];
  asset_ids: readonly string[];
}

export interface OrbitFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type OrbitFetch = (
  input: string,
  init?: RequestInit,
) => Promise<OrbitFetchResponse>;

export interface OrbitBrandClientOptions {
  baseUrl?: string;
  fetch?: OrbitFetch;
}

export class OrbitApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = "OrbitApiError";
  }
}

export function isOrbitBrand(value: unknown): value is OrbitBrand {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ORBIT_BRANDS, value)
  );
}

export function isOrbitHeaderVariant(
  value: unknown,
): value is OrbitHeaderVariant {
  return (
    typeof value === "string" &&
    (ORBIT_HEADER_VARIANTS as readonly string[]).includes(value)
  );
}

export function isOrbitFooterVariant(
  value: unknown,
): value is OrbitFooterVariant {
  return (
    typeof value === "string" &&
    (ORBIT_FOOTER_VARIANTS as readonly string[]).includes(value)
  );
}

export function isOrbitSocialNetwork(
  value: unknown,
): value is OrbitSocialNetwork {
  return (
    typeof value === "string" &&
    (ORBIT_SOCIAL_NETWORKS as readonly string[]).includes(value)
  );
}

export function isOrbitContentKey(value: unknown): value is string {
  return typeof value === "string" && ORBIT_CONTENT_KEY_PATTERN.test(value);
}

export function isOrbitAssetId(value: unknown): value is string {
  return typeof value === "string" && ORBIT_ASSET_ID_PATTERN.test(value);
}

export function resolveOrbitBrand(value?: string | null): OrbitBrand {
  return isOrbitBrand(value) ? value : "codestra";
}

export function resolveOrbitHeaderVariant(
  value?: string | null,
): OrbitHeaderVariant {
  return isOrbitHeaderVariant(value) ? value : "standard";
}

export function resolveOrbitFooterVariant(
  value?: string | null,
): OrbitFooterVariant {
  return isOrbitFooterVariant(value) ? value : "full";
}

export function getOrbitShellAttributes(
  options: OrbitShellOptions = {},
): OrbitShellAttributes {
  return {
    "data-orbit-root": "",
    "data-orbit-brand": resolveOrbitBrand(options.brand),
    "data-orbit-header": resolveOrbitHeaderVariant(options.headerVariant),
    "data-orbit-footer": resolveOrbitFooterVariant(options.footerVariant),
    "data-orbit-social-allowed": String(
      options.socialAllowed ?? true,
    ) as "true" | "false",
  };
}

export function applyOrbitShell(
  target: OrbitAttributeTarget,
  options: OrbitShellOptions = {},
): OrbitShellAttributes {
  const attributes = getOrbitShellAttributes(options);
  for (const [name, value] of Object.entries(attributes)) {
    target.setAttribute(name, value);
  }
  return attributes;
}

export function removeOrbitShell(target: OrbitAttributeTarget): void {
  for (const name of Object.values(ORBIT_DATA_ATTRIBUTES)) {
    target.removeAttribute(name);
  }
}

export function assertOrbitPageShell(
  declaration: OrbitPageShellDeclaration,
): void {
  if (!isOrbitContentKey(declaration.page_key)) {
    throw new TypeError(`Invalid Orbit page key: ${declaration.page_key}`);
  }
  if (!isOrbitHeaderVariant(declaration.header_variant)) {
    throw new TypeError(`Invalid Orbit header variant: ${declaration.header_variant}`);
  }
  if (!isOrbitFooterVariant(declaration.footer_variant)) {
    throw new TypeError(`Invalid Orbit footer variant: ${declaration.footer_variant}`);
  }
  if (!declaration.content_keys.every(isOrbitContentKey)) {
    throw new TypeError("Orbit page contains an invalid content key");
  }
  if (!declaration.asset_ids.every(isOrbitAssetId)) {
    throw new TypeError("Orbit page contains an invalid Asset API ID");
  }
}

function encodePathSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(normalized)) {
    throw new TypeError(`${label} contains unsupported characters`);
  }
  return encodeURIComponent(normalized);
}

function normalizeApiBase(value: string): string {
  const normalized = value.trim().replace(/\/$/, "");
  if (normalized.startsWith("/")) return normalized;
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new TypeError("Orbit API base must be relative or credential-free HTTPS");
  }
  return parsed.toString().replace(/\/$/, "");
}

function validateMutationContext(context: OrbitMutationContext): void {
  if (!context.idempotencyKey.trim()) {
    throw new TypeError("Idempotency-Key is required");
  }
  if (!context.correlationId.trim()) {
    throw new TypeError("X-Correlation-ID is required");
  }
  if (!Number.isInteger(context.expectedVersion) || context.expectedVersion < 0) {
    throw new TypeError("expected resource version must be a non-negative integer");
  }
  if (context.reason.trim().length < 8) {
    throw new TypeError("safe change reason must contain at least eight characters");
  }
}

function mutationHeaders(context: OrbitMutationContext): HeadersInit {
  validateMutationContext(context);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Idempotency-Key": context.idempotencyKey,
    "X-Correlation-ID": context.correlationId,
    "X-Expected-Resource-Version": String(context.expectedVersion),
    "X-Safe-Reason": context.reason,
  };
}

async function responsePayload(response: OrbitFetchResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      return await response.text();
    } catch {
      return undefined;
    }
  }
}

function resolveFetch(candidate?: OrbitFetch): OrbitFetch {
  if (candidate) return candidate;
  if (typeof globalThis.fetch !== "function") {
    throw new TypeError("A fetch implementation is required");
  }
  return globalThis.fetch.bind(globalThis) as unknown as OrbitFetch;
}

export class OrbitBrandClient {
  private readonly baseUrl: string;
  private readonly fetcher: OrbitFetch;

  constructor(options: OrbitBrandClientOptions = {}) {
    this.baseUrl = normalizeApiBase(options.baseUrl ?? "/api");
    this.fetcher = resolveFetch(options.fetch);
  }

  async getFooter(
    brand: OrbitBrand,
    signal?: AbortSignal,
  ): Promise<OrbitFooterResource> {
    const response = await this.fetcher(
      `${this.baseUrl}/v1/brands/${encodePathSegment(brand, "brand")}/footer`,
      {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        signal,
      },
    );
    return this.parseFooterResponse(response);
  }

  async updateFooter(
    brand: OrbitBrand,
    draft: OrbitFooterDraft,
    context: OrbitMutationContext,
    signal?: AbortSignal,
  ): Promise<OrbitFooterResource> {
    if (draft.expected_version !== context.expectedVersion) {
      throw new TypeError("body and header expected versions must match");
    }
    const response = await this.fetcher(
      `${this.baseUrl}/v1/admin/brands/${encodePathSegment(brand, "brand")}/footer`,
      {
        method: "PUT",
        credentials: "include",
        headers: mutationHeaders(context),
        body: JSON.stringify(draft),
        signal,
      },
    );
    return this.parseFooterResponse(response);
  }

  async publishFooter(
    brand: OrbitBrand,
    context: OrbitMutationContext,
    signal?: AbortSignal,
  ): Promise<OrbitFooterResource> {
    const response = await this.fetcher(
      `${this.baseUrl}/v1/admin/brands/${encodePathSegment(brand, "brand")}/footer/publish`,
      {
        method: "POST",
        credentials: "include",
        headers: mutationHeaders(context),
        body: JSON.stringify({
          expected_version: context.expectedVersion,
          reason: context.reason,
        }),
        signal,
      },
    );
    return this.parseFooterResponse(response);
  }

  async rollbackFooter(
    brand: OrbitBrand,
    request: OrbitRollbackRequest,
    context: OrbitMutationContext,
    signal?: AbortSignal,
  ): Promise<OrbitFooterResource> {
    if (request.expected_version !== context.expectedVersion) {
      throw new TypeError("body and header expected versions must match");
    }
    const response = await this.fetcher(
      `${this.baseUrl}/v1/admin/brands/${encodePathSegment(brand, "brand")}/footer/rollback`,
      {
        method: "POST",
        credentials: "include",
        headers: mutationHeaders(context),
        body: JSON.stringify(request),
        signal,
      },
    );
    return this.parseFooterResponse(response);
  }

  private async parseFooterResponse(
    response: OrbitFetchResponse,
  ): Promise<OrbitFooterResource> {
    const payload = await responsePayload(response);
    if (!response.ok) {
      throw new OrbitApiError(
        `Orbit footer request failed with HTTP ${response.status}`,
        response.status,
        payload,
      );
    }
    return assertOrbitFooterResource(payload);
  }
}

export function createOrbitBrandClient(
  options: OrbitBrandClientOptions = {},
): OrbitBrandClient {
  return new OrbitBrandClient(options);
}

export function assertOrbitFooterResource(
  value: unknown,
): OrbitFooterResource {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Orbit footer response must be an object");
  }
  const resource = value as Record<string, unknown>;
  if (!isOrbitBrand(resource.brand)) {
    throw new TypeError("Orbit footer response contains an invalid brand");
  }
  if (!Number.isInteger(resource.resource_version) || Number(resource.resource_version) < 0) {
    throw new TypeError("Orbit footer response contains an invalid resource version");
  }
  if (!isOrbitFooterVariant(resource.default_variant)) {
    throw new TypeError("Orbit footer response contains an invalid default variant");
  }
  if (!Array.isArray(resource.legal_links) || !Array.isArray(resource.social_links)) {
    throw new TypeError("Orbit footer response links must be arrays");
  }
  for (const entry of resource.social_links as unknown[]) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError("Orbit social link must be an object");
    }
    const social = entry as Record<string, unknown>;
    if (!isOrbitSocialNetwork(social.network)) {
      throw new TypeError("Orbit social link contains an unsupported network");
    }
    if (social.published === true) {
      const url = new URL(String(social.url));
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new TypeError("Published Orbit social URLs must be credential-free HTTPS");
      }
    }
  }
  return value as OrbitFooterResource;
}

export interface MountOrbitFooterOptions {
  variant?: OrbitFooterVariant;
  socialAllowed?: boolean;
  document?: Document;
  renderSocialIcon?: (
    network: OrbitSocialNetwork,
    document: Document,
  ) => Node;
}

export function mountOrbitFooter(
  root: HTMLElement,
  resource: OrbitFooterResource,
  options: MountOrbitFooterOptions = {},
): () => void {
  const document = options.document ?? root.ownerDocument;
  const variant = options.variant ?? resource.default_variant;
  const socialAllowed = options.socialAllowed ?? true;
  const footer = document.createElement("footer");
  footer.className = "cx-footer";
  footer.dataset.footerResource = `footer_${resource.brand}_global`;
  footer.dataset.orbitFooter = variant;

  const inner = document.createElement("div");
  inner.className = "cx-footer__inner";

  const identity = document.createElement("div");
  identity.className = "cx-footer__identity";
  const copyright = document.createElement("span");
  copyright.dataset.contentKey = resource.copyright.content_key;
  copyright.textContent = resource.copyright.text;
  identity.append(copyright);

  const legal = document.createElement("nav");
  legal.className = "cx-footer__links";
  legal.setAttribute("aria-label", "Legal");
  for (const entry of resource.legal_links) {
    if (!isOrbitContentKey(entry.content_key)) continue;
    const link = document.createElement("a");
    link.href = entry.href;
    link.textContent = entry.label;
    link.dataset.contentKey = entry.content_key;
    legal.append(link);
  }

  inner.append(identity, legal);

  if (socialAllowed && variant !== "legal-only") {
    const social = document.createElement("nav");
    social.className = "cx-social";
    social.setAttribute("aria-label", "Social media");
    social.dataset.socialLinksFromApi = "true";
    for (const entry of resource.social_links) {
      if (!entry.published || !entry.url || !isOrbitSocialNetwork(entry.network)) {
        continue;
      }
      const link = document.createElement("a");
      link.className = "cx-social__link";
      link.href = entry.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", entry.label);
      link.dataset.socialNetwork = entry.network;
      if (options.renderSocialIcon) {
        link.append(options.renderSocialIcon(entry.network, document));
      } else {
        const label = document.createElement("span");
        label.className = "cx-social__fallback";
        label.textContent = entry.label;
        link.append(label);
      }
      social.append(link);
    }
    if (social.childElementCount > 0) inner.append(social);
  }

  footer.append(inner);
  root.replaceChildren(footer);
  return () => root.replaceChildren();
}
