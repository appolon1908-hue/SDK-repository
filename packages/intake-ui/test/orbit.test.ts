import { describe, expect, it } from "vitest";
import {
  ORBIT_COLORS,
  ORBIT_FOOTER_VARIANTS,
  ORBIT_GEOMETRY,
  ORBIT_SOCIAL_NETWORKS,
  OrbitBrandClient,
  applyOrbitShell,
  assertOrbitFooterResource,
  assertOrbitPageShell,
  getOrbitShellAttributes,
  isOrbitAssetId,
  isOrbitContentKey,
  removeOrbitShell,
  type OrbitFetch,
  type OrbitFooterResource,
} from "../src/orbit.js";

class AttributeTarget {
  readonly values = new Map<string, string>();

  setAttribute(name: string, value: string): void {
    this.values.set(name, value);
  }

  removeAttribute(name: string): void {
    this.values.delete(name);
  }
}

const footerResource: OrbitFooterResource = {
  brand: "codestra",
  resource_version: 4,
  publication_status: "published",
  default_variant: "full",
  copyright: {
    content_key: "codestra.global.footer.identity.copyright",
    text: "© 2026 CODESTRA.CO",
  },
  legal_links: [
    {
      content_key: "codestra.global.footer.policy.privacy",
      href: "/privacy",
      label: "Privacy",
    },
  ],
  social_links: [
    {
      network: "linkedin",
      url: "https://www.linkedin.com/company/codestra-example",
      label: "Codestra on LinkedIn",
      published: true,
    },
    {
      network: "x",
      url: "",
      label: "Codestra on X",
      published: false,
    },
  ],
  published_at: "2026-09-02T00:00:00Z",
  publication_id: "pub_footer_4",
};

describe("Codestra Orbit V2 contract", () => {
  it("publishes the exact approved color system", () => {
    expect(ORBIT_COLORS).toEqual({
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
  });

  it("publishes the exact approved geometry", () => {
    expect(ORBIT_GEOMETRY).toEqual({
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
  });

  it("keeps footer variants and social networks exact", () => {
    expect(ORBIT_FOOTER_VARIANTS).toEqual([
      "full",
      "compact",
      "auth-compact",
      "legal-only",
    ]);
    expect(ORBIT_SOCIAL_NETWORKS).toEqual([
      "linkedin",
      "facebook",
      "instagram",
      "x",
      "youtube",
      "github",
      "tiktok",
      "threads",
    ]);
  });

  it("normalizes, applies, and removes only Orbit shell attributes", () => {
    expect(getOrbitShellAttributes()).toEqual({
      "data-orbit-root": "",
      "data-orbit-brand": "codestra",
      "data-orbit-header": "standard",
      "data-orbit-footer": "full",
      "data-orbit-social-allowed": "true",
    });

    const target = new AttributeTarget();
    target.setAttribute("data-tenant", "tenant-1");
    applyOrbitShell(target, {
      brand: "beyvra",
      headerVariant: "auth",
      footerVariant: "auth-compact",
      socialAllowed: false,
    });
    expect(target.values.get("data-orbit-brand")).toBe("beyvra");
    expect(target.values.get("data-orbit-social-allowed")).toBe("false");

    removeOrbitShell(target);
    expect(target.values.has("data-orbit-root")).toBe(false);
    expect(target.values.get("data-tenant")).toBe("tenant-1");
  });

  it("validates stable content keys and Asset API IDs", () => {
    expect(isOrbitContentKey("codestra.account.login.title")).toBe(true);
    expect(isOrbitContentKey("title")).toBe(false);
    expect(isOrbitAssetId("ast_codestra_logo_primary")).toBe(true);
    expect(isOrbitAssetId("https://example.test/logo.svg")).toBe(false);

    expect(() =>
      assertOrbitPageShell({
        page_key: "codestra.account.login",
        header_variant: "auth",
        footer_variant: "auth-compact",
        social_links_allowed: true,
        content_keys: ["codestra.account.login.title"],
        asset_ids: ["ast_codestra_logo_primary"],
      }),
    ).not.toThrow();

    expect(() =>
      assertOrbitPageShell({
        page_key: "login",
        header_variant: "auth",
        footer_variant: "auth-compact",
        social_links_allowed: true,
        content_keys: [],
        asset_ids: [],
      }),
    ).toThrow(/page key/i);
  });

  it("accepts published HTTPS social entries and rejects insecure ones", () => {
    expect(assertOrbitFooterResource(footerResource)).toBe(footerResource);
    expect(() =>
      assertOrbitFooterResource({
        ...footerResource,
        social_links: [
          {
            network: "linkedin",
            url: "http://example.test/codestra",
            label: "Codestra",
            published: true,
          },
        ],
      }),
    ).toThrow(/credential-free HTTPS/i);
  });

  it("sends required governance headers on footer mutations", async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher: OrbitFetch = async (input, init) => {
      requests.push({ input, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return footerResource;
        },
        async text() {
          return JSON.stringify(footerResource);
        },
      };
    };
    const client = new OrbitBrandClient({ baseUrl: "/api", fetch: fetcher });

    await client.updateFooter(
      "codestra",
      {
        expected_version: 4,
        default_variant: "full",
        copyright: footerResource.copyright,
        legal_links: footerResource.legal_links,
        social_links: footerResource.social_links,
      },
      {
        idempotencyKey: "idem-footer-4",
        correlationId: "corr-footer-4",
        expectedVersion: 4,
        reason: "Publish approved corporate footer",
      },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]?.input).toBe("/api/v1/admin/brands/codestra/footer");
    expect(requests[0]?.init?.method).toBe("PUT");
    expect(requests[0]?.init?.credentials).toBe("include");
    expect(requests[0]?.init?.headers).toMatchObject({
      "Idempotency-Key": "idem-footer-4",
      "X-Correlation-ID": "corr-footer-4",
      "X-Expected-Resource-Version": "4",
      "X-Safe-Reason": "Publish approved corporate footer",
    });
  });
});
