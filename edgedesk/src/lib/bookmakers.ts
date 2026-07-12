/**
 * UK-licensed bookmakers commonly used for matched betting, sorted A–Z.
 * Sourced from public UK betting-site directories (OLBG, Telegraph, UKGC listings).
 * Users can still type a custom name via the search field.
 */
export const UK_BOOKMAKERS = [
  "10Bet",
  "888sport",
  "AK Bets",
  "Bet365",
  "Bet600",
  "Betano",
  "BetBoro",
  "Betdaq Sportsbook",
  "Betfair Sportsbook",
  "Betfred",
  "BetGoodwin",
  "BetMGM",
  "BetRegal",
  "BetUK",
  "BetVictor",
  "Betway",
  "BresBet",
  "BoyleSports",
  "CopyBet",
  "Coral",
  "DAZN Bet",
  "FanTeam",
  "Grosvenor Sport",
  "Hollywoodbets",
  "JeffBet",
  "Kwiff",
  "Ladbrokes",
  "LeoVegas",
  "LiveScore Bet",
  "Lottoland Sports",
  "Marathon Bet",
  "Matchbook",
  "Midnite",
  "Mr Play",
  "NetBet",
  "Novibet",
  "Paddy Power",
  "Parimatch",
  "Planet Sport Bet",
  "PricedUp",
  "QuinnBet",
  "Sky Bet",
  "Sporting Index",
  "Spreadex",
  "Star Sports",
  "talkSPORT BET",
  "The Pools",
  "Tote",
  "Unibet",
  "VBet",
  "Virgin Bet",
  "William Hill",
  "YeeeHaaa",
  "ZetBet",
] as const;

export type UkBookmaker = (typeof UK_BOOKMAKERS)[number];

export function filterBookmakers(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...UK_BOOKMAKERS];
  return UK_BOOKMAKERS.filter((b) => b.toLowerCase().includes(q));
}

/**
 * Find the best UK bookmaker name mentioned in free text (headers, MBB paste).
 * Prefers longer names so "Betfair Sportsbook" wins over "Betfair".
 */
export function matchBookmakerFromText(text: string): string | null {
  const lower = text.toLowerCase();
  let best: string | null = null;
  for (const name of UK_BOOKMAKERS) {
    const n = name.toLowerCase();
    if (!lower.includes(n)) continue;
    if (!best || name.length > best.length) best = name;
  }
  // Common aliases
  if (!best) {
    if (/\bbetfair\b/i.test(text)) return "Betfair Sportsbook";
    if (/\bsky\s*bet\b/i.test(text)) return "Sky Bet";
    if (/\bpaddy\b/i.test(text)) return "Paddy Power";
    if (/\bwilliam\s*hill\b|\bwh\b/i.test(text)) return "William Hill";
  }
  return best;
}

