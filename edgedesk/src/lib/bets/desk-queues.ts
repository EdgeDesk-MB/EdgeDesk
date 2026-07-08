import type { BetRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers";

export type BetDeskQueue =
  | "all"
  | "open"
  | "needs_lay"
  | "offers"
  | "orphans";

export const BET_DESK_QUEUES: { id: BetDeskQueue; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "needs_lay", label: "Needs lay" },
  { id: "offers", label: "Offer campaigns" },
  { id: "orphans", label: "Orphans" },
];

/** Open back bet with no exchange hedge logged yet. */
export function betNeedsLay(bet: BetRow): boolean {
  return bet.status === "open" && bet.backStake > 0 && !(bet.layStake > 0);
}

export function betMatchesDeskQueue(bet: BetRow, queue: BetDeskQueue): boolean {
  switch (queue) {
    case "all":
      return true;
    case "open":
      return bet.status === "open";
    case "needs_lay":
      return betNeedsLay(bet);
    case "offers":
      return bet.offerId != null;
    case "orphans":
      return bet.offerId == null;
    default:
      return true;
  }
}

export function filterBetsByDeskQueue(bets: BetRow[], queue: BetDeskQueue): BetRow[] {
  return bets.filter((b) => betMatchesDeskQueue(b, queue));
}

export function countDeskQueue(bets: BetRow[], queue: BetDeskQueue): number {
  return filterBetsByDeskQueue(bets, queue).length;
}

export interface BetCampaignGroup {
  offerId: number | null;
  offer: OfferSummary | null;
  title: string;
  bets: BetRow[];
  openCount: number;
  needsLayCount: number;
}

/**
 * Group bets by offer campaign. Orphans (no offerId) land in a trailing bucket
 * when includeOrphans is true.
 */
export function groupBetsByCampaign(
  bets: BetRow[],
  offerById: Map<number, OfferSummary>,
  options?: { includeOrphans?: boolean }
): BetCampaignGroup[] {
  const includeOrphans = options?.includeOrphans ?? true;
  const byOffer = new Map<number, BetRow[]>();
  const orphans: BetRow[] = [];

  for (const bet of bets) {
    if (bet.offerId == null) {
      orphans.push(bet);
      continue;
    }
    const list = byOffer.get(bet.offerId) ?? [];
    list.push(bet);
    byOffer.set(bet.offerId, list);
  }

  const groups: BetCampaignGroup[] = [];

  for (const [offerId, offerBets] of byOffer) {
    const offer = offerById.get(offerId) ?? null;
    groups.push({
      offerId,
      offer,
      title: offer?.title ?? `Offer #${offerId}`,
      bets: sortBetsNewestFirst(offerBets),
      openCount: offerBets.filter((b) => b.status === "open").length,
      needsLayCount: offerBets.filter(betNeedsLay).length,
    });
  }

  groups.sort((a, b) => {
    const aActive = a.offer?.status === "active" || a.offer?.status === "planned" ? 0 : 1;
    const bActive = b.offer?.status === "active" || b.offer?.status === "planned" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const aTime = Math.max(...a.bets.map((x) => x.createdAt), 0);
    const bTime = Math.max(...b.bets.map((x) => x.createdAt), 0);
    return bTime - aTime;
  });

  if (includeOrphans && orphans.length > 0) {
    groups.push({
      offerId: null,
      offer: null,
      title: "Unlinked bets",
      bets: sortBetsNewestFirst(orphans),
      openCount: orphans.filter((b) => b.status === "open").length,
      needsLayCount: orphans.filter(betNeedsLay).length,
    });
  }

  return groups;
}

function sortBetsNewestFirst(bets: BetRow[]): BetRow[] {
  return [...bets].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
}

export function deskQueueEmptyCopy(queue: BetDeskQueue): {
  title: string;
  description: string;
} {
  switch (queue) {
    case "open":
      return {
        title: "No open bets",
        description: "Everything is settled — or add a new position to track.",
      };
    case "needs_lay":
      return {
        title: "No unmatched backs",
        description: "Every open back already has a lay stake logged.",
      };
    case "offers":
      return {
        title: "No offer-linked bets",
        description: "Link bets to an offer from Add bet, or start a campaign on Offers.",
      };
    case "orphans":
      return {
        title: "No orphan bets",
        description: "All logged bets are linked to an offer campaign.",
      };
    default:
      return {
        title: "No bets logged yet",
        description:
          "Add a bet manually, push one from any calculator, or import a screenshot.",
      };
  }
}
