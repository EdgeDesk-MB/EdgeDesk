/**
 * Acca desk workflow maths (J7) - pure per-leg stakes for running an acca
 * as a guided multi-day workflow. Consumes the same conventions as
 * accumulator.ts (which owns full acca STRUCTURE maths); this module owns
 * the SEQUENTIAL execution recursion. The EP engine is not touched.
 *
 * Sequential ("cover") method: each leg is laid so that if it loses - the
 * acca dies - the exchange win exactly covers the acca stake plus every
 * liability already paid on earlier winning legs. £0 on any leg loss; the
 * all-win outcome carries whatever remains. The FINAL leg is instead
 * equalised (lock-in algebra) so the run ends with the same £ either way.
 *
 * Acca insurance reuses both shapes: leg-by-leg insurance is the same
 * cover recursion (the run stops at the first loss and the refund takes
 * over); whole-acca insurance is one standard equalising lay at the
 * combined price. Which to use is picked per run (Sam - both in v1).
 */

import { roundPence } from "./money";

/** Lay-due lead window (Sam: previous result in + kick-off within 30 min). */
export const DEFAULT_LAY_LEAD_MINUTES = 30;
/** A leg more than this far past kick-off is no longer actionable. */
export const LAY_DUE_EXPIRY_MS = 60 * 60_000;

export interface SequentialLayInput {
  accaStake: number;
  /** Σ layStake × (layOdds − 1) across earlier LAID legs that WON */
  priorLiabilities: number;
  /** Exchange commission as a fraction */
  commission: number;
}

/**
 * Zero-loss cover stake for the next leg: L(1−c) = stake + prior
 * liabilities. Lay odds don't change the cover stake - only the liability
 * this leg rolls forward if it wins.
 */
export function nextSequentialLay(input: SequentialLayInput): number | null {
  const { accaStake, priorLiabilities, commission: c } = input;
  if (!(accaStake > 0) || !(priorLiabilities >= 0) || !(c >= 0 && c < 1)) return null;
  return roundPence((accaStake + priorLiabilities) / (1 - c));
}

export interface FinalLegLockInput {
  accaStake: number;
  /** Product of every leg's bookie odds (void legs excluded) */
  combinedBackOdds: number;
  priorLiabilities: number;
  legLayOdds: number;
  commission: number;
}

export interface FinalLegLock {
  layStake: number;
  lockedIfWin: number;
  lockedIfLose: number;
}

/** Equalise the last leg: the run ends with the same £ either way. */
export function finalLegLockLay(input: FinalLegLockInput): FinalLegLock | null {
  const { accaStake, combinedBackOdds, priorLiabilities, legLayOdds, commission: c } = input;
  if (!(accaStake > 0) || !(combinedBackOdds > 1) || !(legLayOdds > 1)) return null;
  if (!(priorLiabilities >= 0) || !(c >= 0 && c < 1)) return null;

  const win0 = accaStake * (combinedBackOdds - 1) - priorLiabilities;
  const lose0 = -(accaStake + priorLiabilities);
  const layStake = roundPence((win0 - lose0) / (legLayOdds - c));
  return {
    layStake,
    lockedIfWin: win0 - layStake * (legLayOdds - 1),
    lockedIfLose: lose0 + layStake * (1 - c),
  };
}

export interface WholeAccaLayInput {
  stake: number;
  combinedOdds: number;
  layOdds: number;
  commission: number;
}

export interface WholeAccaLay {
  layStake: number;
  profitIfAllWin: number;
  profitIfAnyLose: number;
}

/**
 * Insurance laid once: a standard equalising lay of the whole acca at the
 * combined exchange price (same algebra as a matched qualifying lay).
 */
export function wholeAccaLay(input: WholeAccaLayInput): WholeAccaLay | null {
  const { stake, combinedOdds, layOdds, commission: c } = input;
  if (!(stake > 0) || !(combinedOdds > 1) || !(layOdds > 1) || !(c >= 0 && c < 1)) return null;
  const layStake = roundPence((stake * combinedOdds) / (layOdds - c));
  return {
    layStake,
    profitIfAllWin: stake * (combinedOdds - 1) - layStake * (layOdds - 1),
    profitIfAnyLose: -stake + layStake * (1 - c),
  };
}

export interface LegLiabilityLike {
  result: "pending" | "won" | "lost" | "void";
  layStake: number | null;
  layOdds: number | null;
}

/**
 * Rolling ledger: liabilities are PAID only when a laid leg wins. Void
 * legs return the lay; pending legs haven't settled; unlaid legs cost
 * nothing.
 */
export function priorLayLiabilities(legs: LegLiabilityLike[]): number {
  return legs
    .filter((l) => l.result === "won" && l.layStake != null && (l.layOdds ?? 0) > 1)
    .reduce((a, l) => a + (l.layStake ?? 0) * ((l.layOdds ?? 1) - 1), 0);
}

export interface AccaProfitLeg extends LegLiabilityLike {
  backOdds: number;
}

export interface AccaProfitRun {
  stake: number;
  commission: number;
  /** insurance_whole only - the single combined lay across every leg */
  wholeLayStake?: number | null;
  wholeLayOdds?: number | null;
  /** Bookmaker acca boost %, winnings-only convention - see applyAccaBoost */
  boostPct?: number | null;
  /**
   * Linked acca back bet type. Free bets lose at £0 on the bookie side
   * (mirrors backLostProfit in acca-desk.ts); cash qualify loses the stake.
   */
  backBetType?: string | null;
}

/**
 * Realised campaign P&L to date - mirrors the exact settlement branches in
 * acca-desk.ts (setLegResult/completeRun) so the desk can show a live
 * figure without waiting for the run to finish:
 *  - each laid leg settles the moment IT does (won leg -> lay lost, a
 *    liability paid; lost leg -> lay won, stake kept minus commission);
 *  - the acca back bet (and insurance_whole's combined lay) settle the
 *    moment ANY leg is lost - nothing further is ever laid;
 *  - otherwise, once every leg has resolved without a loss, the back bet
 *    wins at the combined odds (or voids if every leg voided).
 * A run with no loss and a pending leg still open therefore contributes
 * £0 for the still-open back bet - this is a REALISED figure, not a
 * probability-weighted projection.
 */
export function accaCampaignProfit(run: AccaProfitRun, legs: AccaProfitLeg[]): number {
  // Each contribution is rounded to the penny as it's added - matching
  // settleLinkedBet's per-bet roundPence in acca-desk.ts exactly, so this
  // never drifts a penny from the real bets ledger it mirrors.
  let total = 0;
  for (const leg of legs) {
    if (leg.layStake == null || leg.layOdds == null) continue;
    if (leg.result === "won") total -= roundPence(leg.layStake * (leg.layOdds - 1));
    else if (leg.result === "lost") total += roundPence(leg.layStake * (1 - run.commission));
  }

  const anyLost = legs.some((l) => l.result === "lost");
  const allResolved = legs.length > 0 && legs.every((l) => l.result !== "pending");

  if (anyLost) {
    // Free bets (SNR or SR): the stake was never cash at risk - mirrors
    // backLostProfit in acca-desk.ts, which exempts both free types.
    if (run.backBetType !== "free_snr" && run.backBetType !== "free_sr") {
      total -= run.stake;
    }
    if (run.wholeLayStake != null && run.wholeLayOdds != null) {
      total += roundPence(run.wholeLayStake * (1 - run.commission));
    }
  } else if (allResolved) {
    const settled = legs.filter((l) => l.result !== "void");
    if (settled.length > 0) {
      const rawCombined = settled.reduce((a, l) => a * l.backOdds, 1);
      const combined = applyAccaBoost(rawCombined, run.boostPct);
      total += roundPence(run.stake * (combined - 1));
      if (run.wholeLayStake != null && run.wholeLayOdds != null) {
        total -= roundPence(run.wholeLayStake * (run.wholeLayOdds - 1));
      }
    }
    // every leg void: back bet (and whole lay) void too - contributes £0
  }

  return roundPence(total);
}

export interface AccaOutcomeLeg {
  backOdds: number;
  result: "pending" | "won" | "lost" | "void";
}

export interface AccaOutcomePercentages {
  /** Every leg wins (0-100) */
  allWinPct: number;
  /** Exactly one leg loses, every other wins (0-100) */
  oneLosePct: number;
  /** At least one leg loses - always 100 − allWinPct (0-100) */
  atLeastOneLosePct: number;
}

export type AccaOutcomePercentageMode = "live" | "at_start";

export interface AccaOutcomePercentageOptions {
  /**
   * `live` (default): settled legs are certain (won→1, lost→0) so the
   * breakdown sharpens as the run plays out; use on active cards.
   * `at_start`: ignore results and use naive 1/backOdds for every non-void
   * leg; the going-in estimate for History / completed reflection.
   */
  mode?: AccaOutcomePercentageMode;
}

/**
 * ALL WIN / 1 LOSE / 1+ LOSE breakdown for the run card. Each leg's implied
 * probability is the NAIVE 1/backOdds (no market-wide prices exist for an
 * ad-hoc acca leg, so there's no no-vig fair price to fall back on),
 * callers MUST render this behind a heuristic basis badge, never as a
 * measured probability. Void legs are excluded entirely, same convention
 * as combinedBackOdds in acca-desk.ts.
 *
 * Mode:
 *  - live: won forces p=1, lost forces p=0 (active desk).
 *  - at_start: every non-void leg uses 1/backOdds regardless of result
 *    (completed History, reflect against the anticipated breakdown).
 */
export function accaOutcomePercentages(
  legs: AccaOutcomeLeg[],
  options?: AccaOutcomePercentageOptions
): AccaOutcomePercentages {
  const mode = options?.mode ?? "live";
  const probs = legs
    .filter((l) => l.result !== "void")
    .map((l) => {
      if (mode === "live") {
        if (l.result === "won") return 1;
        if (l.result === "lost") return 0;
      }
      return l.backOdds > 1 ? 1 / l.backOdds : 0;
    });

  if (probs.length === 0) return { allWinPct: 0, oneLosePct: 0, atLeastOneLosePct: 0 };

  const allWin = probs.reduce((a, p) => a * p, 1);
  const oneLose = probs.reduce((sum, p_i, i) => {
    const others = probs.reduce((a, p, j) => (j === i ? a : a * p), 1);
    return sum + (1 - p_i) * others;
  }, 0);

  return {
    allWinPct: allWin * 100,
    oneLosePct: oneLose * 100,
    atLeastOneLosePct: (1 - allWin) * 100,
  };
}

/**
 * Apply a bookmaker acca boost to the raw combined (product-of-legs) odds.
 * WINNINGS-ONLY convention (Sam's call, 2026-07-22 - matches how boosts are
 * usually marketed, "your winnings boosted by X%"): only the profit portion
 * of the price is boosted, the stake-return £1 is not -
 *   boosted = 1 + (rawCombinedOdds − 1) × (1 + boostPct / 100)
 * A missing/zero/negative boostPct is the identity - returns rawCombinedOdds
 * unchanged, so an unboosted run's numbers never move.
 */
export function applyAccaBoost(rawCombinedOdds: number, boostPct: number | null | undefined): number {
  if (!(rawCombinedOdds > 1) || boostPct == null || !(boostPct > 0)) return rawCombinedOdds;
  return 1 + (rawCombinedOdds - 1) * (1 + boostPct / 100);
}

export type AccaFundingMethod = "sequential" | "insurance_legs";

export interface AccaLadderLeg extends AccaProfitLeg {
  seq: number;
  label: string;
}

export interface LiabilityLadderStep {
  seq: number;
  label: string;
  kind: "cover" | "lock" | "placed";
  layStake: number;
  layOdds: number;
  liability: number;
  /** True when this lay is already logged (wallet already reserved). */
  reserved: boolean;
  /** True when lay odds were filled from the bookie back price. */
  oddsProxy: boolean;
}

/**
 * All-win path of exchange reservations still to come. Won laid legs seed
 * prior liabilities; each pending non-void leg is sized with the same
 * cover / final-lock rules as the desk. A busted run returns [].
 */
export function sequentialLiabilityLadder(input: {
  stake: number;
  commission: number;
  boostPct?: number | null;
  method: AccaFundingMethod;
  legs: AccaLadderLeg[];
}): LiabilityLadderStep[] {
  const { stake, commission: c, boostPct, method, legs } = input;
  if (!(stake > 0) || !(c >= 0 && c < 1)) return [];
  if (legs.some((l) => l.result === "lost")) return [];

  const live = [...legs].sort((a, b) => a.seq - b.seq);
  const nonVoid = live.filter((l) => l.result !== "void");
  const combined = applyAccaBoost(
    nonVoid.reduce((a, l) => a * l.backOdds, 1),
    boostPct
  );
  let prior = priorLayLiabilities(live);
  const pending = nonVoid.filter((l) => l.result === "pending");
  const steps: LiabilityLadderStep[] = [];

  for (let i = 0; i < pending.length; i++) {
    const leg = pending[i]!;
    const isFinal = i === pending.length - 1;
    const reserved =
      leg.layStake != null &&
      leg.layStake > 0 &&
      leg.layOdds != null &&
      leg.layOdds > 1;

    if (reserved) {
      const layStake = leg.layStake!;
      const layOdds = leg.layOdds!;
      const liability = roundPence(layStake * (layOdds - 1));
      steps.push({
        seq: leg.seq,
        label: leg.label,
        kind: "placed",
        layStake,
        layOdds,
        liability,
        reserved: true,
        oddsProxy: false,
      });
      prior = roundPence(prior + liability);
      continue;
    }

    const oddsProxy = !(leg.layOdds != null && leg.layOdds > 1);
    const layOdds = oddsProxy ? leg.backOdds : leg.layOdds!;
    if (!(layOdds > 1)) continue;

    const useLock = method === "sequential" && isFinal;
    let layStake: number | null = null;
    let kind: "cover" | "lock" = "cover";
    if (useLock) {
      const lock = finalLegLockLay({
        accaStake: stake,
        combinedBackOdds: combined,
        priorLiabilities: prior,
        legLayOdds: layOdds,
        commission: c,
      });
      if (!lock) continue;
      layStake = lock.layStake;
      kind = "lock";
    } else {
      layStake = nextSequentialLay({
        accaStake: stake,
        priorLiabilities: prior,
        commission: c,
      });
      if (layStake == null) continue;
    }

    const liability = roundPence(layStake * (layOdds - 1));
    steps.push({
      seq: leg.seq,
      label: leg.label,
      kind,
      layStake,
      layOdds,
      liability,
      reserved: false,
      oddsProxy,
    });
    prior = roundPence(prior + liability);
  }

  return steps;
}

const OUTCOME_EQUAL_EPS = 0.02;

export type AccaMethodKind =
  | "sequential"
  | "insurance_legs"
  | "insurance_whole"
  | "combined";

export interface AccaSquareLeg extends AccaProfitLeg {
  seq: number;
}

export interface AccaSquareProvisional {
  /** Campaign P&L floor for the two known outcomes on the square leg. */
  value: number;
  /** Equalised final / whole lay → locked; cover lose-path floor → worst. */
  kind: "locked" | "worst";
  squareLegSeq: number | null;
}

/**
 * When the next actionable leg is already laid ("square"), both outcomes of
 * that leg are known for campaign P&L:
 *  - leg loses → run ends (cover ≈ £0 on sequential; insurance refund is
 *    separate); whole-lay methods settle the combined hedge;
 *  - leg wins → on the final pending leg the run also ends (all-win path);
 *    otherwise the campaign continues and only the lose-path floor is a
 *    known terminal outcome.
 * Returns null when not square (next leg still unlaid) or the run already
 * has a loss — callers should leave provisional empty in those states.
 */
export function accaSquareProvisional(
  run: AccaProfitRun & { method: AccaMethodKind },
  legs: AccaSquareLeg[]
): AccaSquareProvisional | null {
  if (legs.some((l) => l.result === "lost")) return null;

  if (run.method === "insurance_whole" || run.method === "combined") {
    if (run.wholeLayStake == null || run.wholeLayOdds == null) return null;
    if (!(run.wholeLayStake > 0) || !(run.wholeLayOdds > 1)) return null;
    if (!legs.some((l) => l.result === "pending")) return null;

    const ifAnyLose = accaCampaignProfit(
      run,
      legs.map((l) =>
        l.result === "pending" ? { ...l, result: "lost" as const } : l
      )
    );
    const ifAllWin = accaCampaignProfit(
      run,
      legs.map((l) =>
        l.result === "pending" ? { ...l, result: "won" as const } : l
      )
    );
    const spread = Math.abs(ifAllWin - ifAnyLose);
    return {
      value: roundPence(Math.min(ifAllWin, ifAnyLose)),
      kind: spread <= OUTCOME_EQUAL_EPS ? "locked" : "worst",
      squareLegSeq: null,
    };
  }

  // sequential / insurance_legs — square on the next pending laid leg
  const square = [...legs]
    .sort((a, b) => a.seq - b.seq)
    .find((l) => {
      if (l.result !== "pending") return false;
      if (l.layStake == null || l.layOdds == null || !(l.layOdds > 1) || !(l.layStake > 0)) {
        return false;
      }
      return !legs.some((earlier) => earlier.seq < l.seq && earlier.result === "pending");
    });
  if (!square) return null;

  const pendingOthers = legs.filter(
    (l) => l.result === "pending" && l.seq !== square.seq
  );
  const isFinalPending = pendingOthers.length === 0;

  const ifLose = accaCampaignProfit(
    run,
    legs.map((l) => (l.seq === square.seq ? { ...l, result: "lost" as const } : l))
  );

  if (!isFinalPending) {
    // Only the bust path is a known terminal campaign figure; cover sizes
    // that to ≈ £0 (cash) / free-stake extraction (free_snr).
    return { value: ifLose, kind: "worst", squareLegSeq: square.seq };
  }

  const ifWin = accaCampaignProfit(
    run,
    legs.map((l) => (l.seq === square.seq ? { ...l, result: "won" as const } : l))
  );
  const spread = Math.abs(ifWin - ifLose);
  return {
    value: roundPence(Math.min(ifWin, ifLose)),
    kind: spread <= OUTCOME_EQUAL_EPS ? "locked" : "worst",
    squareLegSeq: square.seq,
  };
}
