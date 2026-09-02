/**
 * @deprecated Horizon was the pre-release name for Codestra Orbit. New code
 * must import `@codestra/intake-ui/orbit`. This compatibility module preserves
 * the original helper names while applying the canonical Orbit shell.
 */

import {
  ORBIT_COLORS,
  ORBIT_CONTRACT_VERSION,
  applyOrbitShell,
  removeOrbitShell,
  type OrbitAttributeTarget,
  type OrbitBrand,
} from "./orbit.js";

export const HORIZON_CONTRACT_VERSION = ORBIT_CONTRACT_VERSION;

const compatibilityTheme = (
  label: string,
  description: string,
) => ({
  label,
  accent: ORBIT_COLORS.textMain,
  accentStrong: ORBIT_COLORS.actionPrimaryHover,
  accentRgb: "255 255 255",
  description,
});

export const HORIZON_THEMES = {
  neutral: compatibilityTheme(
    "Neutral",
    "Neutral Orbit presentation for infrastructure and internal tools.",
  ),
  codestra: compatibilityTheme(
    "Codestra",
    "Codestra corporate products using the shared Orbit interaction palette.",
  ),
  breero: compatibilityTheme(
    "Breero",
    "Breero identity expressed through approved Brand API assets and copy.",
  ),
  beyvra: compatibilityTheme(
    "Beyvra",
    "Beyvra identity with semantic financial states preserved by the backend.",
  ),
  moneybee: compatibilityTheme(
    "MoneyBee",
    "MoneyBee identity expressed through approved Brand API assets and copy.",
  ),
  larim: compatibilityTheme(
    "LARIM-A",
    "LARIM-A identity expressed through approved Brand API assets and copy.",
  ),
  transport: compatibilityTheme(
    "Transportation",
    "Freight identity expressed through approved Brand API assets and copy.",
  ),
  telnexa: compatibilityTheme(
    "Telnexa",
    "Telnexa identity expressed through approved Brand API assets and copy.",
  ),
  klyrow: compatibilityTheme(
    "Klyrow",
    "Klyrow identity expressed through approved Brand API assets and copy.",
  ),
  social: compatibilityTheme(
    "Codestra Social",
    "Social identity expressed through approved Brand API assets and copy.",
  ),
} as const;

export type HorizonThemeName = keyof typeof HORIZON_THEMES;
export const HORIZON_THEME_NAMES = Object.freeze(
  Object.keys(HORIZON_THEMES) as HorizonThemeName[],
);

export const HORIZON_APPEARANCES = ["dark", "light", "system"] as const;
export type HorizonAppearance = (typeof HORIZON_APPEARANCES)[number];
export const HORIZON_DEFAULT_THEME: HorizonThemeName = "codestra";
export const HORIZON_DEFAULT_APPEARANCE: HorizonAppearance = "dark";

export const HORIZON_BREAKPOINTS = Object.freeze({
  compact: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
  ultra: 1440,
});

export const HORIZON_LAYOUT = Object.freeze({
  appRailPx: 272,
  contentMaxPx: 1280,
  canvasMaxPx: 1440,
  headerDesktopPx: 76,
  headerCompactPx: 56,
  controlSmPx: 44,
  controlMdPx: 52,
  controlLgPx: 52,
});

export const HORIZON_MOTION = Object.freeze({
  fastMs: 120,
  standardMs: 180,
  deliberateMs: 180,
  standardEasing: "cubic-bezier(0.2, 0, 0, 1)",
  emphasizedEasing: "cubic-bezier(0.2, 0, 0, 1)",
});

export const HORIZON_DATA_ATTRIBUTES = Object.freeze({
  root: "data-horizon-root",
  theme: "data-horizon-theme",
  appearance: "data-horizon-appearance",
});

export interface HorizonThemeOptions {
  theme?: string | null;
  appearance?: string | null;
}

export interface HorizonThemeAttributes {
  "data-horizon-root": "";
  "data-horizon-theme": HorizonThemeName;
  "data-horizon-appearance": HorizonAppearance;
}

export type HorizonAttributeTarget = OrbitAttributeTarget;

export function isHorizonTheme(value: unknown): value is HorizonThemeName {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(HORIZON_THEMES, value)
  );
}

export function isHorizonAppearance(
  value: unknown,
): value is HorizonAppearance {
  return (
    typeof value === "string" &&
    (HORIZON_APPEARANCES as readonly string[]).includes(value)
  );
}

export function resolveHorizonTheme(
  value?: string | null,
): HorizonThemeName {
  return isHorizonTheme(value) ? value : HORIZON_DEFAULT_THEME;
}

export function resolveHorizonAppearance(
  value?: string | null,
): HorizonAppearance {
  return isHorizonAppearance(value) ? value : HORIZON_DEFAULT_APPEARANCE;
}

export function getHorizonThemeAttributes(
  options: HorizonThemeOptions = {},
): HorizonThemeAttributes {
  return {
    "data-horizon-root": "",
    "data-horizon-theme": resolveHorizonTheme(options.theme),
    "data-horizon-appearance": resolveHorizonAppearance(options.appearance),
  };
}

function orbitBrandFor(theme: HorizonThemeName): OrbitBrand {
  if (theme === "transport") return "transportation";
  return theme;
}

export function applyHorizonTheme(
  target: HorizonAttributeTarget,
  options: HorizonThemeOptions = {},
): HorizonThemeAttributes {
  const attributes = getHorizonThemeAttributes(options);
  target.setAttribute(HORIZON_DATA_ATTRIBUTES.root, attributes["data-horizon-root"]);
  target.setAttribute(HORIZON_DATA_ATTRIBUTES.theme, attributes["data-horizon-theme"]);
  target.setAttribute(
    HORIZON_DATA_ATTRIBUTES.appearance,
    attributes["data-horizon-appearance"],
  );
  applyOrbitShell(target, {
    brand: orbitBrandFor(attributes["data-horizon-theme"]),
    headerVariant: "standard",
    footerVariant: "full",
    socialAllowed: true,
  });
  return attributes;
}

export function removeHorizonTheme(target: HorizonAttributeTarget): void {
  target.removeAttribute(HORIZON_DATA_ATTRIBUTES.root);
  target.removeAttribute(HORIZON_DATA_ATTRIBUTES.theme);
  target.removeAttribute(HORIZON_DATA_ATTRIBUTES.appearance);
  removeOrbitShell(target);
}

export * from "./orbit.js";
