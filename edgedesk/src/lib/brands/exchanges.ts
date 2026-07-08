/**
 * Exchange presets: brand identity + the back/lay trading colours their own UIs use.
 * Users can add custom exchanges and override commission and colours — these are
 * just well-known starting points.
 */

export interface ExchangePreset {
  name: string;
  /** Typical headline commission % (user overrides with their own rate) */
  commissionPct: number;
  brandColor: string;
  /** Back-cell colour in the exchange's own UI */
  backColor: string;
  /** Lay-cell colour in the exchange's own UI */
  layColor: string;
}

export const EXCHANGE_PRESETS: ExchangePreset[] = [
  {
    // Dark header, yellow brand; blue "Back all" / pink "Lay all" columns
    name: "Betfair",
    commissionPct: 5,
    brandColor: "#ffb80c",
    backColor: "#a6d8ff",
    layColor: "#fac9d1",
  },
  {
    // Purple header; yellow back cells / mint-green lay cells
    name: "Betdaq",
    commissionPct: 2,
    brandColor: "#7b2d8b",
    backColor: "#fce38f",
    layColor: "#b5e5c4",
  },
  {
    // Near-black navy brand; green buy (back) / blue sell (lay) in the order book
    name: "Smarkets",
    commissionPct: 2,
    brandColor: "#0f1b2b",
    backColor: "#bfe8d4",
    layColor: "#c7dcf5",
  },
  {
    // Dark navy brand; light-blue BACK / salmon LAY cells
    name: "Matchbook",
    commissionPct: 4,
    brandColor: "#16344f",
    backColor: "#b8dff5",
    layColor: "#f7bac2",
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

/** Darken a hex colour by a factor (0..1) — used to derive dark-mode panel tints. */
export function darken(hex: string, factor: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const channel = (i: number) =>
    Math.round(parseInt(full.slice(i, i + 2), 16) * (1 - factor))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/** Lighten a hex colour toward white by a factor (0..1) — derives input tints from panel colours. */
export function lighten(hex: string, factor: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const channel = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * factor)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}
