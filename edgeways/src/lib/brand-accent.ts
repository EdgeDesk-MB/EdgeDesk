/**
 * Brand accent presets + apply helpers.
 * Sets `--brand` (and contrast-derived logo / muted tokens) on <html>.
 */

export {
  BRAND_ACCENT_COOKIE_KEY,
  BRAND_ACCENT_SETTLE_MS,
  BRAND_ACCENT_STORAGE_KEY,
  BRAND_HIGHLIGHT_MAX_LUMINANCE,
  BRAND_LOGO_MIN_LUMINANCE,
  BRAND_LUMINANCE_THRESHOLD,
  BRAND_TEXT_MIN_LUMINANCE,
  DEFAULT_BRAND_ACCENT_HEX,
} from "@/lib/brand-accent-constants";
export { BRAND_ACCENT_FOUC_SCRIPT } from "@/lib/brand-accent-fouc";

import {
  BRAND_ACCENT_COOKIE_KEY,
  BRAND_ACCENT_SETTLE_MS,
  BRAND_ACCENT_STORAGE_KEY,
  BRAND_HIGHLIGHT_MAX_LUMINANCE,
  BRAND_LOGO_MIN_LUMINANCE,
  BRAND_LUMINANCE_THRESHOLD,
  BRAND_TEXT_MIN_LUMINANCE,
  DEFAULT_BRAND_ACCENT_HEX,
} from "@/lib/brand-accent-constants";

export type BrandAccentPresetId =
  | "amber"
  | "viridian"
  | "coral"
  | "azure"
  | "orchid"
  | "citrine"
  | "rose"
  | "custom";

export type BrandAccentPreset = {
  id: Exclude<BrandAccentPresetId, "custom">;
  label: string;
  hex: string;
};

export const BRAND_ACCENT_PRESETS: readonly BrandAccentPreset[] = [
  { id: "amber", label: "Amber", hex: "#FFC71E" },
  { id: "viridian", label: "Viridian", hex: "#2BB673" },
  { id: "coral", label: "Coral", hex: "#FF6B4A" },
  { id: "azure", label: "Azure", hex: "#3B82F6" },
  { id: "orchid", label: "Orchid", hex: "#C084FC" },
  { id: "citrine", label: "Citrine", hex: "#EAB308" },
  { id: "rose", label: "Rose", hex: "#F43F5E" },
] as const;

export const DEFAULT_BRAND_ACCENT_PRESET: BrandAccentPresetId = "amber";

export type BrandAccentState = {
  presetId: BrandAccentPresetId;
  hex: string;
};

export type BrandAccentDerived = {
  brand: string;
  /** Light-mode topbar logo — lifted to ink-readable floor when dark (no sat boost). */
  brandLogo: string;
  /**
   * Accent type on dark canvas / ink plates (selected nav, counters, chips).
   * Raw brand when light; lifted when dark so it clears contrast.
   */
  brandText: string;
  /**
   * Thin accents on light surfaces (tab underlines, mobile stripe).
   * Raw brand when already ≤ max luminance; darkened when too bright.
   */
  brandHighlight: string;
  /** Ink or white sitting ON brand fills (buttons, Pro tag, filter counts). */
  brandForeground: "#FFFFFF" | "#111111";
  /** Ink or white for marks sitting on the brand plate (dark topbar). */
  brandOnTopbar: "#FFFFFF" | "#111111";
  /** Inactive meta-tab ink/white on the brand plate (same flip as logo). */
  topbarMutedOnBrand: "#FFFFFF" | "#111111";
  /** Raw brand below {@link BRAND_LUMINANCE_THRESHOLD}. */
  brandPlateDark: boolean;
  /**
   * Ink or white on the boosted logo plate (`--brand-logo` / light Login).
   * May differ from {@link brandForeground} when the logo boost crosses the
   * luminance threshold (e.g. Viridian).
   */
  brandLogoForeground: "#FFFFFF" | "#111111";
  /**
   * Face shadow for light-mode Login / burger (`bg-topbar-accent` = logo).
   * Based on logo-plate luminance: dark → soft chip; light → raised button.
   */
  topbarAccentFaceShadow: string;
};

export type ApplyBrandAccentOptions = {
  /** Fires after CSS vars are set and the transition settle window elapses. */
  onReady?: () => void;
  settleMs?: number;
};

export function normalizeHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = s.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  return `#${m[1]!.toUpperCase()}`;
}

export function isBrandAccentPresetId(value: string | null | undefined): value is BrandAccentPresetId {
  return (
    value === "amber" ||
    value === "viridian" ||
    value === "coral" ||
    value === "azure" ||
    value === "orchid" ||
    value === "citrine" ||
    value === "rose" ||
    value === "custom"
  );
}

export function hexForPreset(id: BrandAccentPresetId, customHex?: string): string {
  if (id === "custom") {
    return normalizeHex(customHex) ?? DEFAULT_BRAND_ACCENT_HEX;
  }
  return BRAND_ACCENT_PRESETS.find((p) => p.id === id)?.hex ?? DEFAULT_BRAND_ACCENT_HEX;
}

function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex);
  if (!normalized) return 0;
  const n = Number.parseInt(normalized.slice(1), 16);
  const r = srgbChannelToLinear((n >> 16) & 255);
  const g = srgbChannelToLinear((n >> 8) & 255);
  const b = srgbChannelToLinear(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White on dark plates, `#111` on light plates. */
export function contrastInkOrWhite(bgHex: string): "#FFFFFF" | "#111111" {
  return relativeLuminance(bgHex) < BRAND_LUMINANCE_THRESHOLD ? "#FFFFFF" : "#111111";
}

/**
 * Inactive meta-tab colour on a given plate — full `#111` / white flip.
 * Greys failed contrast on mid brand plates (e.g. Viridian).
 */
export function mutedForegroundOn(bgHex: string): "#FFFFFF" | "#111111" {
  return contrastInkOrWhite(bgHex);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const n = Number.parseInt(normalized.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) {
    const v = Math.round(l * 255);
    return `#${v.toString(16).padStart(2, "0").repeat(3).toUpperCase()}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * Light-mode topbar logo on the ink `#111` plate (lockup, Beta, Login fill).
 * Light brands stay as-is; dark brands are lightness-lifted until they clear
 * {@link BRAND_LOGO_MIN_LUMINANCE} — same floor as brand-text. Saturation is
 * preserved (no vibrance boost).
 */
export function boostBrandForLightLogo(hex: string): string {
  const brand = normalizeHex(hex) ?? DEFAULT_BRAND_ACCENT_HEX;
  if (relativeLuminance(brand) >= BRAND_LUMINANCE_THRESHOLD) {
    return brand;
  }
  const rgb = hexToRgb(brand);
  if (!rgb) return brand;
  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  let lifted = brand;
  for (let i = 0; i < 14; i++) {
    // Never clamp below current L — high-L / low-Y hues (orchid) must not darken.
    l = Math.min(0.84, l + 0.055);
    lifted = hslToHex(h, s, l);
    if (relativeLuminance(lifted) >= BRAND_LOGO_MIN_LUMINANCE) break;
  }
  return lifted;
}

/**
 * Accent colour for text/icons on dark canvas, secondary plates, and ink chips.
 * Light brands stay as-is; dark brands are lightness-lifted until they clear
 * {@link BRAND_TEXT_MIN_LUMINANCE}. Saturation is preserved (no floor / boost).
 */
export function ensureBrandTextOnDark(hex: string): string {
  const brand = normalizeHex(hex) ?? DEFAULT_BRAND_ACCENT_HEX;
  if (relativeLuminance(brand) >= BRAND_LUMINANCE_THRESHOLD) {
    return brand;
  }
  const rgb = hexToRgb(brand);
  if (!rgb) return brand;
  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  let lifted = brand;
  for (let i = 0; i < 14; i++) {
    l = Math.min(0.84, l + 0.055);
    lifted = hslToHex(h, s, l);
    if (relativeLuminance(lifted) >= BRAND_TEXT_MIN_LUMINANCE) break;
  }
  return lifted;
}

/**
 * Thin accent strokes on light surfaces (underlines, stripes).
 * Dark / mid brands stay as-is; bright brands are darkened until they clear
 * {@link BRAND_HIGHLIGHT_MAX_LUMINANCE} — reverse of {@link ensureBrandTextOnDark}.
 * Saturation is preserved (achromatic greys stay grey).
 */
export function ensureBrandOnLight(hex: string): string {
  const brand = normalizeHex(hex) ?? DEFAULT_BRAND_ACCENT_HEX;
  if (relativeLuminance(brand) <= BRAND_HIGHLIGHT_MAX_LUMINANCE) {
    return brand;
  }
  const rgb = hexToRgb(brand);
  if (!rgb) return brand;
  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  if (s < 0.08) s = 0;
  let darkened = brand;
  for (let i = 0; i < 14; i++) {
    l = Math.max(0.12, l - 0.055);
    darkened = hslToHex(h, s, l);
    if (relativeLuminance(darkened) <= BRAND_HIGHLIGHT_MAX_LUMINANCE) break;
  }
  return darkened;
}

export function deriveBrandAccent(hex: string): BrandAccentDerived {
  const brand = normalizeHex(hex) ?? DEFAULT_BRAND_ACCENT_HEX;
  const onPlate = contrastInkOrWhite(brand);
  const brandLogo = boostBrandForLightLogo(brand);
  const brandPlateDark = relativeLuminance(brand) < BRAND_LUMINANCE_THRESHOLD;
  const logoPlateDark =
    relativeLuminance(brandLogo) < BRAND_LUMINANCE_THRESHOLD;
  return {
    brand,
    brandLogo,
    brandText: ensureBrandTextOnDark(brand),
    brandHighlight: ensureBrandOnLight(brand),
    brandForeground: onPlate,
    brandOnTopbar: onPlate,
    topbarMutedOnBrand: mutedForegroundOn(brand),
    brandPlateDark,
    brandLogoForeground: contrastInkOrWhite(brandLogo),
    topbarAccentFaceShadow: logoPlateDark
      ? "var(--ew-ink-plate-shadow)"
      : "var(--ew-btn-shadow)",
  };
}

let settleTimer: ReturnType<typeof setTimeout> | null = null;

/** Inline style map for `<html style={...}>` (SSR cookie / FOUC parity). */
export function brandAccentStyle(hex: string): Record<string, string> {
  const derived = deriveBrandAccent(hex);
  return {
    "--brand": derived.brand,
    "--brand-logo": derived.brandLogo,
    "--brand-logo-foreground": derived.brandLogoForeground,
    "--brand-text": derived.brandText,
    "--brand-highlight": derived.brandHighlight,
    "--brand-foreground": derived.brandForeground,
    "--brand-on-topbar": derived.brandOnTopbar,
    "--topbar-muted-on-brand": derived.topbarMutedOnBrand,
    "--topbar-accent-face-shadow": derived.topbarAccentFaceShadow,
  };
}

function expireBrandAccentCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${BRAND_ACCENT_COOKIE_KEY}=;path=/;max-age=0;SameSite=Lax`;
}

function writeBrandAccentCookie(hex: string): void {
  if (typeof document === "undefined") return;
  const normalized = normalizeHex(hex) ?? DEFAULT_BRAND_ACCENT_HEX;
  if (normalized === DEFAULT_BRAND_ACCENT_HEX) {
    expireBrandAccentCookie();
    return;
  }
  document.cookie = `${BRAND_ACCENT_COOKIE_KEY}=${encodeURIComponent(normalized)};path=/;max-age=31536000;SameSite=Lax`;
}

/** Apply `--brand` + contrast-derived tokens. Optional `onReady` after settle. */
export function applyBrandAccent(hex: string, options?: ApplyBrandAccentOptions): void {
  if (typeof document === "undefined") return;
  const derived = deriveBrandAccent(hex);
  const root = document.documentElement;
  root.style.setProperty("--brand", derived.brand);
  root.style.setProperty("--brand-logo", derived.brandLogo);
  root.style.setProperty(
    "--brand-logo-foreground",
    derived.brandLogoForeground
  );
  root.style.setProperty("--brand-text", derived.brandText);
  root.style.setProperty("--brand-highlight", derived.brandHighlight);
  root.style.setProperty("--brand-foreground", derived.brandForeground);
  root.style.setProperty("--brand-on-topbar", derived.brandOnTopbar);
  root.style.setProperty("--topbar-muted-on-brand", derived.topbarMutedOnBrand);
  root.style.setProperty(
    "--topbar-accent-face-shadow",
    derived.topbarAccentFaceShadow
  );
  root.dataset.brandPlate = derived.brandPlateDark ? "dark" : "light";
  writeBrandAccentCookie(derived.brand);
  // Dynamic import avoids a static cycle (bolt-mark → deriveBrandAccent).
  void import("@/lib/brand/bolt-mark").then((m) => {
    m.setAccentFavicon(derived.brand);
  });

  const onReady = options?.onReady;
  if (!onReady) return;
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
  const settleMs = options?.settleMs ?? BRAND_ACCENT_SETTLE_MS;
  settleTimer = setTimeout(() => {
    settleTimer = null;
    requestAnimationFrame(() => onReady());
  }, settleMs);
}

export function readStoredBrandAccent(): BrandAccentState {
  if (typeof window === "undefined") {
    return { presetId: DEFAULT_BRAND_ACCENT_PRESET, hex: DEFAULT_BRAND_ACCENT_HEX };
  }
  try {
    const raw = window.localStorage.getItem(BRAND_ACCENT_STORAGE_KEY);
    if (!raw) {
      return { presetId: DEFAULT_BRAND_ACCENT_PRESET, hex: DEFAULT_BRAND_ACCENT_HEX };
    }
    const parsed = JSON.parse(raw) as { presetId?: string; hex?: string };
    const presetId = isBrandAccentPresetId(parsed.presetId)
      ? parsed.presetId
      : DEFAULT_BRAND_ACCENT_PRESET;
    const hex = hexForPreset(presetId, parsed.hex);
    return { presetId, hex };
  } catch {
    return { presetId: DEFAULT_BRAND_ACCENT_PRESET, hex: DEFAULT_BRAND_ACCENT_HEX };
  }
}

export function writeStoredBrandAccent(state: BrandAccentState): void {
  if (typeof window === "undefined") return;
  const hex = normalizeHex(state.hex) ?? DEFAULT_BRAND_ACCENT_HEX;
  const presetId = isBrandAccentPresetId(state.presetId)
    ? state.presetId
    : DEFAULT_BRAND_ACCENT_PRESET;
  if (presetId === DEFAULT_BRAND_ACCENT_PRESET && hex === DEFAULT_BRAND_ACCENT_HEX) {
    try {
      window.localStorage.removeItem(BRAND_ACCENT_STORAGE_KEY);
    } catch {
      /* private mode / quota */
    }
    expireBrandAccentCookie();
    return;
  }
  try {
    window.localStorage.setItem(
      BRAND_ACCENT_STORAGE_KEY,
      JSON.stringify({ presetId, hex })
    );
  } catch {
    /* private mode / quota */
  }
  writeBrandAccentCookie(hex);
}
