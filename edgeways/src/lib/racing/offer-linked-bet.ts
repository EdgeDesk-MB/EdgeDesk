/**
 * Per-offer bet attribution for Racing Desk offer workflow / compact cards.
 *
 * Prefer `offerId`. When a same-day sibling has replaced a used campaign, the
 * fresh card has a new id — fall back to bookmaker on this race only so the
 * completed play still marks that bookie's card (never another bookie's).
 */

export type OfferLinkedBetCandidate = {
  status: string;
  eventId: number | null;
  offerId: number | null;
  betType: string | null;
  selection: string | null;
  bookmaker?: string | null;
  layStake?: number | null;
  backStake?: number | null;
};

function isQualifyingType(betType: string | null): boolean {
  return betType === "qualifying" || betType === "risk_free";
}

function hasSelection(selection: string | null): boolean {
  return !!selection?.trim();
}

function bookmakersMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = a?.trim().toLowerCase();
  const nb = b?.trim().toLowerCase();
  return !!na && !!nb && na === nb;
}

function statusAllowed(
  status: string,
  includeSettled: boolean
): boolean {
  if (status === "open") return true;
  if (!includeSettled) return false;
  return status !== "void";
}

/**
 * Qualifying / risk-free bet for this offer on the tracked race.
 * @param includeSettled When true (compact cards), settled linked bets still
 *   count so a completed play stays marked after settle / sibling spawn.
 */
export function findQualifyingBetForOfferOnRace(
  bets: readonly OfferLinkedBetCandidate[] | null | undefined,
  trackedEventId: number | null | undefined,
  offerId: number,
  bookmaker?: string | null,
  opts?: { includeSettled?: boolean }
): OfferLinkedBetCandidate | null {
  if (trackedEventId == null || bets == null) return null;
  const includeSettled = opts?.includeSettled ?? false;

  const byOffer =
    bets.find(
      (b) =>
        statusAllowed(b.status, includeSettled) &&
        b.eventId === trackedEventId &&
        b.offerId === offerId &&
        isQualifyingType(b.betType) &&
        hasSelection(b.selection)
    ) ?? null;
  if (byOffer) return byOffer;

  if (!bookmaker?.trim()) return null;
  return (
    bets.find(
      (b) =>
        statusAllowed(b.status, includeSettled) &&
        b.eventId === trackedEventId &&
        isQualifyingType(b.betType) &&
        hasSelection(b.selection) &&
        bookmakersMatch(b.bookmaker, bookmaker)
    ) ?? null
  );
}

/** Open-only lookup for live workflow step progress. */
export function findOpenQualifyingBetForOffer(
  bets: readonly OfferLinkedBetCandidate[] | null | undefined,
  trackedEventId: number | null | undefined,
  offerId: number,
  bookmaker?: string | null
): OfferLinkedBetCandidate | null {
  return findQualifyingBetForOfferOnRace(
    bets,
    trackedEventId,
    offerId,
    bookmaker,
    { includeSettled: false }
  );
}
