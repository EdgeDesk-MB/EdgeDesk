/** Exchange API providers - aligned with Settings default exchange names. */

export type ExchangeProvider = "betfair" | "betdaq" | "matchbook" | "smarkets";

export type ExchangeOddsSource = "live" | "estimated" | "api";

export type ExchangeConnectionStatus =
  | "connected"
  | "disconnected"
  | "not_configured"
  | "unsupported";

export interface ExchangeRaceContext {
  externalId: string;
  course: string;
  raceName: string;
  startTime: number;
  offTime: string;
  region?: string;
  runners: Array<{ horseId: string; name: string }>;
}

export interface ExchangeLayQuote {
  horseId: string;
  horseName: string;
  layDecimal: number;
  laySize?: number;
  /** Best available back price, when the provider returns both sides of the book */
  backDecimal?: number;
  backSize?: number;
  /** Best available lay price on the exchange */
  source: ExchangeOddsSource;
}

export interface ExchangeRaceOdds {
  externalId: string;
  marketId?: string;
  quotes: ExchangeLayQuote[];
  source: ExchangeOddsSource;
  error?: string;
}

export interface ExchangeOddsResult {
  provider: ExchangeProvider;
  status: ExchangeConnectionStatus;
  /** Delayed vs live - Betfair delayed app key is free for dev */
  feedType?: "live" | "delayed";
  races: ExchangeRaceOdds[];
  error?: string;
}

export interface ExchangeProviderStatus {
  provider: ExchangeProvider;
  status: ExchangeConnectionStatus;
  feedType?: "live" | "delayed";
  message?: string;
}
