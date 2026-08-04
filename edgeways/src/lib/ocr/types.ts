/** Fields we try to extract from bookie / exchange screenshots. */
export interface BetOcrFields {
  selection?: string;
  backStake?: number;
  backOdds?: number;
  layStake?: number;
  layOdds?: number;
  liability?: number;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  bookmaker?: string;
  /** Exchange brand when parsed from a lay/back slip (Betdaq, Smarkets, etc.). */
  exchangeName?: string;
  /** e.g. "win" when slip shows Win Market / Win - 18:10 … */
  marketHint?: string;
  /** True when slip mentions free bet stake (e.g. Includes £50 in Free Bets). */
  isFreeBet?: boolean;
  homeTeam?: string;
  awayTeam?: string;
}

export type ScreenshotSource = "bookie" | "exchange";
