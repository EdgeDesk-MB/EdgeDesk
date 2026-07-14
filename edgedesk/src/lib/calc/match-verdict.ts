/**
 * Match checker verdict (F1) - wraps the tested matched-bet calculator in a
 * good/ok/poor judgement. It checks the match YOU found; it never lists or
 * ranks markets (see roadmap §7.3 - discovery stays out of scope).
 */

import { matchedBet, type BetMode, type MatchedResult } from "./matched";

export type MatchVerdict = "good" | "ok" | "poor";

/**
 * Rating thresholds (percent). Qualifying/risk-free rate the stake retained
 * after the qualifying loss; free bets rate the cash retention of the face
 * value. Community rules of thumb: a qualifier losing under ~3% of stake is
 * a good match; an SNR conversion retaining 75%+ is a good lay.
 */
export const MATCH_VERDICT_THRESHOLDS = {
  qualifying: { good: 97, ok: 93 },
  free: { good: 75, ok: 65 },
} as const;

export interface MatchCheckInput {
  mode: BetMode;
  backStake: number;
  backOdds: number;
  layOdds: number;
  commission: number;
}

export interface MatchCheckResult extends MatchedResult {
  /** Qualifying/risk-free: % of stake retained. Free bets: % of face retained. */
  ratingPct: number;
  verdict: MatchVerdict;
}

export function checkMatch(input: MatchCheckInput): MatchCheckResult | null {
  if (
    !(input.backStake > 0) ||
    !(input.backOdds > 1) ||
    !(input.layOdds > 1) ||
    input.commission < 0 ||
    input.commission >= 1
  ) {
    return null;
  }

  const result = matchedBet(input);
  const isFreeBet = input.mode === "free_snr" || input.mode === "free_sr";
  const ratingPct = isFreeBet
    ? (result.guaranteed / input.backStake) * 100
    : (1 + result.guaranteed / input.backStake) * 100;

  const bands = isFreeBet ? MATCH_VERDICT_THRESHOLDS.free : MATCH_VERDICT_THRESHOLDS.qualifying;
  const verdict: MatchVerdict =
    ratingPct >= bands.good ? "good" : ratingPct >= bands.ok ? "ok" : "poor";

  return { ...result, ratingPct, verdict };
}
