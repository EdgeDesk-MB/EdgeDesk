export interface FootballLineupPlayer {
  name: string;
  number?: number;
  grid?: string;
}

export interface FootballLineups {
  homeFormation: string | null;
  awayFormation: string | null;
  home: FootballLineupPlayer[];
  away: FootballLineupPlayer[];
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parsePlayers(raw: unknown): FootballLineupPlayer[] {
  if (!Array.isArray(raw)) return [];
  const out: FootballLineupPlayer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = asOptionalString(row.name);
    if (!name) continue;
    const player: FootballLineupPlayer = { name };
    const number = asOptionalNumber(row.number);
    const grid = asOptionalString(row.grid);
    if (number != null) player.number = number;
    if (grid) player.grid = grid;
    out.push(player);
  }
  return out;
}

export function parseFootballLineups(
  raw: string | null | undefined
): FootballLineups | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Record<string, unknown>;
  const home = parsePlayers(row.home);
  const away = parsePlayers(row.away);
  if (home.length === 0 && away.length === 0) return null;
  return {
    homeFormation: asOptionalString(row.homeFormation) ?? null,
    awayFormation: asOptionalString(row.awayFormation) ?? null,
    home,
    away,
  };
}

/** Starting XI names, home then away, for Add bet Selection. */
export function lineupPlayerNames(lineups: FootballLineups | null): string[] {
  if (!lineups) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const player of [...lineups.home, ...lineups.away]) {
    const key = player.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(player.name);
  }
  return names;
}

export function lineupsHaveXi(lineups: FootballLineups | null): boolean {
  return !!lineups && (lineups.home.length > 0 || lineups.away.length > 0);
}

export function formatLineupsCaption(lineups: FootballLineups | null): string | null {
  if (!lineupsHaveXi(lineups) || !lineups) return null;
  const home = lineups.homeFormation;
  const away = lineups.awayFormation;
  if (home && away) return `${home} v ${away}`;
  if (home || away) return home ?? away;
  return "XI in";
}
