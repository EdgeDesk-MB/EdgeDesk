/**
 * Cursor pages for the History feed (EDGE-223). The server sorts and filters
 * the whole feed, then sends one page plus only the bets, events and derived
 * goal context those rows need. Filters therefore cover all history while
 * the payload stays bounded by the page size, not the desk size.
 */
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import type { Side } from "@/lib/calc/trigger";
import type { HistoryTwoUpTrigger } from "@/lib/history-goal-copy";
import {
  buildHistoryContext,
  compareHistorySortKeys,
  historySortKey,
  matchesHistoryFilter,
  resolveHistoryEvent,
  sortHistoryEntries,
  type HistoryContext,
  type HistoryFilter,
  type HistorySortKey,
} from "@/lib/history-display";

export const HISTORY_PAGE_SIZE = 50;
export const HISTORY_PAGE_MAX = 500;

type PromoAwards = Record<number, { amount: number; reason: string }>;

export interface HistoryPagePayload {
  entries: HistoryRow[];
  /** Only the events the page's rows resolve to. */
  events: EventRow[];
  /** Only the bets the page's rows link to. */
  bets: BetRow[];
  promoAwards: PromoAwards;
  offerTitles: Array<{ id: number; title: string }>;
  /** Scoring side per goal row, inferred over the whole feed. */
  goalSides: Array<[number, Side]>;
  /** 2UP trigger goals for the page's events, inferred over the whole feed. */
  twoUpTriggers: Array<[number, HistoryTwoUpTrigger]>;
  filter: HistoryFilter;
  /** Pass back as `cursor` for the next page. Null on the last page. */
  nextCursor: string | null;
  /** Rows matching the filter across all history. */
  total: number;
}

export function historyPageApiPath(
  filter: HistoryFilter,
  options: { cursor?: string | null; limit?: number } = {}
): string {
  const params = new URLSearchParams({
    filter,
    limit: String(options.limit ?? HISTORY_PAGE_SIZE),
  });
  if (options.cursor) params.set("cursor", options.cursor);
  return `/api/history?${params.toString()}`;
}

export function parseHistoryPageLimit(raw: string | null): number {
  const n = Math.floor(Number(raw ?? HISTORY_PAGE_SIZE));
  if (!Number.isFinite(n) || n < 1) return HISTORY_PAGE_SIZE;
  return Math.min(n, HISTORY_PAGE_MAX);
}

export function encodeHistoryCursor(key: HistorySortKey): string {
  return key.join("_");
}

export function decodeHistoryCursor(raw: string | null | undefined): HistorySortKey | null {
  if (!raw) return null;
  const parts = raw.split("_").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0]!, parts[1]!, parts[2]!];
}

export function buildHistoryPage(input: {
  /** Every feed row for the desk, already through `dedupeHistoryForDisplay`. */
  rows: HistoryRow[];
  events: EventRow[];
  bets: BetRow[];
  promoAwards: PromoAwards;
  offerTitles: Array<{ id: number; title: string }>;
  filter: HistoryFilter;
  cursor?: string | null;
  limit?: number;
  isHidden: (entry: HistoryRow, ctx: HistoryContext) => boolean;
}): HistoryPagePayload {
  const limit = input.limit ?? HISTORY_PAGE_SIZE;
  const ctx = buildHistoryContext(
    input.events,
    input.bets,
    input.promoAwards,
    input.offerTitles,
    input.rows
  );
  const feed = sortHistoryEntries(input.rows, ctx).filter(
    (entry) =>
      !input.isHidden(entry, ctx) &&
      (input.filter === "all" || matchesHistoryFilter(entry, input.filter, ctx))
  );

  const after = decodeHistoryCursor(input.cursor);
  const start = after ? firstIndexAfter(feed, after, ctx) : 0;
  const entries = feed.slice(start, start + limit);
  const last = entries.at(-1);
  const nextCursor =
    last && start + entries.length < feed.length
      ? encodeHistoryCursor(historySortKey(last, ctx))
      : null;

  return {
    ...historyContextSliceForEntries(entries, ctx),
    entries,
    filter: input.filter,
    nextCursor,
    total: feed.length,
  };
}

function firstIndexAfter(
  feed: HistoryRow[],
  cursor: HistorySortKey,
  ctx: HistoryContext
): number {
  let lo = 0;
  let hi = feed.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareHistorySortKeys(historySortKey(feed[mid]!, ctx), cursor) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

type HistoryContextSlice = Pick<
  HistoryPagePayload,
  "events" | "bets" | "promoAwards" | "offerTitles" | "goalSides" | "twoUpTriggers"
>;

function historyContextSliceForEntries(
  entries: HistoryRow[],
  ctx: HistoryContext
): HistoryContextSlice {
  const events = new Map<number, EventRow>();
  const bets = new Map<number, BetRow>();
  for (const entry of entries) {
    const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;
    if (bet) bets.set(bet.id, bet);
    const event = resolveHistoryEvent(entry, ctx);
    if (event) events.set(event.id, event);
  }

  const promoAwards: PromoAwards = {};
  const offerTitles: Array<{ id: number; title: string }> = [];
  const offerIds = new Set<number>();
  for (const bet of bets.values()) {
    const promo = ctx.promoByBetId[bet.id];
    if (promo) promoAwards[bet.id] = promo;
    if (bet.offerId != null && !offerIds.has(bet.offerId)) {
      const title = ctx.offerTitleById.get(bet.offerId);
      offerIds.add(bet.offerId);
      if (title != null) offerTitles.push({ id: bet.offerId, title });
    }
  }

  const goalSides: Array<[number, Side]> = [];
  for (const entry of entries) {
    const side = ctx.goalScoringSideById.get(entry.id);
    if (side) goalSides.push([entry.id, side]);
  }
  const twoUpTriggers = [...ctx.twoUpTriggerByGoalId].filter(([, trigger]) =>
    events.has(trigger.eventId)
  );

  return {
    events: [...events.values()],
    bets: [...bets.values()],
    promoAwards,
    offerTitles,
    goalSides,
    twoUpTriggers,
  };
}

/** Client context for loaded pages. Uses the server's whole-feed goal inference. */
export function historyContextFromPage(page: HistoryContextSlice): HistoryContext {
  const ctx = buildHistoryContext(page.events, page.bets, page.promoAwards, page.offerTitles);
  return {
    ...ctx,
    goalScoringSideById: new Map(page.goalSides),
    twoUpTriggerByGoalId: new Map(page.twoUpTriggers),
  };
}

/** Append the next page to what is already on screen. */
export function appendHistoryPage(
  loaded: HistoryPagePayload,
  next: HistoryPagePayload
): HistoryPagePayload {
  const seen = new Set(loaded.entries.map((e) => e.id));
  return {
    entries: [...loaded.entries, ...next.entries.filter((e) => !seen.has(e.id))],
    events: unionById(loaded.events, next.events),
    bets: unionById(loaded.bets, next.bets),
    promoAwards: { ...loaded.promoAwards, ...next.promoAwards },
    offerTitles: unionById(loaded.offerTitles, next.offerTitles),
    goalSides: [...new Map([...loaded.goalSides, ...next.goalSides])],
    twoUpTriggers: [...new Map([...loaded.twoUpTriggers, ...next.twoUpTriggers])],
    filter: next.filter,
    nextCursor: next.nextCursor,
    total: next.total,
  };
}

/**
 * Swap in a re-read head (after a note or award edit). When more was loaded
 * than one request may return, rows below the head stay as loaded so the
 * list does not shrink under the reader.
 */
export function refreshHistoryHead(
  loaded: HistoryPagePayload,
  head: HistoryPagePayload
): HistoryPagePayload {
  const lastId = head.entries.at(-1)?.id;
  const at = lastId == null ? -1 : loaded.entries.findIndex((e) => e.id === lastId);
  if (!head.nextCursor || at < 0 || at === loaded.entries.length - 1) return head;
  const tail = { ...loaded, entries: loaded.entries.slice(at + 1) };
  return { ...appendHistoryPage(head, tail), total: head.total };
}

function unionById<T extends { id: number }>(a: T[], b: T[]): T[] {
  return [...new Map([...a, ...b].map((row) => [row.id, row])).values()];
}
