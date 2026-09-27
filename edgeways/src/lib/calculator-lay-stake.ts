/**
 * Calculator lay-stake override. Same validation and resolution as Add bet
 * (`add-bet-lay-stake.ts`), but a typed stake is Manual: it stays fixed when
 * the back stake, odds or commission change, until the field is cleared or
 * the user resets to auto. Add bet instead drops a typed stake when those
 * inputs change.
 */

import type { LayPlanInput } from "@/lib/calc";
import {
  commitLayStakeOverride,
  resolveAddBetLayStake,
  type LaySnapTarget,
} from "@/lib/add-bet-lay-stake";

const MANUAL_KEY = "manual";

/**
 * Next manual lay stake after the user types `typed`. `null` is auto.
 * A cleared field (NaN) returns to auto. Negative or non-finite input is
 * rejected and the current value kept. While the plan is pending (no back
 * stake or odds yet) typing is ignored, so a stray £0 cannot stick.
 */
export function nextManualLayStake(
  current: number | null,
  typed: number,
  planReady: boolean
): number | null {
  if (Number.isNaN(typed)) return null;
  if (!planReady) return current;
  return commitLayStakeOverride(typed, MANUAL_KEY)?.stake ?? current;
}

export function resolveCalculatorLayStake(
  planInput: LayPlanInput | null,
  manual: number | null,
  snap: LaySnapTarget | null = null
): number {
  return resolveAddBetLayStake(
    planInput,
    manual == null ? null : { stake: manual, key: MANUAL_KEY },
    MANUAL_KEY,
    snap
  );
}
