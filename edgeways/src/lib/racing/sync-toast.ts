import type { RacingResultsTier } from "@/lib/services/theracingapi";

export interface RacingSyncToastInput {
  updated: number;
  pending: number;
  tierBlocked?: boolean;
  /** True when results for a previous day are not in the live feed. */
  historicBlocked?: boolean;
  tier?: RacingResultsTier;
}

export interface RacingSyncToast {
  kind: "success" | "info";
  title: string;
  description?: string;
}

/** Shared copy for Sync / Fetch results toasts (Tracked Events / Fixtures). */
export function racingSyncToast(result: RacingSyncToastInput): RacingSyncToast {
  if (result.updated > 0) {
    return {
      kind: "success",
      title: `Updated ${result.updated} race${result.updated === 1 ? "" : "s"}`,
      description: "Full finish order saved - place-refund free bets re-check on refresh.",
    };
  }
  if (result.tierBlocked || result.tier === "free") {
    return {
      kind: "info",
      title: "Results need a manual settle",
      description:
        "Use Set result (1st–4th) on Tracked Events or Profit Tracker for place-refund free bets.",
    };
  }
  if (result.historicBlocked && result.pending > 0) {
    return {
      kind: "info",
      title: "Yesterday's races need Set result",
      description: "Use Set result (1st–4th) on Tracked Events or Profit Tracker for older races.",
    };
  }
  if (result.pending > 0) {
    return {
      kind: "info",
      title: "No results yet",
      description:
        "Results may still be publishing. Retry in a minute, or set the winner yourself.",
    };
  }
  return { kind: "info", title: "Nothing to sync" };
}
