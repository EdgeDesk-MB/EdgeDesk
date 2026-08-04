import type { RacingResultsTier } from "@/lib/services/theracingapi";

export interface RacingSyncToastInput {
  updated: number;
  pending: number;
  tierBlocked?: boolean;
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
      title: `Updated ${result.updated} race${result.updated === 1 ? "" : "s"} from API`,
      description: "Full finish order saved - place-refund free bets re-check on refresh.",
    };
  }
  if (result.tierBlocked || result.tier === "free") {
    return {
      kind: "info",
      title: "API results unavailable on Free",
      description:
        "Stay on Free - use Set result (1st–4th) on Tracked Events or Profit Tracker for place-refund free bets. Basic (~£28/mo) only if you want auto results.",
    };
  }
  if (result.pending > 0) {
    return {
      kind: "info",
      title: "No API results yet",
      description:
        result.tier === "basic"
          ? "Results not published yet - retry Fetch results in a minute, or check the race is in today's GB/IRE card."
          : "Set Racing API credentials for auto results, or set the winner manually.",
    };
  }
  return { kind: "info", title: "Nothing to sync" };
}
