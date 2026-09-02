/**
 * Horizon UI is the framework-neutral presentation contract for Codestra-owned
 * websites, portals and operator applications. It deliberately contains no API
 * client, authentication logic or mutation path.
 */

export const HORIZON_CONTRACT_VERSION = "1.0.0" as const;

export const HORIZON_THEMES = {
  neutral: {
    label: "Neutral",
    accent: "#D9DEE6",
    accentStrong: "#596575",
    accentRgb: "217 222 230",
    description: "Unbranded platform, infrastructure and internal tooling surfaces.",
  },
  codestra: {
    label: "Codestra",
    accent: "#8EA5FF",
    accentStrong: "#435CC7",
    accentRgb: "142 165 255",
    description: "Codestra corporate, AI, marketing and communications products.",
  },
  breero: {
    label: "Breero",
    accent: "#FFB36B",
    accentStrong: "#944300",
    accentRgb: "255 179 107",
    description: "Friendly, trustworthy marketplace and service-booking experiences.",
  },
  beyvra: {
    label: "Beyvra",
    accent: "#7DD3FC",
    accentStrong: "#00688F",
    accentRgb: "125 211 252",
    description: "Trading and financial-market experiences; gains and losses retain semantic colors.",
  },
  moneybee: {
    label: "MoneyBee",
    accent: "#F8D16A",
    accentStrong: "#735B00",
    accentRgb: "248 209 106",
    description: "Loan, application, servicing and financial-wellness experiences.",
  },
  larim: {
    label: "LARIM-A",
    accent: "#C4A7FF",
    accentStrong: "#6848A8",
    accentRgb: "196 167 255",
    description: "LARIM-A customer and operator applications.",
  },
  transport: {
    label: "Transportation",
    accent: "#67E8C2",
    accentStrong: "#00765A",
    accentRgb: "103 232 194",
    description: "Shipper, carrier, freight and operations applications.",
  },
  telnexa: {
    label: "Telnexa",
    accent: "#70B7FF",
    accentStrong: "#005FA8",
    accentRgb: "112 183 255",
    description: "Telephony, messaging and communications experiences.",
  },
  klyrow: {
    label: "Klyrow",
    accent: "#F0A6FF",
    accentStrong: "#8A3C90",
    accentRgb: "240 166 255",
    description: "Email, delivery and communications-platform experiences.",
  },
  social: {
    label: "Codestra Social",
    accent: "#FF9F9F",
    accentStrong: "#A23E4D",
    accentRgb: "255 159 159",
    description: "Social publishing, campaign and collaboration experiences.",
  },
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
  ultra: 1536,
});

export const HORIZON_LAYOUT = Object.freeze({
  appRailPx: 272,
  contentMaxPx: 1200,
  canvasMaxPx: 1440,
  headerDesktopPx: 72,
  headerCompactPx: 64,
  controlSmPx: 36,
  controlMdPx: 44,
  controlLgPx: 52,
});

export const HORIZON_MOTION = Object.freeze({
  fastMs: 120,
  standardMs: 200,
  deliberateMs: 360,
  standardEasing: "cubic-bezier(0.2, 0, 0, 1)",
  emphasizedEasing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
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

export interface HorizonAttributeTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export function isHorizonTheme(value: unknown): value is HorizonThemeName {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(HORIZON_THEMES, value)
  );
}

export function isHorizonAppearance(value: unknown): value is HorizonAppearance {
  return (
    typeof value === "string" &&
    (HORIZON_APPEARANCES as readonly string[]).includes(value)
  );
}

export function resolveHorizonTheme(value?: string | null): HorizonThemeName {
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

/**
 * Applies the Horizon contract to an HTML element or any compatible adapter.
 * The returned values are the normalized attributes that were applied.
 */
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
  return attributes;
}

/** Removes only Horizon-owned root attributes; it does not touch application data. */
export function removeHorizonTheme(target: HorizonAttributeTarget): void {
  target.removeAttribute(HORIZON_DATA_ATTRIBUTES.root);
  target.removeAttribute(HORIZON_DATA_ATTRIBUTES.theme);
  target.removeAttribute(HORIZON_DATA_ATTRIBUTES.appearance);
}
