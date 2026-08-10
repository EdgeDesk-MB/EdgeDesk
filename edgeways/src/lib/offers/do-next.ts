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
  type OfferNextActionEdge,
  type OfferNextActionKind,
} from "@/lib/offers/next-actions";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import { estimateOfferRemainingEv, scoreOfferAdvantage, type AdvantageOpts, type EvBasis } from "@/lib/offers/advantage";
import type { BookmakerHealth } from "@/lib/accounts/bookmaker-stats";
import {
  formatOfferDaysLeftLabel,
  offerExpiryDaysLeft,
} from "@/lib/offers/offer-expiry";
import { offerRequiredStake } from "@/lib/offers/offer-required-stake";
import { campaignFbBadge } from "@/lib/ui/surface-styles";

export type DoNextSort = "priority" | "edge" | "rate";

/** Normalised bookmaker name → cash balance available */
export type BookieBalanceMap = Map<string, number>;

/** Estimated effort in minutes per action kind — tune over time. */
export const EFFORT_MINUTES: Record<
  OfferNextActionKind | "orphan_free_bet",
  number
> = {
  start_planned: 10,
  place_qualifying: 8,
  convert_free_bet: 6,
  review_expiry: 2,
  await_result: 0,
  playbook_deposit: 5,
  playbook_opt_in: 2,
  playbook_clear_wagering: 8,
  orphan_free_bet: 6,
};

export type FreeBetLotInput = {
  id: number;
  accountId: number;
  accountName: string;
  remaining: number;
  note: string | null;
  createdAt: number;
  /** Awarding bet id when the lot came from a promo credit. */
  betId?: number | null;
  /** Resolved campaign id (via awarding bet) so Acca reward scopes still apply. */
  offerId?: number | null;
};

export interface DoNextFunding {
  needed: number;
  available: number;
  short: number;
}

export type DoNextItem = {
  id: string;
  kind: OfferNextActionKind | "orphan_free_bet" | "fund_account" | "place_mug";
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
  /** Nominal free-bet face value (£) — drives convert-first ranking */
  freeBetAmount?: number;
  /** Prefill for Add bet when converting a free-bet lot */
  convertLot?: {
    accountName: string;
    remaining: number;
    labelSuggestion: string;
  };
  /** Set when the bookie account can't fund the required stake */
  funding?: DoNextFunding;
  /** Effective bookie health (B9) - gubbed cards sink but stay visible */
  health?: BookmakerHealth;
  /** The race and horse Offer Edge recommends, when it could name one */
  edge?: OfferNextActionEdge;
};

function normVenue(name: string): string {
  return name.trim().toLowerCase();
}

function lotMatchesOffer(lot: FreeBetLotInput, offer: OfferSummary): boolean {
  if (lot.offerId != null) return lot.offerId === offer.id;
  if (!offer.bookmaker) return false;
  return normVenue(lot.accountName) === normVenue(offer.bookmaker);
}

/** buildDoNextItems options - advantage opts plus E1 effort-minute overrides. */
export type DoNextOpts = AdvantageOpts & {
  /** Sparse overrides for EFFORT_MINUTES, keyed by action kind (E1 tuning). */
  effortMinutes?: Record<string, number>;
  /** J5: bookies whose mug cadence is due - lowest-priority reminder items */
  mugDue?: Array<{ accountName: string; daysSince: number | null }>;
  /** Best Offer Edge play per offer id, so qualifying actions can name a race. */
  edgePlays?: Map<number, OfferEdgePlay>;
};

/**
 * Build a single ranked list of things to do next.
 * Offer convert actions absorb matching free-bet lots; leftover lots become orphan cards.
 * bookieBalances: normalised-name → cash balance for funding checks (B3).
 */
export function buildDoNextItems(
  offers: OfferSummary[],
  lots: FreeBetLotInput[],
  now = Date.now(),
  opts?: DoNextOpts,
  bookieBalances?: BookieBalanceMap
): DoNextItem[] {
  const actions = listOfferNextActions(offers, now, { edgePlays: opts?.edgePlays });
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
    let freeBetAmount: number | undefined;
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
        freeBetAmount = match.remaining;
      } else if (offer.profit.freeBetAwardAmount != null) {
        freeBetAmount = offer.profit.freeBetAwardAmount;
      }
    }

    const itemEv = advantage?.remainingEv ?? remainingEv;
    const effortMin = opts?.effortMinutes?.[action.kind] ?? EFFORT_MINUTES[action.kind];

    let funding: DoNextFunding | undefined;
    if (
      bookieBalances &&
      action.bookmaker &&
      (action.kind === "place_qualifying" || action.kind === "start_planned")
    ) {
      // Non-racing offers often have no parsed stake in `rules` - without a
      // known required stake we can't judge a shortfall, so skip the check
      // rather than guess (a guessed £10 was showing bogus shortfalls).
      const needed = offerRequiredStake(offer);
      if (needed != null) {
        const available = bookieBalances.get(normVenue(action.bookmaker)) ?? -1;
        if (available >= 0 && available < needed) {
          funding = { needed, available, short: needed - available };
        }
      }
    }

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
      freeBetAmount,
      funding,
      health: advantage?.health,
      edge: action.edge,
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
      offerId: lot.offerId ?? null,
      href: lot.offerId != null ? `/offers?highlight=${lot.offerId}` : null,
      remainingEv: ev,
      basis: (opts?.retentionSampleSize ?? 0) >= 5 ? "estimated" : "heuristic",
      priority: 11,
      edgeScore: ev * 1.2,
      rateScore:
        (ev / Math.max(opts?.effortMinutes?.orphan_free_bet ?? EFFORT_MINUTES.orphan_free_bet, 1)) *
        60,
      daysLeft: null,
      expiryLabel: null,
      freeBetAmount: lot.remaining,
      convertLot: {
        accountName: lot.accountName,
        remaining: lot.remaining,
        labelSuggestion: `Convert FB · ${lot.accountName}`,
      },
    });
  }

  // Shortfalls stay on the offer card (`funding` / "£X short at …"). No separate
  // fund_account card — that duplicated the same blocker and EV for one bookie.

  // J5: camouflage reminders - lowest priority, no EV claim (the point is
  // account longevity, not edge). Clicking opens Add bet pre-set to Mug.
  for (const due of opts?.mugDue ?? []) {
    items.push({
      id: `mug-${normVenue(due.accountName)}`,
      kind: "place_mug",
      title: `Mug bet at ${due.accountName}`,
      detail:
        due.daysSince == null
          ? "No camouflage logged yet - keep the account looking human"
          : `Last mug ${Math.floor(due.daysSince)}d ago - cadence due`,
      bookmaker: due.accountName,
      offerTitle: null,
      offerId: null,
      href: `/tracker?mug=${encodeURIComponent(due.accountName)}`,
      remainingEv: 0,
      basis: "heuristic",
      priority: 30,
      edgeScore: 0,
      rateScore: 0,
      daysLeft: null,
      expiryLabel: null,
      health: opts?.bookmakerHealth?.get(normVenue(due.accountName)),
    });
  }

  return items;
}

function isEarlierInstance(a: OfferSummary, b: OfferSummary): boolean {
  const ad = a.instanceDate ?? "";
  const bd = b.instanceDate ?? "";
  if (ad !== bd) return ad < bd;
  return a.id < b.id;
}

/**
 * Home "Do next" only: a repeating campaign shows just its first listed
 * instance. Later repeats keep appearing in the offers list and calendar.
 */
export function keepFirstRecurringInstance(
  items: DoNextItem[],
  offers: OfferSummary[]
): DoNextItem[] {
  const offersById = new Map(offers.map((o) => [o.id, o]));
  const firstBySeries = new Map<number, DoNextItem>();

  for (const item of items) {
    if (item.offerId == null) continue;
    const offer = offersById.get(item.offerId);
    if (!offer || offer.seriesId == null) continue;
    const current = firstBySeries.get(offer.seriesId);
    const currentOffer = current?.offerId != null ? offersById.get(current.offerId) : undefined;
    if (!currentOffer || isEarlierInstance(offer, currentOffer)) {
      firstBySeries.set(offer.seriesId, item);
    }
  }

  return items.filter((item) => {
    if (item.offerId == null) return true;
    const offer = offersById.get(item.offerId);
    if (!offer || offer.seriesId == null) return true;
    return firstBySeries.get(offer.seriesId) === item;
  });
}

export function isConvertFreeBetKind(kind: DoNextItem["kind"]): boolean {
  return kind === "convert_free_bet" || kind === "orphan_free_bet";
}

/** Nominal free-bet face value (£) for convert-first ranking. */
export function freeBetFaceValue(item: DoNextItem): number {
  return item.freeBetAmount ?? item.convertLot?.remaining ?? 0;
}

/** Convert free bets always rank first, highest face value first. */
export function compareConvertFreeBetFirst(a: DoNextItem, b: DoNextItem): number {
  const aConvert = isConvertFreeBetKind(a.kind);
  const bConvert = isConvertFreeBetKind(b.kind);
  if (aConvert && !bConvert) return -1;
  if (!aConvert && bConvert) return 1;
  if (aConvert && bConvert) {
    const byFace = freeBetFaceValue(b) - freeBetFaceValue(a);
    if (byFace !== 0) return byFace;
  }
  return 0;
}

export function sortDoNextItems(items: DoNextItem[], sort: DoNextSort): DoNextItem[] {
  const copy = [...items];
  if (sort === "edge") {
    return copy.sort((a, b) => {
      const convertCmp = compareConvertFreeBetFirst(a, b);
      if (convertCmp !== 0) return convertCmp;
      if (b.edgeScore !== a.edgeScore) return b.edgeScore - a.edgeScore;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.offerTitle ?? a.title).localeCompare(b.offerTitle ?? b.title);
    });
  }
  if (sort === "rate") {
    return copy.sort((a, b) => {
      const convertCmp = compareConvertFreeBetFirst(a, b);
      if (convertCmp !== 0) return convertCmp;
      if (b.rateScore !== a.rateScore) return b.rateScore - a.rateScore;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.offerTitle ?? a.title).localeCompare(b.offerTitle ?? b.title);
    });
  }
  return copy.sort((a, b) => {
    const convertCmp = compareConvertFreeBetFirst(a, b);
    if (convertCmp !== 0) return convertCmp;
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
  if (kind === "fund_account") return "Fund";
  if (kind === "place_mug") return "Mug bet";
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
    case "fund_account":
      return "bg-orange-400";
    case "place_mug":
      return "bg-slate-400";
    default:
      return "bg-muted-foreground/50";
  }
}

export function doNextKindBadgeClass(kind: DoNextItem["kind"]): string {
  switch (kind) {
    case "convert_free_bet":
    case "orphan_free_bet":
      return campaignFbBadge;
    case "review_expiry":
      return "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "place_qualifying":
    case "start_planned":
      return "border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-300";
    case "fund_account":
      return "border-orange-400/35 bg-orange-400/10 text-orange-800 dark:text-orange-300";
    case "place_mug":
      return "border-slate-400/35 bg-slate-400/10 text-slate-700 dark:text-slate-300";
    default:
      return "border-border/60 bg-muted/40 text-muted-foreground";
  }
}

/** Re-export helpers used by callers that already have next-action types. */
export { isActionableOfferNext, deriveOfferNextAction };
export type { OfferNextAction };
