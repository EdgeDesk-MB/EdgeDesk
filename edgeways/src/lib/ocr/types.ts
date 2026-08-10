/** Full-cover / system structure detected on a slip (Systems desk + routing). */
export type OcrBetStructure =
  | "trixie"
  | "patent"
  | "yankee"
  | "canadian"
  | "heinz"
  | "super_heinz"
  | "goliath"
  | "lucky_15"
  | "lucky_31"
  | "lucky_63"
  | "double"
  | "treble"
  | "four_fold"
  | "accumulator"
  | "bet_builder";

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
  /** Detected ticket structure (Lucky 15, Yankee, acca, …). */
  structure?: OcrBetStructure;
  /** Unit stake per line when full-cover language is present. */
  unitStake?: number;
  /** True when each-way / E/W is on the slip. */
  eachWay?: boolean;
  /** Multi-selection legs when the slip lists them. */
  legs?: Array<{ label: string; odds?: number }>;
}

export type ScreenshotSource = "bookie" | "exchange";
