/**
 * Brand-coloured monogram chips for bookmakers (spec §7.3).
 * Not real logos — trademark/reliability. Resolver: normalise → exact →
 * fuzzy startsWith → deterministic hash-hue fallback.
 */

export interface BookieChipStyle {
  bg: string;
  fg: string;
}

const MAP: Record<string, BookieChipStyle> = {
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
};

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Deterministic hue for unknown books so chips stay stable between renders. */
function hashStyle(name: string): BookieChipStyle {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return { bg: `hsl(${h} 55% 32%)`, fg: "#ffffff" };
}

export function bookieStyle(name: string): BookieChipStyle {
  const key = normalise(name);
  if (!key) return { bg: "#3f3f46", fg: "#ffffff" };
  if (MAP[key]) return MAP[key];
  for (const k of Object.keys(MAP)) {
    if (k.startsWith(key) || key.startsWith(k)) return MAP[k];
  }
  return hashStyle(key);
}

/** Single brand colour for settings / account chips */
export function bookieBrandColor(name: string, override?: string | null): string {
  if (override?.trim()) return override.trim();
  return bookieStyle(name).bg;
}

/** Initials = first letters of words, max 2. */
export function bookieInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
