/** Client-safe subset of offer fields used for manual completion checks. */
export type OfferCompleteInput = {
  status: string;
  betCount: number;
  openBets: number;
  profit: {
    freeBetStage: string;
    freeBetAwardAmount: number | null;
  };
};

const FREE_BET_STAGES_BLOCKING_COMPLETE = new Set([
  "awarded",
  "in_use",
  "awaiting_result",
]);

/** True when every linked bet is settled and no free-bet stage is still in flight. */
export function campaignBetsAreComplete(
  betCount: number,
  hasOpenBets: boolean,
  freeBetStage: string
): boolean {
  if (betCount === 0) return false;
  if (hasOpenBets) return false;
  return !FREE_BET_STAGES_BLOCKING_COMPLETE.has(freeBetStage);
}

/** Whether the user can manually mark an active campaign complete from the offers page. */
export function canManuallyCompleteOffer(offer: OfferCompleteInput): boolean {
  if (offer.status !== "active") return false;
  return campaignBetsAreComplete(
    offer.betCount,
    offer.openBets > 0,
    offer.profit.freeBetStage
  );
}

export function offerManualCompleteBlockedReason(offer: OfferCompleteInput): string | null {
  if (offer.status !== "active") return null;
  if (offer.betCount === 0) return "Link at least one bet before completing.";
  if (offer.openBets > 0) return "Settle open bets before completing.";
  if (offer.profit.freeBetStage === "awarded") {
    const amt = offer.profit.freeBetAwardAmount;
    return amt != null
      ? `Convert your £${amt.toFixed(2)} free bet first - place an SNR/SR bet in the tracker.`
      : "Convert your free bet before completing.";
  }
  if (offer.profit.freeBetStage === "in_use") {
    return "Settle the free-bet conversion bet before completing.";
  }
  if (offer.profit.freeBetStage === "awaiting_result") {
    return "Await the qualifying result before completing.";
  }
  return null;
}
