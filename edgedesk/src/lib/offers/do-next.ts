/**
 * Unified "Do next" queue for Home - merges offer actions + orphan free-bet lots,
 * deduped so convert work isn't shown three times.
 */
import type { OfferSummary } from "@/lib/services/offers.types";
import {
  deriveOfferNextAction,
  isActionableOfferNext,
  listOfferNextActions,
  offerNextActionLabel,
  type OfferNextAction,
  type OfferNextActionKind,
} from "@/lib/offers/next-actions";
import { estimateOfferRemainingEv, scoreOfferAdvantage, type AdvantageOpts, type EvBasis } from "@/lib/offers/advantage";
import {
  formatOfferDaysLeftLabel,
  offerExpiryDaysLeft,
} from "@/lib/offers/offer-expiry";

export type DoNextSort = "priority" | "edge" | "rate";

/** Estimated effort in minutes per action kind — tune over time. */
export const EFFORT_MINUTES: Record<OfferNextActionKind | "orphan_free_bet", number> = {
  start_planned: 10,
  place_qualifying: 8,
  convert_free_bet: 6,
  review_expiry: 2,
  await_result: 0,
  orphan_free_bet: 6,
};

export type FreeBetLotInput = {
  id: number;
  accountId: number;
  accountName: string;
  remaining: number;
  note: string | null;
  createdAt: number;
};

export type DoNextItem = {
  id: string;
  kind: OfferNextActionKind | "orphan_free_bet";
  title: string;
  detail: string;
  bookmaker: string | null;
  offerTitle: string | null;
  offerId: number | null;
  /** Tracker / offers href - null for orphan lots (use Add bet CTA) */
  href: string | null;
  remainingEv: number;
  basis: EvBasis;
  /** Lower = more urgent (priority sort) */
  priority: number;
  /** Higher = better edge (edge sort) */
  edgeScore: number;
  /** EV per hour of estimated effort (£/hr); used by "rate" sort */
  rateScore: number;
  /** Days until offer expires — for urgency copy on cards */
  daysLeft: number | null;
  /** "Ends today", "1 day left", etc. */
  expiryLabel: string | null;
  /** Prefill for Add bet when converting a free-bet lot */
  convertLot?: {
    accountName: string;
    remaining: number;
    labelSuggestion: string;
  };
};

function normVenue(name: string): string {
  return name.trim().toLowerCase();
}

function lotMatchesOffer(lot: FreeBetLotInput, offer: OfferSummary): boolean {
  if (!offer.bookmaker) return false;
  return normVenue(lot.accountName) === normVenue(offer.bookmaker);
}

/**
 * Build a single ranked list of things to do next.
 * Offer convert actions absorb matching free-bet lots; leftover lots become orphan cards.
 */
export function buildDoNextItems(
  offers: OfferSummary[],
  lots: FreeBetLotInput[],
  now = Date.now(),
  opts?: AdvantageOpts
): DoNextItem[] {
  const actions = listOfferNextActions(offers, now);
  const claimedLotIds = new Set<number>();
  const items: DoNextItem[] = [];

  for (const action of actions) {
    const offer = offers.find((o) => o.id === action.offerId);
    if (!offer) continue;

    const advantage = scoreOfferAdvantage(offer, now, opts);
    const { remainingEv, basis } = estimateOfferRemainingEv(offer, opts);
    const daysLeft = offerExpiryDaysLeft(offer, now);
    const expiryLabel = formatOfferDaysLeftLabel(daysLeft);

    let convertLot: DoNextItem["convertLot"];
    if (action.kind === "convert_free_bet") {
      const match = lots.find(
        (lot) => !claimedLotIds.has(lot.id) && lotMatchesOffer(lot, offer)
      );
      if (match) {
        claimedLotIds.add(match.id);
        convertLot = {
          accountName: match.accountName,
          remaining: match.remaining,
          labelSuggestion: `Convert FB · ${match.accountName}`,
        };
      }
    }

    const itemEv = advantage?.remainingEv ?? remainingEv;
    const effortMin = EFFORT_MINUTES[action.kind];
    items.push({
      id: `offer-${action.offerId}-${action.kind}`,
      kind: action.kind,
      title: action.title,
      detail: action.detail,
      bookmaker: action.bookmaker,
      offerTitle: action.offerTitle,
      offerId: action.offerId,
      href: action.href,
      remainingEv: itemEv,
      basis: advantage?.basis ?? basis,
      priority: action.priority,
      edgeScore: advantage?.score ?? remainingEv,
      rateScore: (itemEv / Math.max(effortMin, 1)) * 60,
      daysLeft,
      expiryLabel,
      convertLot,
    });
  }

  for (const lot of lots) {
    if (claimedLotIds.has(lot.id)) continue;
    if (lot.remaining <= 0.005) continue;

    const note =
      lot.note?.replace(/^Free bet promo - /, "").trim() || "Free bet credit";
    const ev = lot.remaining * (opts?.retention ?? 0.8);

    items.push({
      id: `lot-${lot.id}`,
      kind: "orphan_free_bet",
      title: "Convert free bet",
      detail: note,
      bookmaker: lot.accountName,
      offerTitle: null,
      offerId: null,
      href: null,
      remainingEv: ev,
      basis: (opts?.retentionSampleSize ?? 0) >= 5 ? "estimated" : "heuristic",
      priority: 11,
      edgeScore: ev * 1.2,
      rateScore: (ev / EFFORT_MINUTES.orphan_free_bet) * 60,
      daysLeft: null,
      expiryLabel: null,
      convertLot: {
        accountName: lot.accountName,
        remaining: lot.remaining,
        labelSuggestion: `Convert FB · ${lot.accountName}`,
      },
    });
  }

  return items;
}

export function sortDoNextItems(items: DoNextItem[], sort: DoNextSort): DoNextItem[] {
  const copy = [...items];
  if (sort === "edge") {
    return copy.sort((a, b) => {
      if (b.edgeScore !== a.edgeScore) return b.edgeScore - a.edgeScore;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.offerTitle ?? a.title).localeCompare(b.offerTitle ?? b.title);
    });
  }
  if (sort === "rate") {
    return copy.sort((a, b) => {
      if (b.rateScore !== a.rateScore) return b.rateScore - a.rateScore;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.offerTitle ?? a.title).localeCompare(b.offerTitle ?? b.title);
    });
  }
  return copy.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (b.edgeScore !== a.edgeScore) return b.edgeScore - a.edgeScore;
    return (a.offerTitle ?? a.title).localeCompare(b.offerTitle ?? b.title);
  });
}

const BASIS_RANK: Record<EvBasis, number> = { live: 2, estimated: 1, heuristic: 0 };

/**
 * Total EV across all actionable (non-await) items with a positive EV,
 * plus the weakest basis contributing to that total.
 * Used by the Edge Hero to summarise what's on the table.
 */
export function sumActionableEv(items: DoNextItem[]): { total: number; weakestBasis: EvBasis } {
  const actionable = items.filter((i) => i.kind !== "await_result" && i.remainingEv > 0);
  const total = actionable.reduce((s, i) => s + i.remainingEv, 0);
  const weakest = actionable.reduce<EvBasis | null>((w, i) => {
    if (w === null || BASIS_RANK[i.basis] < BASIS_RANK[w]) return i.basis;
    return w;
  }, null);
  return { total, weakestBasis: weakest ?? "heuristic" };
}

export function doNextActionLabel(kind: DoNextItem["kind"]): string {
  if (kind === "orphan_free_bet") return "Convert";
  return offerNextActionLabel(kind);
}

/** Accent bar colour by action kind (calendar-style). */
export function doNextBarClass(kind: DoNextItem["kind"]): string {
  switch (kind) {
    case "convert_free_bet":
    case "orphan_free_bet":
      return "bg-violet-500";
    case "review_expiry":
      return "bg-amber-500";
    case "place_qualifying":
    case "start_planned":
      return "bg-sky-500";
    default:
      return "bg-muted-foreground/50";
  }
}

export function doNextKindBadgeClass(kind: DoNextItem["kind"]): string {
  switch (kind) {
    case "convert_free_bet":
    case "orphan_free_bet":
      return "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "review_expiry":
      return "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "place_qualifying":
    case "start_planned":
      return "border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-300";
    default:
      return "border-border/60 bg-muted/40 text-muted-foreground";
  }
}

/** Re-export helpers used by callers that already have next-action types. */
export { isActionableOfferNext, deriveOfferNextAction };
export type { OfferNextAction };
