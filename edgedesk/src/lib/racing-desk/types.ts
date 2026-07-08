/** Rich racecard + desk-specific enrichments for the Racing Desk page. */

import type { OddsSource } from "@/lib/racing/odds";
import type { ExchangeOddsSource, ExchangeProvider } from "@/lib/services/exchange/types";

export interface PriceMovement {
  /** First recorded decimal price in our snapshot window */
  open: number | null;
  /** Latest decimal price */
  current: number | null;
  /** current - open (negative = shortening / steamer) */
  change: number | null;
  /** Percent change from open */
  changePct: number | null;
  /** Recent snapshot prices for sparkline (oldest → newest) */
  history: number[];
  snapshotCount: number;
}

export interface RacingRunnerDetail {
  horseId: string;
  name: string;
  number: string;
  /** Stall / barrier draw (flat) */
  draw?: string;
  jockey: string;
  /** Jockey allowance lbs e.g. 5 from "Name(5)" */
  jockeyClaim?: number;
  trainer: string;
  age?: string;
  weight?: string;
  weightLbs?: number;
  /** Horse coat colour code (b, ch, gr, etc.) */
  horseColour?: string;
  /** Blinkers, visor, etc. */
  headgear?: string;
  /** Jockey silk image URL when API provides it (Standard+ / results) */
  silkUrl?: string;
  ofr?: string;
  form?: string;
  spDecimal?: number;
  spFraction?: string;
  /** Raw bookmaker quotes from Racing API standard tier (stripped after resolve). */
  oddsList?: unknown[];
  /** Resolved bookie win price for display / scoring */
  bookieDecimal?: number;
  /** Exchange lay/back proxy (live feed or estimated spread) */
  exchangeDecimal?: number;
  /** How exchange price was sourced */
  exchangeSource?: ExchangeOddsSource;
  /** Exchange vs bookie gap % — lower = tighter match */
  spreadPct?: number;
  oddsSource?: OddsSource;
  /** Runner-level place-refund target score (0–100) */
  offerTargetScore?: number;
  /** Why this runner is a place-refund target */
  offerTargetSummary?: string;
  nonRunner: boolean;
  movement?: PriceMovement;
}

export interface RacingDeskRace {
  externalId: string;
  course: string;
  raceName: string;
  startTime: number;
  offTime: string;
  status: "upcoming" | "live" | "finished";
  fieldSize: number;
  distance?: string;
  going?: string;
  raceClass?: string;
  type?: string;
  prize?: string;
  region?: string;
  winner?: string;
  runners: RacingRunnerDetail[];
  /** Linked tracked event id, if any */
  trackedEventId?: number;
  /** Open bets on this race */
  openBetCount: number;
  /** Standard UK place terms from field size */
  standardPlaces: number;
  /** Active racing offer evaluation for this race */
  offerTags: RaceOfferTag[];
  /** How prices were sourced for this race */
  oddsSource?: OddsSource;
  pricedRunnerCount?: number;
}

export interface SuggestedRunner {
  horseId: string;
  name: string;
  marketRank: number;
  score: number;
  summary: string;
  bookieDecimal?: number;
  exchangeDecimal?: number;
  oddsSource?: OddsSource;
  exchangeSource?: ExchangeOddsSource;
  /** Expected qualifying loss (negative £) */
  qualLoss?: number;
  /** Expected value from free bet trigger */
  freeBetEv?: number;
  /** qualLoss + freeBetEv */
  totalEv?: number;
  confidence?: "live" | "mixed" | "estimate";
  offerId?: number;
}

export interface RaceOfferTag {
  offerId: number;
  offerTitle: string;
  qualifies: boolean;
  score?: number;
  summary?: string;
  reasons?: string[];
  betStake?: number;
  freeBetAmount?: number;
  bookmaker?: string | null;
  triggerText?: string;
  suggestedRunners?: SuggestedRunner[];
}

export interface RacingDeskActiveOffer {
  id: number;
  title: string;
  bookmaker: string | null;
  scopeCourse: string | null;
  eventDate: string | null;
  rulesSummary: string;
}

export interface SuggestedRace {
  externalId: string;
  course: string;
  raceName: string;
  offTime: string;
  offerId: number;
  offerTitle: string;
  score: number;
  summary: string;
  oddsSource?: OddsSource;
  suggestedRunners?: SuggestedRunner[];
  /** Best runner by total EV */
  topTarget?: SuggestedRunner;
  confidence?: "live" | "mixed" | "estimate";
  topEv?: number;
}

export interface RacingDeskSummary {
  raceCount: number;
  upcomingCount: number;
  liveCount: number;
  trackedCount: number;
  openPositions: number;
  racingPnlToday: number;
  source: "demo" | "racing-api" | "error";
  oddsSnapshotsEnabled: boolean;
  premiumOddsApi: boolean;
  /** free = no API odds; standard = live bookie odds; demo = sample data */
  oddsTier: "free" | "standard" | "demo" | "proxy";
  oddsNote?: string;
  /** Default exchange from Settings */
  exchangeProvider?: ExchangeProvider;
  exchangeName?: string;
  exchangeStatus?: "connected" | "disconnected" | "not_configured" | "unsupported";
  exchangeFeedType?: "live" | "delayed";
  exchangeNote?: string;
}

export interface RacingDeskPayload {
  date: string;
  summary: RacingDeskSummary;
  races: RacingDeskRace[];
  activeOffers: RacingDeskActiveOffer[];
  suggestedRaces: SuggestedRace[];
  error?: string;
}
