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

/** Whether the user can manually mark an active campaign complete from the offers page. */
export function canManuallyCompleteOffer(offer: OfferCompleteInput): boolean {
  if (offer.status !== "active") return false;
  if (offer.betCount === 0) return false;
  if (offer.openBets > 0) return false;
  const stage = offer.profit.freeBetStage;
  if (stage === "awarded" || stage === "in_use" || stage === "awaiting_result") return false;
  return true;
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
