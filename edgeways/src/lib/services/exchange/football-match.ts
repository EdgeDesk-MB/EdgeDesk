/**
 * Football team / event matching for Betfair soccer catalogues.
 * API-Football uses full names; Betfair often shortens them (Man Utd, Nottm Forest).
 */

const WEAK_TOKENS = new Set([
  "united",
  "city",
  "town",
  "hotspur",
  "wanderers",
  "athletic",
  "club",
  "real",
  "sporting",
  "the",
  "de",
  "and",
]);

/** After normalisation, map common shorts onto one canonical form. */
const TEAM_CANONICAL: Record<string, string> = {
  "man utd": "manchester united",
  "man united": "manchester united",
  "manchester utd": "manchester united",
  "man city": "manchester city",
  "spurs": "tottenham",
  "tottenham hotspur": "tottenham",
  "nottm forest": "nottingham forest",
  "notts forest": "nottingham forest",
  "wolves": "wolverhampton",
  "wolverhampton wanderers": "wolverhampton",
  "brighton and hove albion": "brighton",
  "brighton hove albion": "brighton",
  "west ham united": "west ham",
  "newcastle united": "newcastle",
  "leicester city": "leicester",
  "leeds united": "leeds",
  "sheff utd": "sheffield united",
  "sheff united": "sheffield united",
  "sheff wed": "sheffield wednesday",
  "qpr": "queens park rangers",
  "west brom": "west bromwich",
  "west bromwich albion": "west bromwich",
  "wba": "west bromwich",
  "norwich city": "norwich",
  "ipswich town": "ipswich",
  "coventry city": "coventry",
  "hull city": "hull",
  "stoke city": "stoke",
  "cardiff city": "cardiff",
  "swansea city": "swansea",
  "villa": "aston villa",
  "palace": "crystal palace",
  "psg": "psg",
  "paris saint germain": "psg",
  "paris sg": "psg",
  "paris st germain": "psg",
  "inter milan": "inter",
  "internazionale": "inter",
  "atletico de madrid": "atletico madrid",
  "club atletico de madrid": "atletico madrid",
  "bayern munich": "bayern",
  "bayern munchen": "bayern",
  "sporting lisbon": "sporting",
  "sporting cp": "sporting",
  "athletic bilbao": "athletic",
  "athletic club": "athletic",
  "athletic club bilbao": "athletic",
  "psv eindhoven": "psv",
  "rb salzburg": "salzburg",
  "red bull salzburg": "salzburg",
  "fc salzburg": "salzburg",
};

export function normalizeFootballTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[''`´]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(fc|afc|cfc|sc|cf|women|ladies)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeTeam(name: string): string {
  const normalised = normalizeFootballTeam(name);
  return TEAM_CANONICAL[normalised] ?? normalised;
}

export function footballTeamMatchScore(a: string, b: string): number {
  const na = canonicalizeTeam(a);
  const nb = canonicalizeTeam(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  const shorterIsWeak = WEAK_TOKENS.has(shorter);
  if (!shorterIsWeak && shorter.length >= 6 && longer.startsWith(`${shorter} `)) return 90;
  if (!shorterIsWeak && shorter.length >= 6 && longer.endsWith(` ${shorter}`)) return 85;

  const tokensA = na.split(" ").filter((t) => t.length > 2 && !WEAK_TOKENS.has(t));
  const tokensB = nb.split(" ").filter((t) => t.length > 2 && !WEAK_TOKENS.has(t));
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const overlap = tokensA.filter((t) => setB.has(t)).length;
  const minLen = Math.min(tokensA.length, tokensB.length);
  if (overlap === minLen && minLen >= 2) return 70;
  if (overlap === minLen && minLen === 1 && tokensA[0]!.length >= 6) return 60;

  return 0;
}

export function footballTeamsMatch(a: string, b: string): boolean {
  return footballTeamMatchScore(a, b) >= 60;
}

/** Betfair soccer events are usually "Home v Away" or "Home vs Away". */
export function parseFootballEventSides(
  eventName: string
): { left: string; right: string } | null {
  const parts = eventName.split(/\s+v(?:s)?\.?\s+/i);
  if (parts.length !== 2) return null;
  const left = parts[0]!.trim();
  const right = parts[1]!.trim();
  if (!left || !right) return null;
  return { left, right };
}

/**
 * Score how well a Betfair event name matches a fixture.
 * Both sides must match. Aligned home/away gets a small bonus.
 */
export function scoreFootballEvent(eventName: string, home: string, away: string): number {
  const sides = parseFootballEventSides(eventName);
  if (sides) {
    const aligned =
      footballTeamMatchScore(home, sides.left) + footballTeamMatchScore(away, sides.right);
    const swapped =
      footballTeamMatchScore(home, sides.right) + footballTeamMatchScore(away, sides.left);
    const best = Math.max(aligned, swapped);
    if (best < 120) return 0;
    return aligned >= swapped ? best + 10 : best;
  }

  const homeScore = footballTeamMatchScore(home, eventName);
  const awayScore = footballTeamMatchScore(away, eventName);
  if (homeScore >= 60 && awayScore >= 60) return homeScore + awayScore;
  return 0;
}

export function isDrawRunner(name: string): boolean {
  const n = normalizeFootballTeam(name);
  return n === "the draw" || n === "draw";
}

export function isOver25Runner(name: string): boolean {
  const n = normalizeFootballTeam(name);
  return n.startsWith("over") && n.includes("2 5");
}

export function isBttsYesRunner(name: string): boolean {
  return normalizeFootballTeam(name) === "yes";
}
