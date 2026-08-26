/**
 * Free-bet reward scope: a named match (and optional date) that Convert
 * must follow. Qualifying stays on the campaign sport / user default.
 */

import { isKnownSport, isRacingSport, type SportValue } from "@/lib/sports";

const VS_SPLIT = /\s+(?:vs?\.?|v)\s+/i;

/** Promo-email shortenings → names API-Football typically uses. */
const TEAM_ALIASES: Record<string, string> = {
  "man utd": "manchester united",
  "man united": "manchester united",
  "man u": "manchester united",
  mufc: "manchester united",
  "man city": "manchester city",
  psg: "paris saint germain",
  "paris sg": "paris saint germain",
  spurs: "tottenham",
  wolves: "wolverhampton",
  "notts forest": "nottingham forest",
};

function normaliseTeam(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function canonicalTeam(value: string): string {
  const n = normaliseTeam(value);
  return TEAM_ALIASES[n] ?? n;
}

export function parseRewardEventTeams(
  label: string | null | undefined
): { homeTeam: string; awayTeam: string } | null {
  const raw = label?.trim();
  if (!raw) return null;
  const parts = raw.split(VS_SPLIT).map((p) => p.replace(/\s+/g, " ").trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (parts[0].length > 40 || parts[1].length > 40) return null;
  return { homeTeam: parts[0], awayTeam: parts[1] };
}

export function rewardTeamsMatch(a: string, b: string): boolean {
  const ca = canonicalTeam(a);
  const cb = canonicalTeam(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  return ca.includes(cb) || cb.includes(ca);
}

/**
 * Sport for a named reward event. Uses the campaign sport when it is a real
 * non-racing sport (tennis vs, etc.). Otherwise a vs-pair is football.
 * Returns null when the free bet is not event-scoped.
 */
export function inferRewardEventSport(
  label: string | null | undefined,
  offerSport?: string | null
): SportValue | null {
  const teams = parseRewardEventTeams(label);
  if (!teams) return null;
  if (isKnownSport(offerSport) && !isRacingSport(offerSport)) return offerSport;
  return "football";
}

export function findRewardEventMatch<
  T extends {
    homeTeam: string;
    awayTeam: string;
    sport?: string | null;
    status?: string | null;
  },
>(items: readonly T[], homeTeam: string, awayTeam: string, sport?: string | null): T | undefined {
  const home = homeTeam.trim();
  const away = awayTeam.trim();
  if (!home || !away) return undefined;
  return items.find((item) => {
    if (item.status === "finished") return false;
    if (sport && (item.sport ?? "football") !== sport) return false;
    return rewardTeamsMatch(item.homeTeam, home) && rewardTeamsMatch(item.awayTeam, away);
  });
}
