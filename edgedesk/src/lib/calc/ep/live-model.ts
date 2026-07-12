/**
 * Live in-play football probability model - Dixon-Coles remaining-goals.
 * Shared by dashboard live EV and live H/D/A displays.
 */
import {
  fitModel,
  marketsFromGrid,
  scoreGrid,
  type FitResult,
  type Markets,
} from "@/lib/calc/ep/engine";

export interface PreMatchProbs {
  tH: number;
  tD: number;
  tA: number;
  tOV?: number | null;
  tBT?: number | null;
}

export interface LiveMatchClock {
  minute: number;
  homeScore: number;
  awayScore: number;
}

export interface LiveMatchModel {
  /** Final-result probabilities from current score + remaining goals */
  markets: Markets;
  /** Pre-match fit (full-match λ) before time scaling */
  fit: FitResult;
  /** Multiplier applied to λ for remaining time */
  remainingFactor: number;
  minute: number;
  homeScore: number;
  awayScore: number;
}

/** Fraction of match still to play - floors so late games still have some intensity. */
export function remainingTimeFactor(minute: number): number {
  return Math.max(0.08, (90 - Math.min(Math.max(minute, 0), 90)) / 90);
}

/**
 * Remaining-goals grid: current score is fixed; fh/fa are additional goals.
 * Final score = (homeScore + fh, awayScore + fa).
 */
export function remainingGoalsGrid(
  fit: FitResult,
  clock: LiveMatchClock,
  maxExtra = 12
): number[][] {
  const factor = remainingTimeFactor(clock.minute);
  return scoreGrid(fit.lh * factor, fit.la * factor, fit.rho, maxExtra);
}

/**
 * Final 1X2 / O2.5 / BTTS from current score + remaining-goals Dixon-Coles.
 * BTTS / O2.5 are for the *final* scoreline (including goals already scored).
 */
export function liveMarketsFromRemaining(
  remaining: number[][],
  homeScore: number,
  awayScore: number
): Markets {
  const M = remaining.length - 1;
  let H = 0,
    D = 0,
    A = 0,
    OV = 0,
    BT = 0;
  for (let fh = 0; fh <= M; fh++) {
    for (let fa = 0; fa <= M; fa++) {
      const p = remaining[fh]?.[fa] ?? 0;
      const fhFinal = homeScore + fh;
      const faFinal = awayScore + fa;
      if (fhFinal > faFinal) H += p;
      else if (fhFinal === faFinal) D += p;
      else A += p;
      if (fhFinal + faFinal >= 3) OV += p;
      if (fhFinal >= 1 && faFinal >= 1) BT += p;
    }
  }
  return { H, D, A, OV, BT };
}

/**
 * Live match state model: fit pre-match H/D/A → scale λ by time left →
 * final-result markets from current score.
 */
export function liveMatchStateModel(
  probs: PreMatchProbs,
  clock: LiveMatchClock
): LiveMatchModel {
  const fit = fitModel(probs.tH, probs.tD, probs.tA, probs.tOV, probs.tBT);
  const factor = remainingTimeFactor(clock.minute);
  const remaining = remainingGoalsGrid(fit, clock);
  const markets = liveMarketsFromRemaining(remaining, clock.homeScore, clock.awayScore);
  return {
    markets,
    fit,
    remainingFactor: factor,
    minute: clock.minute,
    homeScore: clock.homeScore,
    awayScore: clock.awayScore,
  };
}

/** Compact display: "H 42% · D 28% · A 30%" */
export function formatLiveMarkets(markets: Markets): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return `H ${pct(markets.H)} · D ${pct(markets.D)} · A ${pct(markets.A)}`;
}

/**
 * Infer 1X2 from dutch legs or a single match-odds back.
 * Used when desk calibration wasn't stored on the bet.
 */
export function inferPreMatchProbs(input: {
  legs?: Array<{ selection: string; odds: number }> | null;
  market?: string;
  selection?: string;
  backOdds?: number;
  layOdds?: number;
  earlyPayout?: boolean;
}): PreMatchProbs | null {
  const legs = input.legs;
  if (legs?.length) {
    const bySel = (sel: string) => legs.find((l) => l.selection === sel);
    const home = bySel("home");
    const away = bySel("away");
    const draw = bySel("draw");
    if (home && away && draw && home.odds > 1 && away.odds > 1 && draw.odds > 1) {
      const tH = 1 / home.odds;
      const tA = 1 / away.odds;
      const tD = 1 / draw.odds;
      const sum = tH + tD + tA;
      return { tH: tH / sum, tD: tD / sum, tA: tA / sum };
    }
  }

  if (
    input.market === "match_odds" ||
    input.earlyPayout ||
    input.market === "two_up"
  ) {
    const sel = input.selection;
    const backOdds = input.backOdds ?? 0;
    const tBack = backOdds > 1 ? 1 / backOdds : null;
    if (!tBack || !sel) return null;
    const layOdds = input.layOdds ?? 0;
    if (sel === "home") {
      const tA = layOdds > 1 ? Math.min(0.45, 1 / layOdds) : 0.28;
      const tD = Math.max(0.12, 0.95 - tBack - tA);
      return { tH: tBack, tD, tA: Math.max(0.08, 1 - tBack - tD) };
    }
    if (sel === "away") {
      const tH = layOdds > 1 ? Math.min(0.45, 1 / layOdds) : 0.35;
      const tD = Math.max(0.12, 0.95 - tBack - tH);
      return { tA: tBack, tD, tH: Math.max(0.08, 1 - tBack - tD) };
    }
  }

  return null;
}

/**
 * Neutral prior when no odds are available - slight home bias.
 * Good enough for sim demos / score-only live rows.
 */
export const NEUTRAL_PREMATCH: PreMatchProbs = {
  tH: 0.45,
  tD: 0.27,
  tA: 0.28,
};

/** Live model for an event row; uses neutral prior if no probs supplied. */
export function liveModelForEvent(
  event: {
    sport?: string | null;
    status: string;
    minute: number;
    homeScore: number;
    awayScore: number;
  },
  probs: PreMatchProbs | null = null
): LiveMatchModel | null {
  if (event.sport !== "football") return null;
  if (event.status !== "live" && event.status !== "upcoming") return null;
  return liveMatchStateModel(probs ?? NEUTRAL_PREMATCH, {
    minute: event.status === "upcoming" ? 0 : event.minute,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
  });
}
