/** Rich racecard + desk-specific enrichments for the Racing Desk page. */

import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
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
  /** Sex / sex_code from Racing API (C, F, G, …) */
  sex?: string;
  /** Blinkers, visor, etc. */
  headgear?: string;
  /** Jockey silk image URL when API provides it (Standard+ / results) */
  silkUrl?: string;
  /** Official rating */
  ofr?: string;
  /** Days since last run (Racing API `last_run`) */
  lastRunDays?: number;
  form?: string;
  spDecimal?: number;
  spFraction?: string;
  /** SP favourite (Fav / JFav) from result or racecard. */
  isSpFavourite?: boolean;
  /** Raw bookmaker quotes from Racing API standard tier (stripped after resolve). */
  oddsList?: unknown[];
  /** Resolved bookie win price for display / scoring */
  bookieDecimal?: number;
  /** Exchange lay/back proxy (live feed or estimated spread) */
  exchangeDecimal?: number;
  /** Available £ at best lay (live exchange only) */
  exchangeLaySize?: number;
  /** Best exchange BACK price, when the feed returns both sides (live exchange only) */
  exchangeBackDecimal?: number;
  /** Available £ at best back (live exchange only) */
  exchangeBackSize?: number;
  /** How exchange price was sourced */
  exchangeSource?: ExchangeOddsSource;
  /** Exchange vs bookie gap % - lower = tighter match */
  spreadPct?: number;
  /** How bookie price was sourced */
  oddsSource?: OddsSource;
  /** True when user pasted a manual bookie/exchange override */
  oddsOverridden?: boolean;
  /** Runner-level place-refund target score (0–100) */
  offerTargetScore?: number;
  /** Why this runner is a place-refund target */
  offerTargetSummary?: string;
  nonRunner: boolean;
  /** Bookie/back price movement */
  movement?: PriceMovement;
  /** Live exchange lay movement (separate from bookie) */
  exchangeMovement?: PriceMovement;
  /** Finishing position when a result is known (1 = winner; 0 = unplaced). */
  finishingPosition?: number;
  /** Distance beaten vs previous (result view). */
  btn?: string;
  /** Overall distance beaten vs winner (result view). */
  ovrBtn?: string;
  /**
   * Linked tracker bets on this runner (matched by selection name).
   * Open takes priority over settled when both exist.
   */
  betMark?: {
    kind: "open" | "settled";
    betCount: number;
  };
}

export interface RacingDeskRace {
  externalId: string;
  course: string;
  raceName: string;
  startTime: number;
  offTime: string;
  status: "upcoming" | "live" | "finished";
  /** Provider race_status when present (OFF, DELAYED, …). */
  raceStatus?: string;
  /** True when the provider marks the race abandoned. */
  abandoned?: boolean;
  fieldSize: number;
  distance?: string;
  going?: string;
  raceClass?: string;
  /** Group / Listed pattern when present */
  pattern?: string;
  /** Handicap rating band e.g. "0-85" */
  ratingBand?: string;
  /** Age band e.g. "3yo+" */
  ageBand?: string;
  /** Turf / AW / Dirt */
  surface?: string;
  /** Fillies / Mares / Colts & Geldings, etc. */
  sexRestriction?: string;
  type?: string;
  prize?: string;
  region?: string;
  winner?: string;
  /** True when result has winner but fewer than two placings (fast result). */
  resultIncomplete?: boolean;
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
  /** Live / estimated / api for exchange lays on this race */
  exchangeSource?: ExchangeOddsSource;
  /** Why Betfair matching failed for this race (when estimated) */
  exchangeMatchError?: string;
  /** Count of runners with live exchange lays */
  liveLayCount?: number;
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
  /** Place finishes that award the free bet (e.g. 2, 3, 4) */
  qualifyingPlaces?: number[];
  /** Place hatch / award only when the winner was the SP favourite. */
  winnerMustBeSpFavourite?: boolean;
  /** Optional floor on the favourite's Starting Price (decimal). */
  minFavouriteSpOdds?: number | null;
  suggestedRunners?: SuggestedRunner[];
  /** Minimum runners required by the offer rules (qualifying tags only) */
  minRunners?: number | null;
}

export interface RacingDeskActiveOffer {
  id: number;
  title: string;
  bookmaker: string | null;
  scopeCourse: string | null;
  scopeRaceLabel: string | null;
  eventDate: string | null;
  rulesSummary: string;
}

export interface SuggestedRace {
  externalId: string;
  course: string;
  raceName: string;
  startTime: number;
  offTime: string;
  /** The Racing API region (GB / IRE) */
  region?: string;
  offerId: number;
  offerTitle: string;
  bookmaker: string | null;
  score: number;
  summary: string;
  oddsSource?: OddsSource;
  exchangeSource?: ExchangeOddsSource;
  suggestedRunners?: SuggestedRunner[];
  /** Best runner by total EV */
  topTarget?: SuggestedRunner;
  confidence?: "live" | "mixed" | "estimate";
  topEv?: number;
  /** Offer Edge play backing this suggestion, when the field could be modelled */
  edge?: OfferEdgePlay;
}

export interface RacingDeskSummary {
  raceCount: number;
  upcomingCount: number;
  trackedCount: number;
  openPositions: number;
  racingPnlToday: number;
  source: "demo" | "racing-api" | "error";
  oddsSnapshotsEnabled: boolean;
  premiumOddsApi: boolean;
  /** free = no API odds; standard = live bookie odds; demo = sample data */
  oddsTier: "free" | "standard" | "demo" | "proxy";
  oddsNote?: string;
  /** basic = auto results; free = racecards only; none = no key */
  resultsTier: "basic" | "free" | "none";
  /** Default exchange from Settings */
  exchangeProvider?: ExchangeProvider;
  exchangeName?: string;
  /** Settings default (app-wide) - Desk may override for this page only */
  settingsExchangeProvider?: ExchangeProvider;
  settingsExchangeName?: string;
  /** Desk page override when set */
  deskExchangeOverride?: ExchangeProvider | null;
  exchangeStatus?: "connected" | "disconnected" | "not_configured" | "unsupported";
  exchangeFeedType?: "live" | "delayed";
  exchangeNote?: string;
  /** Calculator-style cell colours from active Desk exchange */
  backColor?: string;
  layColor?: string;
}

export type RacingDeskActiveBetKind = "bet" | "acca" | "bet_builder" | "systems";

/** Open horse-racing bets linked to today's desk (Active bets strip). */
export interface RacingDeskActiveBet {
  betId: number;
  eventId: number;
  raceExternalId: string | null;
  /** Desk campaign row. Default is a normal tracker bet. */
  kind?: RacingDeskActiveBetKind;
  /** Active-bets CTA. Default `/tracker?highlight=`. */
  href?: string;
  label: string;
  selection: string;
  market: string;
  bookmaker: string | null;
  backStake: number;
  backOdds: number;
  expectedProfit: number | null;
  /**
   * How to label `expectedProfit`:
   * - locked — both matched outcomes equal (no Est. language)
   * - worst — show the worse of the two sides
   * - estimate — naked / incomplete lay
   */
  outcomeKind: "locked" | "worst" | "estimate";
  course: string | null;
  offTime: string | null;
  startTime: number | null;
  /** From ew meta when present */
  bookiePlaces?: number;
  exchangePlaces?: number;
  mode?: "each_way" | "extra_place";
  qualifyingLoss?: number | null;
  impliedExtraPlaceOdds?: number | null;
  profitIfExtraPlace?: number | null;
  /** Desk next action, e.g. "Lay 2nd leg". */
  triggerNote?: string | null;
  /** Desk progress, e.g. "1/2 laid". */
  progressCaption?: string | null;
}

/** Day P&L series + by-race table for Racing Desk “Racing P&L today”. */
export interface RacingDeskPnlDay {
  total: number;
  openCount: number;
  settledCount: number;
  rows: Array<{
    rowId?: string;
    kind?: "race" | "campaign";
    campaignKind?: "acca" | "bet_builder" | "systems";
    campaignId?: number;
    /** Distinct horse-racing events on a multi-race ticket */
    spanCount?: number;
    eventId: number;
    raceExternalId: string | null;
    startTime: number;
    course: string;
    raceName: string;
    offTime: string | null;
    /** Racing API region (GB / IRE) when known */
    region?: string | null;
    profit: number;
    betCount: number;
    openCount: number;
    settledCount: number;
  }>;
  cumulative: Array<{ t: number; value: number }>;
  /** Home-chart prior-plateau markers for each racing bet tip */
  markers: Array<{
    id: number;
    kind?: "bet" | "adjustment" | "casino";
    label: string;
    status: string;
    settledAtSec: number;
    betProfit: number;
    cumulativeValue: number;
    tone: "win" | "loss" | "neutral";
  }>;
}

export interface RacingDeskPayload {
  date: string;
  summary: RacingDeskSummary;
  races: RacingDeskRace[];
  activeOffers: RacingDeskActiveOffer[];
  /** Open positions with race linkage for the Active bets strip */
  activeBets: RacingDeskActiveBet[];
  /** Race-day P&L chart + breakdown for the selected desk date */
  racingPnlDay: RacingDeskPnlDay;
  suggestedRaces: SuggestedRace[];
  /** Offer Edge plays across every active offer, best expected value first */
  edgePlays: OfferEdgePlay[];
  error?: string;
}
