import { describe, expect, it } from "vitest";
import {
  HORIZON_APPEARANCES,
  HORIZON_DEFAULT_APPEARANCE,
  HORIZON_DEFAULT_THEME,
  HORIZON_THEMES,
  HORIZON_THEME_NAMES,
  applyHorizonTheme,
  getHorizonThemeAttributes,
  isHorizonAppearance,
  isHorizonTheme,
  removeHorizonTheme,
  resolveHorizonAppearance,
  resolveHorizonTheme,
} from "../src/horizon.js";

class AttributeTarget {
  readonly values = new Map<string, string>();

  setAttribute(name: string, value: string): void {
    this.values.set(name, value);
  }

  removeAttribute(name: string): void {
    this.values.delete(name);
  }
}

describe("Horizon theme contract", () => {
  it("keeps the theme catalogue and exported names aligned", () => {
    expect(HORIZON_THEME_NAMES).toEqual(Object.keys(HORIZON_THEMES));
    expect(new Set(HORIZON_THEME_NAMES).size).toBe(HORIZON_THEME_NAMES.length);
  });

  it("defines valid hexadecimal accents and RGB triplets", () => {
    for (const theme of Object.values(HORIZON_THEMES)) {
      expect(theme.accent).toMatch(/^#[0-9A-F]{6}$/i);
      expect(theme.accentStrong).toMatch(/^#[0-9A-F]{6}$/i);
      expect(theme.accentRgb).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });

  it("falls back safely for unknown theme and appearance values", () => {
    expect(resolveHorizonTheme("unknown")).toBe(HORIZON_DEFAULT_THEME);
    expect(resolveHorizonAppearance("sepia")).toBe(HORIZON_DEFAULT_APPEARANCE);
    expect(getHorizonThemeAttributes()).toEqual({
      "data-horizon-root": "",
      "data-horizon-theme": HORIZON_DEFAULT_THEME,
      "data-horizon-appearance": HORIZON_DEFAULT_APPEARANCE,
    });
  });

  it("recognizes supported values", () => {
    for (const name of HORIZON_THEME_NAMES) expect(isHorizonTheme(name)).toBe(true);
    for (const appearance of HORIZON_APPEARANCES) {
      expect(isHorizonAppearance(appearance)).toBe(true);
    }
    expect(isHorizonTheme(null)).toBe(false);
    expect(isHorizonAppearance(undefined)).toBe(false);
  });

  it("applies and removes only Horizon-owned attributes", () => {
    const target = new AttributeTarget();
    target.setAttribute("data-tenant", "tenant-1");

    expect(applyHorizonTheme(target, { theme: "breero", appearance: "light" })).toEqual({
      "data-horizon-root": "",
      "data-horizon-theme": "breero",
      "data-horizon-appearance": "light",
    });
    expect(target.values.get("data-horizon-theme")).toBe("breero");

    removeHorizonTheme(target);
    expect(target.values.has("data-horizon-theme")).toBe(false);
    expect(target.values.get("data-tenant")).toBe("tenant-1");
  });
});
