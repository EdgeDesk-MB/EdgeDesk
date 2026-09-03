export type SettlePromptPlacement = "tracked-events" | "elsewhere";

export type SettlePromptCopy = {
  /** Prefix before the action when results sync is available. */
  lead: "auto-sync" | "none";
  actionKind: "link-tracked-events" | "set-result-on-page";
  racePhrase: "this race" | "these races";
};

/** Placement-aware instruction after "{course} ({off}) has started." */
export function settlePromptCopy(opts: {
  placement: SettlePromptPlacement;
  resultsTier?: "basic" | "free" | "none";
  pendingCount: number;
}): SettlePromptCopy {
  return {
    lead: opts.resultsTier === "basic" ? "auto-sync" : "none",
    actionKind:
      opts.placement === "tracked-events"
        ? "set-result-on-page"
        : "link-tracked-events",
    racePhrase: opts.pendingCount === 1 ? "this race" : "these races",
  };
}
