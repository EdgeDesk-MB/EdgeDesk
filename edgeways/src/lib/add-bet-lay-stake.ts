/**
 * Add bet lay-stake wiring. The calc engine already equalises correctly;
 * this module decides when a typed override is still valid.
 *
 * A £0 banner value must not stick after the user later enters odds. Key the
 * override to the stake/odds it was chosen for, and drop it when they change.
 */

import { executableLayStake, type BetMode, type LayPlanInput } from "@/lib/calc";

export type KeyedLayOverride = {
  stake: number;
  /** {@link addBetLayCalcKey} of the inputs this stake was chosen for */
  key: string;
};

export function addBetLayCalcKey(input: {
  backStake: number;
  backOdds: number;
  layOdds: number;
  /** Exchange commission as a fraction (0.02 = 2%) */
  commission: number;
  mode: string;
  refundAmount?: number;
  refundRetention?: number;
}): string {
  const base = `${input.mode}:${input.backStake}:${input.backOdds}:${input.layOdds}:${input.commission}`;
  if (input.mode === "risk_free") {
    return `${base}:${input.refundAmount ?? ""}:${input.refundRetention ?? ""}`;
  }
  return base;
}

export function commitLayStakeOverride(
  value: number,
  currentKey: string
): KeyedLayOverride | null {
  if (!Number.isFinite(value) || value < 0) return null;
  return { stake: value, key: currentKey };
}

export function resolveAddBetLayStake(
  planInput: LayPlanInput | null,
  override: KeyedLayOverride | null,
  currentKey: string
): number {
  if (!planInput) return 0;
  const active =
    override != null && override.key === currentKey ? override.stake : null;
  return executableLayStake(planInput, active);
}

export function addBetMatchedSaveEnabled(input: {
  saving?: boolean;
  isDutch: boolean;
  dutchLegsCount: number;
  noLay: boolean;
  backStake: number;
  backOdds: number;
  preview: { totalLayStake: number } | null;
}): boolean {
  if (input.saving) return false;
  if (input.isDutch) return input.dutchLegsCount > 0;
  if (input.noLay) return input.backStake > 0 && input.backOdds > 1;
  return input.preview != null && input.preview.totalLayStake > 0;
}

export function addBetPlanMode(betType: string): BetMode {
  return betType === "no_lay" || betType === "dutch" || betType === "boost"
    ? "qualifying"
    : (betType as BetMode);
}
