/**
 * Brand-coloured monogram chips for bookmakers (spec §7.3).
 * Not real logos - trademark/reliability. Resolver: normalise → exact →
 * fuzzy startsWith → deterministic hash-hue fallback.
 */

import { pillBorderColor } from "@/lib/brands/exchanges";

export interface BookieChipStyle {
  bg: string;
  fg: string;
  border: string;
}

type BookiePaletteEntry = Pick<BookieChipStyle, "bg" | "fg">;

const MAP: Record<string, BookiePaletteEntry> = {
  // Core UK matched-betting books
  bet365: { bg: "#027b5b", fg: "#ffe000" },
  skybet: { bg: "#001f3f", fg: "#ffffff" },
  sky: { bg: "#001f3f", fg: "#ffffff" },
  paddypower: { bg: "#004833", fg: "#ffffff" },
  williamhill: { bg: "#00263a", fg: "#f8d549" },
  ladbrokes: { bg: "#d70f37", fg: "#ffffff" },
  coral: { bg: "#0090d4", fg: "#ffffff" },
  betfair: { bg: "#ffb80c", fg: "#1a1a1a" },
  betfairsportsbook: { bg: "#ffb80c", fg: "#1a1a1a" },
  betdaq: { bg: "#0d2d5e", fg: "#ffffff" },
  betdaqsportsbook: { bg: "#0d2d5e", fg: "#ffffff" },
  smarkets: { bg: "#050f19", fg: "#5fd08a" },
  matchbook: { bg: "#57b849", fg: "#0b0b0f" },
  unibet: { bg: "#147b45", fg: "#ffffff" },
  betvictor: { bg: "#1b1f3b", fg: "#f7a800" },
  bwin: { bg: "#000000", fg: "#ffcc00" },
  betano: { bg: "#ff6a00", fg: "#ffffff" },
  betway: { bg: "#00a826", fg: "#ffffff" },
  boylesports: { bg: "#c8102e", fg: "#ffffff" },
  virginbet: { bg: "#e10a0a", fg: "#ffffff" },
  livescorebet: { bg: "#ff7000", fg: "#1a1a1a" },
  betfred: { bg: "#00309e", fg: "#ffffff" },
  tote: { bg: "#001489", fg: "#ffffff" },
  spreadex: { bg: "#00437c", fg: "#ffffff" },
  quinnbet: { bg: "#00437c", fg: "#f8d549" },
  kwiff: { bg: "#6320ee", fg: "#ffffff" },
  midnite: { bg: "#12002d", fg: "#a685ff" },
  copybet: { bg: "#1a56db", fg: "#ffffff" },
  talksportbet: { bg: "#0a0a0a", fg: "#ffcf00" },
  pubcasino: { bg: "#7c3aed", fg: "#ffffff" },
  "888sport": { bg: "#ff8000", fg: "#ffffff" },

  // Wider UK directory - recognisable defaults before Settings override
  "10bet": { bg: "#e31837", fg: "#ffffff" },
  akbets: { bg: "#1a1a2e", fg: "#f5c518" },
  bet600: { bg: "#0b3d91", fg: "#ffffff" },
  betboro: { bg: "#1e3a5f", fg: "#f4b400" },
  betgoodwin: { bg: "#0d47a1", fg: "#ffffff" },
  betmgm: { bg: "#c4a35a", fg: "#1a1a1a" },
  betregal: { bg: "#6b2d5b", fg: "#ffffff" },
  betuk: { bg: "#e30613", fg: "#ffffff" },
  bresbet: { bg: "#003087", fg: "#ffffff" },
  daznbet: { bg: "#f7ff1a", fg: "#0a0a0a" },
  fanteam: { bg: "#00c2ff", fg: "#0a0a0a" },
  grosvenorsport: { bg: "#1a1a1a", fg: "#c9a227" },
  hollywoodbets: { bg: "#e31837", fg: "#ffffff" },
  jeffbet: { bg: "#ff6600", fg: "#ffffff" },
  leovegas: { bg: "#ff6b00", fg: "#ffffff" },
  lottolandsports: { bg: "#e30613", fg: "#ffffff" },
  marathonbet: { bg: "#e30613", fg: "#ffffff" },
  mrplay: { bg: "#00a651", fg: "#ffffff" },
  netbet: { bg: "#e30613", fg: "#ffffff" },
  novibet: { bg: "#00a651", fg: "#ffffff" },
  parimatch: { bg: "#1a1a1a", fg: "#f5c518" },
  planetsportbet: { bg: "#0033a0", fg: "#ffffff" },
  pricedup: { bg: "#6c2bd9", fg: "#ffffff" },
  sportingindex: { bg: "#003366", fg: "#ffffff" },
  starsports: { bg: "#1a1a1a", fg: "#f5c518" },
  thepools: { bg: "#003087", fg: "#ffffff" },
  vbet: { bg: "#1e3a8a", fg: "#ffffff" },
  yeeehaaa: { bg: "#ff4500", fg: "#ffffff" },
  zetbet: { bg: "#0f766e", fg: "#ffffff" },
};

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Deterministic hue for unknown books so chips stay stable between renders. */
function hashStyle(name: string): BookieChipStyle {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const bg = `hsl(${h} 55% 32%)`;
  return { bg, fg: "#ffffff", border: pillBorderColor(bg) };
}

export function bookieStyle(name: string): BookieChipStyle {
  const key = normalise(name);
  if (!key) {
    const bg = "#3f3f46";
    return { bg, fg: "#ffffff", border: pillBorderColor(bg) };
  }
  if (MAP[key]) {
    const { bg, fg } = MAP[key];
    return { bg, fg, border: pillBorderColor(bg) };
  }
  for (const k of Object.keys(MAP)) {
    if (k.startsWith(key) || key.startsWith(k)) {
      const { bg, fg } = MAP[k];
      return { bg, fg, border: pillBorderColor(bg) };
    }
  }
  return hashStyle(key);
}

/** Single brand colour for settings / account chips */
export function bookieBrandColor(name: string, override?: string | null): string {
  if (override?.trim()) return override.trim();
  return bookieStyle(name).bg;
}

/**
 * Pill colours: Settings override for background when set;
 * foreground from static palette when bg matches, else contrast.
 */
export function bookiePillStyle(
  name: string,
  override?: string | null
): BookieChipStyle {
  const base = bookieStyle(name);
  const bg = bookieBrandColor(name, override);
  if (override?.trim() && override.trim().toLowerCase() !== base.bg.toLowerCase()) {
    // Dynamic import avoided - contrast lives on exchanges; inline relative luminance
    const m = bg.replace("#", "");
    if (/^[0-9a-fA-F]{6}$/.test(m) || /^[0-9a-fA-F]{3}$/.test(m)) {
      const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      const fg = 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1a1a1a" : "#ffffff";
      return { bg, fg, border: pillBorderColor(bg) };
    }
  }
  return { bg, fg: base.fg, border: pillBorderColor(bg) };
}

/** Initials = first letters of words, max 2. */
export function bookieInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
