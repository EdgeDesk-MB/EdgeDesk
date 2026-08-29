import { matchedBet } from "@/lib/calc/matched";
import { roundPence } from "@/lib/calc/money";

/** Typical SNR free-bet cash extraction (~75%). */
export const FREE_BET_EV_RETENTION = 0.75;

/** Slightly higher retention for place-triggered refunds (picker has edge). */
export const PLACE_REFUND_FB_RETENTION = 0.8;

const DEFAULT_COMMISSION = 0.02;

export function estimateFreeBetEv(freeBetAmount: number | null): number | null {
  if (freeBetAmount == null || freeBetAmount <= 0) return null;
  return roundPence(freeBetAmount * FREE_BET_EV_RETENTION);
}

/**
 * Bet-boost EV at underlay: profit rides on the bookie win.
 * Uses min odds as a conservative floor; assumes lay odds ≈ back odds.
 */
export function estimateBoostWinningsEv(input: {
  maxStake: number;
  minOdds: number;
  boostPercent: number;
  commission?: number;
}): number {
  const { maxStake: S, minOdds: Ob, boostPercent, commission = DEFAULT_COMMISSION } = input;
  if (S <= 0 || Ob <= 1 || boostPercent <= 0) return 0;

  const B = boostPercent / 100;
  const Ol = Ob;
  const backWinProfit = S * (Ob - 1) * (1 + B);
  const layStake = S / (1 - commission);
  const ifBackWins = backWinProfit - layStake * (Ol - 1);
  return roundPence(Math.max(0, ifBackWins));
}

/** Rough EV for bet £X get £Y after typical qualifying loss (~3% of stake). */
export function estimateBetGetEv(
  betStake: number | null,
  freeBetAmount: number | null,
  _minOdds: number | null
): number | null {
  if (freeBetAmount == null || freeBetAmount <= 0) return null;
  const fbEv = freeBetAmount * FREE_BET_EV_RETENTION;
  const qualLoss = betStake != null && betStake > 0 ? -betStake * 0.03 : 0;
  return roundPence(fbEv + qualLoss);
}

/** Place-refund: refund EV minus rough qualifying loss. */
export function estimatePlaceRefundEv(
  betStake: number | null,
  freeBetAmount: number | null,
  placeCount: number
): number | null {
  if (freeBetAmount == null || freeBetAmount <= 0) return null;
  const stake = betStake ?? freeBetAmount;
  const triggerProb = placeCount >= 3 ? 0.22 : 0.18;
  const fbEv = freeBetAmount * PLACE_REFUND_FB_RETENTION * triggerProb;
  const qualLoss = stake * -0.04;
  return roundPence(fbEv + qualLoss);
}

/**
 * Refund-If (money back as free bet if the back loses).
 *
 * Lay is sized to equalise both outcomes including the anticipated SNR
 * extraction, which is an underlay vs a normal qualifier. Typical play uses
 * odds 3.0 (or the offer minimum when higher), not the 1.50 T&C floor.
 *
 * Worked example: £100 back @ 3.00, lay 3.10, 2% commission, £100 refund at
 * 75% retention → win = 200, lose = −25, L = 225 / 3.08 = 73.05,
 * guaranteed ≈ £46.59.
 */
export function estimateRiskFreeEv(
  betStake: number | null,
  refundAmount: number | null,
  minOdds?: number | null
): number | null {
  const stake = betStake ?? refundAmount;
  const refund = refundAmount ?? betStake;
  if (stake == null || stake <= 0 || refund == null || refund <= 0) return null;
  const backOdds = Math.max(minOdds ?? 3, 3);
  const result = matchedBet({
    mode: "risk_free",
    backStake: stake,
    backOdds,
    layOdds: backOdds + 0.1,
    commission: DEFAULT_COMMISSION,
    refundAmount: refund,
    refundRetention: FREE_BET_EV_RETENTION,
  });
  return roundPence(result.guaranteed);
}

/** Deposit match (casino/sports): very rough until wagering known. */
export function estimateDepositMatchEv(bonusAmount: number | null): number | null {
  if (bonusAmount == null || bonusAmount <= 0) return null;
  return roundPence(bonusAmount * 0.35);
}

/** Acca insurance: stake-weighted rough EV. */
export function estimateAccaInsuranceEv(stake: number | null): number | null {
  if (stake == null || stake <= 0) return null;
  return roundPence(stake * 0.12);
}
