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
