/**
 * Last-known desk chrome for the first paint after a visit.
 * /api/state is too heavy to block the shell; this keeps the balance tab
 * and nav locks on screen while the live snapshot arrives.
 */

import type { BalanceSummary } from "@/lib/services/balances.types";
import type { AppSettings } from "@/lib/services/settings-shared";
import type { AppState } from "@/lib/services/state.types";

export const CHROME_SNAPSHOT_KEY = "edgeways.chromeSnapshot";
export const CHROME_SNAPSHOT_VERSION = 1;

export type ChromeSnapshot = {
  v: typeof CHROME_SNAPSHOT_VERSION;
  settledProfit: number;
  provisionalProfit: number;
  balances: BalanceSummary;
  demoMode: boolean;
  alertsUnread: number;
  boostsOpen: number;
  casinoNeedsAction: number;
  accaLayDueCount: number;
  betBuilderLayDueCount: number;
  settings: AppSettings;
};

export function chromeFromState(state: AppState): ChromeSnapshot {
  return {
    v: CHROME_SNAPSHOT_VERSION,
    settledProfit: state.settledProfit,
    provisionalProfit: state.provisionalProfit,
    balances: state.balances,
    demoMode: state.demoMode,
    alertsUnread: state.alertsUnread,
    boostsOpen: state.boostsOpen,
    casinoNeedsAction: state.casinoNeedsAction,
    accaLayDueCount: state.accaLayDue?.length ?? 0,
    betBuilderLayDueCount: state.betBuilderLayDue?.length ?? 0,
    settings: state.settings,
  };
}

export function parseChromeSnapshot(raw: string | null): ChromeSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChromeSnapshot>;
    if (parsed.v !== CHROME_SNAPSHOT_VERSION) return null;
    if (!parsed.balances || !parsed.settings) return null;
    if (typeof parsed.settledProfit !== "number") return null;
    if (typeof parsed.provisionalProfit !== "number") return null;
    return parsed as ChromeSnapshot;
  } catch {
    return null;
  }
}

export function readChromeSnapshot(): ChromeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    return parseChromeSnapshot(sessionStorage.getItem(CHROME_SNAPSHOT_KEY));
  } catch {
    return null;
  }
}

export function writeChromeSnapshot(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CHROME_SNAPSHOT_KEY,
      JSON.stringify(chromeFromState(state))
    );
  } catch {
    /* private mode / quota */
  }
}
