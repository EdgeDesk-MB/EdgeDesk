/**
 * Casino reward-type EV maths (K1) - the multi-component counterpart to
 * `casinoOfferEv` (which remains, unchanged, the Bonus/Cash component calc).
 * A casino offer is a CAMPAIGN that can carry any combination of these
 * components; `sumCampaignEv` folds their locked EVs into a campaign total,
 * mirroring how a sports offer sums qualifying-leg and free-bet-leg profit.
 */

import { roundPence } from "@/lib/calc/money";
import { DEFAULT_RTP, casinoOfferEv, houseEdgeFromRtp } from "@/lib/calc/casino-ev";

/** European (single-zero) roulette's published house edge. */
export const EUROPEAN_ROULETTE_EDGE = 0.027;
/** American (double-zero) roulette's published house edge. */
export const AMERICAN_ROULETTE_EDGE = 0.0526;

export interface FreeSpinsEvInput {
  /** Number of spins awarded */
  spins: number;
  /** £ value staked per spin */
  spinValue: number;
  /** 1 − RTP, applies to both the spins themselves and any winnings wagering */
  houseEdge: number;
  /** Playthrough required on the spin winnings before cashout; 0/undefined = none */
  winningsWagerX?: number;
  /** Game weighting towards the winnings-wagering requirement, (0, 1]; defaults to 1 */
  contributionPct?: number;
}

export interface FreeSpinsEvResult {
  /** Expected £ won from the spins themselves, before any winnings wagering */
  spinWinnings: number;
  /** £ that must be cycled to clear the winnings-wagering requirement (0 if none) */
  totalTurnover: number;
  /** Expected £ lost to the house edge across that turnover (0 if none) */
  wageringDrag: number;
  /** Expected £ retained after any winnings wagering is cleared */
  ev: number;
}

function clampContribution(pct: number | undefined): number {
  if (pct == null || !Number.isFinite(pct)) return 1;
  return Math.min(1, Math.max(0.01, pct));
}

function clampEdge(edge: number): number {
  return Math.min(1, Math.max(0, edge));
}

export function freeSpinsEv(input: FreeSpinsEvInput): FreeSpinsEvResult {
  const spins = input.spins;
  const spinValue = input.spinValue;
  if (!Number.isFinite(spins) || spins <= 0 || !Number.isFinite(spinValue) || spinValue <= 0) {
    return { spinWinnings: 0, totalTurnover: 0, wageringDrag: 0, ev: 0 };
  }
  const edge = clampEdge(input.houseEdge);
  const spinWinnings = roundPence(spins * spinValue * (1 - edge));

  const winningsWagerX = input.winningsWagerX;
  if (!winningsWagerX || !Number.isFinite(winningsWagerX) || winningsWagerX <= 0) {
    return { spinWinnings, totalTurnover: 0, wageringDrag: 0, ev: spinWinnings };
  }

  const contribution = clampContribution(input.contributionPct);
  const totalTurnover = roundPence((spinWinnings * winningsWagerX) / contribution);
  const wageringDrag = roundPence(totalTurnover * edge);
  return {
    spinWinnings,
    totalTurnover,
    wageringDrag,
    ev: roundPence(spinWinnings - wageringDrag),
  };
}

export interface GoldenChipsEvInput {
  /** Number of chips awarded */
  chipCount: number;
  /** £ value per chip */
  chipValue: number;
  /** 1 − RTP, the roulette variant's house edge */
  houseEdge: number;
}

export interface GoldenChipsEvResult {
  /** £ staked - chips are single-shot, never cycled like slot wagering */
  totalTurnover: number;
  /** Expected £ lost to the house edge on that single stake */
  wageringDrag: number;
  /** Expected £ retained */
  ev: number;
}

export function goldenChipsEv(input: GoldenChipsEvInput): GoldenChipsEvResult {
  const chipCount = input.chipCount;
  const chipValue = input.chipValue;
  if (
    !Number.isFinite(chipCount) ||
    chipCount <= 0 ||
    !Number.isFinite(chipValue) ||
    chipValue <= 0
  ) {
    return { totalTurnover: 0, wageringDrag: 0, ev: 0 };
  }
  const edge = clampEdge(input.houseEdge);
  const totalTurnover = roundPence(chipCount * chipValue);
  const wageringDrag = roundPence(totalTurnover * edge);
  return { totalTurnover, wageringDrag, ev: roundPence(totalTurnover - wageringDrag) };
}

export interface QualifyingWagerInput {
  /** £ staked to unlock the campaign's reward component(s) */
  amount: number;
  /** 1 − RTP for the qualifying stake's game */
  houseEdge: number;
}

export interface QualifyingWagerResult {
  /** £ staked - qualifying wagers are single-shot, not cycled */
  totalTurnover: number;
  /** Expected £ lost to the house edge on that stake */
  wageringDrag: number;
  /** Always ≤ 0 - a qualifying wager is a cost, never a reward */
  ev: number;
}

export function qualifyingWagerDrag(input: QualifyingWagerInput): QualifyingWagerResult {
  const amount = input.amount;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { totalTurnover: 0, wageringDrag: 0, ev: 0 };
  }
  const edge = clampEdge(input.houseEdge);
  const totalTurnover = roundPence(amount);
  const wageringDrag = roundPence(totalTurnover * edge);
  return { totalTurnover, wageringDrag, ev: roundPence(0 - wageringDrag) };
}

export interface CashbackEvInput {
  /** £ turnover the cashback % applies to over the qualifying period */
  expectedTurnover: number;
  /** 1 − RTP for the game(s) played during that period */
  houseEdge: number;
  /** Fraction of expected losses refunded, e.g. 0.1 for 10% */
  cashbackPct: number;
  /** £ cap on the cashback payout; undefined = uncapped */
  cashbackCap?: number;
}

export interface CashbackEvResult {
  /** Expected £ the player would lose over the period, offer or not */
  expectedLoss: number;
  /** Expected £ refunded - the offer's actual marginal value */
  cashbackAmount: number;
  /** Equal to cashbackAmount - the underlying loss isn't caused by the offer */
  ev: number;
}

export function cashbackEv(input: CashbackEvInput): CashbackEvResult {
  const turnover = input.expectedTurnover;
  if (!Number.isFinite(turnover) || turnover <= 0) {
    return { expectedLoss: 0, cashbackAmount: 0, ev: 0 };
  }
  const edge = clampEdge(input.houseEdge);
  const pct = Math.min(1, Math.max(0, input.cashbackPct));
  const expectedLoss = roundPence(turnover * edge);
  const uncapped = expectedLoss * pct;
  const cap = input.cashbackCap;
  const cashbackAmount = roundPence(
    Number.isFinite(cap) && cap != null ? Math.min(uncapped, cap) : uncapped
  );
  return { expectedLoss, cashbackAmount, ev: cashbackAmount };
}

/** Sums locked component EVs into a campaign total - exact, never hand-rolled. */
export function sumCampaignEv(components: { expectedEv: number }[]): number {
  return roundPence(components.reduce((sum, c) => sum + c.expectedEv, 0));
}

export type CasinoComponentType =
  | "qualifying_wager"
  | "cash"
  | "bonus"
  | "free_spins"
  | "golden_chips"
  | "cashback";

/** Loosely-typed, nullable input mirroring the `casino_offer_components` row shape. */
export interface ComponentEvInput {
  componentType: CasinoComponentType;
  amount?: number | null;
  wageringMultiplier?: number | null;
  rtp?: number | null;
  contributionPct?: number | null;
  spins?: number | null;
  spinValue?: number | null;
  chipCount?: number | null;
  chipValue?: number | null;
  cashbackPct?: number | null;
  cashbackCap?: number | null;
}

/**
 * Single entry point the API/services layer calls to lock a component's EV
 * at save time - branches to the calc function matching `componentType` so
 * no caller has to know which fields feed which formula. `rtp` null/undefined
 * falls back to the 96% heuristic default, same convention as `casinoOfferEv`.
 */
export function deriveComponentEv(input: ComponentEvInput): number {
  const houseEdge = houseEdgeFromRtp(input.rtp ?? DEFAULT_RTP);
  switch (input.componentType) {
    case "cash":
    case "bonus":
      return casinoOfferEv({
        bonusAmount: input.amount ?? 0,
        wageringMultiplier: input.componentType === "cash" ? 0 : (input.wageringMultiplier ?? 0),
        houseEdge,
        contributionPct: input.contributionPct ?? undefined,
      }).ev;
    case "free_spins":
      return freeSpinsEv({
        spins: input.spins ?? 0,
        spinValue: input.spinValue ?? 0,
        houseEdge,
        winningsWagerX: input.wageringMultiplier ?? undefined,
        contributionPct: input.contributionPct ?? undefined,
      }).ev;
    case "golden_chips":
      return goldenChipsEv({
        chipCount: input.chipCount ?? 0,
        chipValue: input.chipValue ?? 0,
        houseEdge,
      }).ev;
    case "qualifying_wager":
      return qualifyingWagerDrag({ amount: input.amount ?? 0, houseEdge }).ev;
    case "cashback":
      return cashbackEv({
        expectedTurnover: input.amount ?? 0,
        houseEdge,
        cashbackPct: input.cashbackPct ?? 0,
        cashbackCap: input.cashbackCap ?? undefined,
      }).ev;
  }
}
