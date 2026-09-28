import { describe, expect, it } from "vitest";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import {
  buildHistoryContext,
  historyGoalScoreline,
  historyGoalTwoUpTrigger,
  isHiddenHistoryFeedEntry,
  matchesHistoryFilter,
  sortHistoryEntries,
} from "@/lib/history-display";
import {
  appendHistoryPage,
  buildHistoryPage,
  decodeHistoryCursor,
  HISTORY_PAGE_MAX,
  HISTORY_PAGE_SIZE,
  historyContextFromPage,
  historyPageApiPath,
  parseHistoryPageLimit,
  refreshHistoryHead,
  type HistoryPagePayload,
} from "@/lib/history-page";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 28, 12);

function bet(id: number, partial: Partial<BetRow> = {}): BetRow {
  return {
    id,
    eventId: null,
    label: `Bet ${id}`,
    market: "match_odds",
    selection: "",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: 1,
    backStake: 10,
    backOdds: 2,
    layStake: 10,
    layOdds: 2.02,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "won",
    expectedProfit: -0.2,
    actualProfit: -0.2,
    notes: null,
    balanceLedgered: 1,
    balanceSettled: 1,
    createdAt: NOW - id * DAY,
    settledAt: NOW - id * DAY + 60_000,
    offerId: id,
    source: null,
    quickLogged: null,
    sport: "football",
    purpose: null,
    importFingerprint: null,
    importMeta: null,
    ...partial,
  };
}

function row(id: number, partial: Partial<HistoryRow> & Pick<HistoryRow, "kind">): HistoryRow {
  return {
    id,
    dedupe: `test:${id}`,
    title: "Row",
    detail: null,
    note: null,
    amount: null,
    minute: null,
    eventId: null,
    betId: null,
    createdAt: NOW - id * 60_000,
    ...partial,
  };
}

const event: EventRow = {
  id: 7,
  sport: "football",
  externalId: null,
  competition: "Premier League",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  startTime: NOW - 3 * 60 * 60 * 1000,
  status: "finished",
  homeScore: 3,
  awayScore: 0,
  minute: 90,
  homeLed2: 1,
  awayLed2: 0,
  source: "api",
  goals: null,
  ftHomeScore: null,
  ftAwayScore: null,
  matchEnding: null,
  period: null,
  htHomeScore: null,
  htAwayScore: null,
  lineups: null,
  tapeFetchedAt: null,
  simScript: null,
  simStartedAt: null,
  resultPostedAt: null,
  createdAt: NOW - DAY,
};

/** 300 bets (placed + settled), a casino row older than all of them, three goals. */
function heavyDesk() {
  const bets: BetRow[] = [];
  const rows: HistoryRow[] = [];
  let id = 1;
  for (let b = 1; b <= 300; b += 1) {
    bets.push(bet(b));
    rows.push(row(id++, { kind: "settlement", betId: b, amount: -0.2, createdAt: NOW - b * DAY }));
    rows.push(row(id++, { kind: "bet_placed", betId: b, createdAt: NOW - b * DAY }));
  }
  rows.push(
    row(id++, { kind: "casino_settlement", title: "Casino done", amount: 12.5, createdAt: NOW - 400 * DAY })
  );
  const goal = (n: number, minute: number, score: string) =>
    row(id++, {
      kind: "goal",
      title: "Goal!",
      eventId: event.id,
      minute,
      dedupe: `score:${event.id}:${score}`,
      detail: `Arsenal ${score} Chelsea`,
    });
  rows.push(goal(1, 10, "1-0"), goal(2, 30, "2-0"), goal(3, 60, "3-0"));
  const offerTitles = bets.map((b) => ({ id: b.offerId!, title: `Offer ${b.offerId}` }));
  return { rows, bets, events: [event], offerTitles, promoAwards: { 3: { amount: 5, reason: "Free bet" } } };
}

function page(
  desk: ReturnType<typeof heavyDesk>,
  options: { filter?: HistoryPagePayload["filter"]; cursor?: string | null; limit?: number } = {}
) {
  return buildHistoryPage({
    ...desk,
    filter: options.filter ?? "all",
    cursor: options.cursor,
    limit: options.limit,
    isHidden: isHiddenHistoryFeedEntry,
  });
}

function fullFeed(desk: ReturnType<typeof heavyDesk>, filter: HistoryPagePayload["filter"] = "all") {
  const ctx = buildHistoryContext(desk.events, desk.bets, desk.promoAwards, desk.offerTitles, desk.rows);
  return sortHistoryEntries(desk.rows, ctx).filter(
    (e) => !isHiddenHistoryFeedEntry(e, ctx) && matchesHistoryFilter(e, filter, ctx)
  );
}

describe("buildHistoryPage", () => {
  it("returns a bounded first page, whatever the desk size", () => {
    const desk = heavyDesk();
    const first = page(desk);
    expect(first.entries).toHaveLength(HISTORY_PAGE_SIZE);
    expect(first.total).toBe(fullFeed(desk).length);
    expect(first.nextCursor).not.toBeNull();
    expect(first.bets.length).toBeLessThanOrEqual(HISTORY_PAGE_SIZE);
    const betIds = new Set(first.entries.map((e) => e.betId).filter((id) => id != null));
    expect(new Set(first.bets.map((b) => b.id))).toEqual(betIds);
    expect(first.offerTitles.every((o) => betIds.has(o.id))).toBe(true);
  });

  it("walks every row exactly once, in feed order, across pages", () => {
    const desk = heavyDesk();
    const seen: number[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const next: HistoryPagePayload = page(desk, { cursor, limit: 37 });
      seen.push(...next.entries.map((e) => e.id));
      cursor = next.nextCursor;
      pages += 1;
    } while (cursor && pages < 100);
    expect(seen).toEqual(fullFeed(desk).map((e) => e.id));
  });

  it("filters over all history, not just the newest rows", () => {
    const desk = heavyDesk();
    const casino = page(desk, { filter: "casino" });
    expect(casino.entries.map((e) => e.title)).toEqual(["Casino done"]);
    expect(casino.total).toBe(1);
    expect(casino.nextCursor).toBeNull();
    const settlements = page(desk, { filter: "settlements" });
    expect(settlements.total).toBe(301);
  });

  it("keeps whole-feed goal context when goals land on different pages", () => {
    const desk = heavyDesk();
    const full = buildHistoryContext(desk.events, desk.bets, desk.promoAwards, desk.offerTitles, desk.rows);
    let cursor: string | null = null;
    const goals: Array<{ id: number; side?: string; twoUp: boolean }> = [];
    do {
      const next: HistoryPagePayload = page(desk, { filter: "match_events", cursor, limit: 1 });
      const ctx = historyContextFromPage(next);
      for (const entry of next.entries) {
        goals.push({
          id: entry.id,
          side: historyGoalScoreline(entry, ctx)?.scoringSide ?? undefined,
          twoUp: historyGoalTwoUpTrigger(entry, ctx) != null,
        });
      }
      cursor = next.nextCursor;
    } while (cursor);
    const expected = fullFeed(desk, "match_events").map((entry) => ({
      id: entry.id,
      side: historyGoalScoreline(entry, full)?.scoringSide ?? undefined,
      twoUp: historyGoalTwoUpTrigger(entry, full) != null,
    }));
    expect(goals).toEqual(expected);
    expect(goals.filter((g) => g.twoUp)).toHaveLength(1);
  });

  it("starts from the top on a junk cursor", () => {
    const desk = heavyDesk();
    expect(page(desk, { cursor: "nope" }).entries[0]?.id).toBe(page(desk).entries[0]?.id);
    expect(decodeHistoryCursor("1_2")).toBeNull();
  });

  it("returns an empty last page for an empty desk", () => {
    const empty = buildHistoryPage({
      rows: [],
      events: [],
      bets: [],
      promoAwards: {},
      offerTitles: [],
      filter: "all",
      isHidden: isHiddenHistoryFeedEntry,
    });
    expect(empty).toMatchObject({ entries: [], total: 0, nextCursor: null });
  });
});

describe("appendHistoryPage", () => {
  it("adds the next page below without duplicating rows", () => {
    const desk = heavyDesk();
    const first = page(desk);
    const second = page(desk, { cursor: first.nextCursor });
    const merged = appendHistoryPage(first, second);
    expect(merged.entries.map((e) => e.id)).toEqual(
      fullFeed(desk).slice(0, 2 * HISTORY_PAGE_SIZE).map((e) => e.id)
    );
    expect(appendHistoryPage(merged, second).entries).toHaveLength(2 * HISTORY_PAGE_SIZE);
    expect(merged.nextCursor).toBe(second.nextCursor);
    const ctx = historyContextFromPage(merged);
    for (const entry of merged.entries) {
      if (entry.betId != null) expect(ctx.betsById.get(entry.betId)).toBeDefined();
    }
  });
});

describe("refreshHistoryHead", () => {
  function loadedPages(desk: ReturnType<typeof heavyDesk>, pages: number, limit: number) {
    let loaded = page(desk, { limit });
    for (let i = 1; i < pages; i += 1) {
      loaded = appendHistoryPage(loaded, page(desk, { cursor: loaded.nextCursor, limit }));
    }
    return loaded;
  }

  it("keeps rows below a capped re-read so the list does not shrink", () => {
    const desk = heavyDesk();
    const loaded = loadedPages(desk, 4, 50);
    const head = page(desk, { limit: 120 });
    const refreshed = refreshHistoryHead(loaded, head);
    expect(refreshed.entries.map((e) => e.id)).toEqual(loaded.entries.map((e) => e.id));
    expect(refreshed.nextCursor).toBe(loaded.nextCursor);
  });

  it("takes the fresh head when it covers everything loaded", () => {
    const desk = heavyDesk();
    const loaded = loadedPages(desk, 2, 50);
    const head = page(desk, { limit: 100 });
    expect(refreshHistoryHead(loaded, head)).toBe(head);
  });
});

describe("history page request", () => {
  it("builds the API path the page and the prefetch share", () => {
    expect(historyPageApiPath("all")).toBe("/api/history?filter=all&limit=50");
    expect(historyPageApiPath("casino", { cursor: "1_2_3", limit: 40 })).toBe(
      "/api/history?filter=casino&limit=40&cursor=1_2_3"
    );
  });

  it("clamps the page size", () => {
    expect(parseHistoryPageLimit(null)).toBe(HISTORY_PAGE_SIZE);
    expect(parseHistoryPageLimit("0")).toBe(HISTORY_PAGE_SIZE);
    expect(parseHistoryPageLimit("abc")).toBe(HISTORY_PAGE_SIZE);
    expect(parseHistoryPageLimit("100000")).toBe(HISTORY_PAGE_MAX);
  });
});
