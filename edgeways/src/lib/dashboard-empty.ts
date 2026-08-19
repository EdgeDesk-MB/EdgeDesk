import type { AppState } from "@/lib/services/state.types";

/**
 * True when the desk has real user activity (bets, offers, history, tracked
 * events, or non-zero P&L). Used before choosing empty CTA vs desk.
 */
export function hasSetupAccounts(state: AppState): boolean {
  return state.balances.accounts.some(
    (row) => row.type === "bank" || row.type === "bookie"
  );
}

export function needsSetup(state: AppState): boolean {
  return !hasSetupAccounts(state);
}

export function hasDeskActivity(state: AppState): boolean {
  if (state.bets.length > 0) return true;
  if (state.offers.length > 0) return true;
  if (state.events.length > 0) return true;
  if (state.history.length > 0) return true;
  if (state.livePositions.length > 0) return true;
  if (state.series.length > 0) return true;
  if (Math.abs(state.settledProfit) > 0.01) return true;
  if (Math.abs(state.provisionalProfit) > 0.01) return true;
  return false;
}

/**
 * Dashboard "No positions yet" empty CTA. Returns false until `/api/state` has
 * loaded so a refresh never flashes onboarding over an established desk.
 */
export function shouldShowDashboardEmptyCta(state: AppState | null): boolean {
  if (state == null) return false;
  return !hasDeskActivity(state);
}
