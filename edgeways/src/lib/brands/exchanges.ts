/**
 * Exchange presets: brand identity + the back/lay trading colours their own UIs use.
 * Users can add custom exchanges and override commission and colours - these are
 * just well-known starting points.
 */

export interface ExchangePreset {
  name: string;
  /** Typical headline commission % (user overrides with their own rate) */
  commissionPct: number;
  brandColor: string;
  /** False for lay-only venues (BetConnect). */
  canBack: boolean;
  /** Light-mode back-cell colour. Unused when `canBack` is false (still seeded for Settings). */
  backColor: string;
  /** Light-mode lay-cell colour */
  layColor: string;
}

const retiredExchangeMarks: Record<string, readonly string[]> = {
  smarkets: ["#0f1b2b", "#00a651"],
  matchbook: ["#16344f", "#e30613"],
  betconnect: ["#00A3FF"],
};

/** Old Settings cell hexes so desks pick up the new light palette. */
const retiredExchangeCells: Record<string, readonly string[]> = {
  betfair: ["#a6d8ff", "#fac9d1"],
  betdaq: ["#fce38f", "#b5e5c4", "#a6d8ff", "#fac9d1", "#a7d8ff", "#fbc9d2"],
  smarkets: ["#bfe8d4", "#c7dcf5"],
  matchbook: ["#b8dff5", "#f7bac2"],
  betconnect: ["#9ad8ff", "#9af0b8"],
};

export function findExchangePreset(name: string): ExchangePreset | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return EXCHANGE_PRESETS.find((p) => p.name.toLowerCase() === key);
}

export function exchangeSupportsBack(name: string): boolean {
  const preset = findExchangePreset(name);
  if (!preset) return true;
  return preset.canBack;
}

function isRetired(name: string, hex: string | null | undefined, table: Record<string, readonly string[]>): boolean {
  const trimmed = hex?.trim();
  if (!trimmed) return false;
  const retired = table[name.trim().toLowerCase()] ?? [];
  return retired.some((item) => item.toLowerCase() === trimmed.toLowerCase());
}

/** Dot / badge mark. Settings override wins unless it is a retired navy preset. */
export function exchangeBrandColor(name: string, override?: string | null): string {
  const preset = findExchangePreset(name);
  const trimmed = override?.trim();
  if (trimmed && !isRetired(name, trimmed, retiredExchangeMarks)) {
    return trimmed;
  }
  return preset?.brandColor ?? trimmed ?? "#3f3f46";
}

function sameHex(a?: string | null, b?: string | null): boolean {
  return !!a?.trim() && !!b?.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isCustomCell(
  name: string,
  override: string | null | undefined,
  presetHex: string | null | undefined
): boolean {
  const trimmed = override?.trim();
  if (!trimmed) return false;
  if (isRetired(name, trimmed, retiredExchangeCells)) return false;
  if (sameHex(trimmed, presetHex)) return false;
  return true;
}

function resolveCell(
  name: string,
  role: "back" | "lay",
  override?: string | null
): string | null {
  const preset = findExchangePreset(name);
  if (role === "back" && preset && !preset.canBack) return null;
  const presetHex = role === "back" ? preset?.backColor : preset?.layColor;
  if (isCustomCell(name, override, presetHex)) {
    return override!.trim();
  }
  if (!preset) return override?.trim() || null;
  return presetHex ?? null;
}

/** Light-mode back plate. Null when the venue cannot be a back (BetConnect). */
export function exchangeBackColor(name: string, override?: string | null): string | null {
  return resolveCell(name, "back", override);
}

export function exchangeLayColor(name: string, override?: string | null): string {
  return resolveCell(name, "lay", override) ?? "#FBC9D2";
}

export function exchangeBackColorDark(name: string, override?: string | null): string | null {
  const light = exchangeBackColor(name, override);
  return light ? muteForDark(light) : null;
}

export function exchangeLayColorDark(name: string, override?: string | null): string {
  return muteForDark(exchangeLayColor(name, override));
}

/**
 * Empty plate before a bookie/exchange tint settles.
 * Light: a step darker than `--page`. Dark: a step lighter than `--page`.
 */
export const EMPTY_PANEL_LIGHT = "var(--panel-empty)";
export const EMPTY_PANEL_DARK = "var(--panel-empty-dark)";

/**
 * Same hue as light, prepped for the dark desk. Lock L and scale C so
 * plates stay pastel. `from` keeps yellow yellow (a mix toward grey
 * made low-chroma pastels wander into brown).
 */
export function muteForDark(color: string): string {
  return `oklch(from ${color} 0.36 calc(c * 0.3) h)`;
}

export const EXCHANGE_PRESETS: ExchangePreset[] = [
  {
    name: "Betfair",
    commissionPct: 5,
    brandColor: "#ffb80c",
    canBack: true,
    backColor: "#A7D8FF",
    layColor: "#FBC9D2",
  },
  {
    name: "Betdaq",
    commissionPct: 2,
    brandColor: "#7b2d8b",
    canBack: true,
    backColor: "#FFEFB1",
    layColor: "#BBE7D3",
  },
  {
    name: "Smarkets",
    commissionPct: 2,
    brandColor: "#00753a",
    canBack: true,
    backColor: "#D6E2FE",
    layColor: "#D4F9E9",
  },
  {
    name: "Matchbook",
    commissionPct: 4,
    brandColor: "#8a151c",
    canBack: true,
    backColor: "#8DD2F1",
    layColor: "#FFAEB4",
  },
  {
    // Lay-only. No back cell; hide from bookie / back pickers.
    name: "BetConnect",
    commissionPct: 2,
    brandColor: "#15213c",
    canBack: false,
    backColor: "#A7D8FF",
    layColor: "#81AED3",
  },
];

/** Best-effort text colour for a chip on the given background. */
export function contrastText(hex: string): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1a1a1a" : "#ffffff";
}

/**
 * Darken a colour toward black by a factor (0..1) - used to derive dark-mode
 * panel tints. `color-mix` accepts any valid CSS colour (hex, `hsl(...)`,
 * named, etc.), not just hex - needed because unmapped bookies fall back to
 * a deterministic `hsl(...)` string (see `hashStyle` in `brands/bookies.ts`).
 */
export function darken(color: string, factor: number): string {
  const pct = Math.round((1 - factor) * 100);
  return `color-mix(in srgb, ${color} ${pct}%, black)`;
}

/** Lighten a colour toward white by a factor (0..1) - derives input tints from panel colours. */
export function lighten(color: string, factor: number): string {
  const pct = Math.round((1 - factor) * 100);
  return `color-mix(in srgb, ${color} ${pct}%, white)`;
}

/** Pill border ~20% darker than background — works with hex, hsl, and Settings overrides. */
export function pillBorderColor(bg: string, darkenRatio = 0.2): string {
  const mix = Math.round((1 - darkenRatio) * 100);
  return `color-mix(in srgb, ${bg} ${mix}%, black)`;
}

/** CSS vars for a Back/Lay plate. `light` null = empty page-relative plate. */
export function panelTintVars(
  light: string | null,
  dark?: string | null
): Record<"--panel" | "--panel-dark" | "--pi" | "--pi-dark", string> {
  const panel = light ?? EMPTY_PANEL_LIGHT;
  const panelDark = dark ?? (light ? muteForDark(light) : EMPTY_PANEL_DARK);
  return {
    "--panel": panel,
    "--panel-dark": panelDark,
    "--pi": lighten(panel, 0.62),
    "--pi-dark": lighten(panelDark, 0.18),
  };
}
