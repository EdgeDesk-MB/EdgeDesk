import { describe, expect, it, vi } from "vitest";
import {
  buildHistoryContext,
  formatHistoryTimeBadge,
  formatHistoryTimeBadgeParts,
  historyEntryTitle,
  historyOccurredAt,
  historyUsesMinuteBadge,
  isFreeBetHistoryEntry,
  isFreeBetPlacedHistoryEntry,
} from "@/lib/history-display";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";

function row(partial: Partial<HistoryRow> & Pick<HistoryRow, "kind" | "title">): HistoryRow {
  return {
    id: 1,
    dedupe: null,
    kind: partial.kind,
    title: partial.title,
    detail: partial.detail ?? null,
    amount: partial.amount ?? null,
    minute: partial.minute ?? null,
    eventId: partial.eventId ?? null,
    betId: partial.betId ?? 42,
    createdAt: partial.createdAt ?? Date.now(),
    ...partial,
  };
}

describe("isFreeBetHistoryEntry", () => {
  const ctx = buildHistoryContext([], [], { 42: { amount: 50, reason: "Finished 2nd" } });

  it("excludes bet placed rows even when the bet has a promo award", () => {
    expect(
      isFreeBetHistoryEntry(
        row({ kind: "bet_placed", title: "Bet placed", betId: 42 }),
        ctx
      )
    ).toBe(false);
  });

  it("includes settlement rows with Free bet won in the title", () => {
    expect(
      isFreeBetHistoryEntry(
        row({ kind: "settlement", title: "Bet lost · Free bet won!" }),
        ctx
      )
    ).toBe(true);
  });

  it("includes settlement rows tied to a promo award", () => {
    expect(
      isFreeBetHistoryEntry(row({ kind: "settlement", title: "Bet lost" }), ctx)
    ).toBe(true);
  });
});

describe("isFreeBetPlacedHistoryEntry", () => {
  const freeBet: BetRow = {
    id: 7,
    eventId: null,
    label: "£25 SNR",
    market: "match_odds",
    selection: "Arsenal",
    betType: "free_snr",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 25,
    backOdds: 5,
    layStake: 20,
    layOdds: 5.2,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: 18,
    actualProfit: null,
    notes: null,
    balanceLedgered: 1,
    balanceSettled: 0,
    createdAt: Date.now(),
    settledAt: null,
    offerId: null,
  };

  const ctx = buildHistoryContext([], [freeBet], {});

  it("detects free bet SNR placements", () => {
    expect(
      isFreeBetPlacedHistoryEntry(
        row({ kind: "bet_placed", title: "Bet placed", betId: 7 }),
        ctx
      )
    ).toBe(true);
  });

  it("upgrades legacy bet placed titles", () => {
    expect(
      historyEntryTitle(row({ kind: "bet_placed", title: "Bet placed", betId: 7 }), ctx)
    ).toBe("Free bet placed");
  });

  it("includes free bet placements in the free bets filter", () => {
    expect(
      isFreeBetHistoryEntry(
        row({ kind: "bet_placed", title: "Free bet placed", betId: 7 }),
        ctx
      )
    ).toBe(true);
  });
});

describe("formatHistoryTimeBadge", () => {
  const kickoffAt = new Date("2026-07-08T19:30:00");
  const event: EventRow = {
    id: 1,
    sport: "football",
    externalId: null,
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startTime: kickoffAt.getTime(),
    status: "finished",
    homeScore: 1,
    awayScore: 0,
    minute: 90,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: null,
    simScript: null,
    simStartedAt: null,
    createdAt: kickoffAt.getTime(),
  };

  const ctx = buildHistoryContext([event], [], {});

  it("shows kick-off clock time instead of 0'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T21:00:00"));

    const entry = row({
      kind: "kickoff",
      title: "Kick-off",
      eventId: 1,
      minute: 0,
      betId: undefined,
    });

    expect(historyUsesMinuteBadge(entry, ctx)).toBe(false);
    expect(formatHistoryTimeBadge(entry, ctx)).toBe("19:30");
    expect(historyOccurredAt(entry, ctx)).toBe(kickoffAt.getTime());

    vi.useRealTimers();
  });

  it("shows full-time clock time instead of 90'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T21:00:00"));

    const entry = row({
      kind: "full_time",
      title: "Full time",
      eventId: 1,
      minute: 90,
      betId: undefined,
    });

    expect(historyUsesMinuteBadge(entry, ctx)).toBe(false);
    expect(formatHistoryTimeBadge(entry, ctx)).toBe("21:00");
    expect(historyOccurredAt(entry, ctx)).toBe(kickoffAt.getTime() + 90 * 60 * 1000);

    vi.useRealTimers();
  });

  it("shows Yesterday on one line and time on the next", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T21:00:00"));

    const yesterdayKickoff = new Date("2026-07-07T21:45:00");
    const yesterdayEvent = { ...event, startTime: yesterdayKickoff.getTime() };
    const yesterdayCtx = buildHistoryContext([yesterdayEvent], [], {});

    const entry = row({
      kind: "kickoff",
      title: "Kick-off",
      eventId: 1,
      minute: 0,
      betId: undefined,
    });

    expect(formatHistoryTimeBadgeParts(entry, yesterdayCtx)).toEqual({
      primary: "Yesterday",
      secondary: "21:45",
    });
    expect(formatHistoryTimeBadge(entry, yesterdayCtx)).toBe("Yesterday, 21:45");

    vi.useRealTimers();
  });

  it("shows older dates on one line and time on the next", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T21:00:00"));

    const olderKickoff = new Date("2026-07-05T16:23:00");
    const olderEvent = { ...event, startTime: olderKickoff.getTime() };
    const olderCtx = buildHistoryContext([olderEvent], [], {});

    const entry = row({
      kind: "bet_placed",
      title: "Bet placed",
      betId: undefined,
      createdAt: olderKickoff.getTime(),
    });

    expect(formatHistoryTimeBadgeParts(entry, olderCtx)).toEqual({
      primary: "5 Jul",
      secondary: "16:23",
    });

    vi.useRealTimers();
  });

  it("still shows live minute badges for in-play goals", () => {
    const entry = row({
      kind: "goal",
      title: "Goal",
      eventId: 1,
      minute: 23,
      betId: undefined,
    });

    expect(historyUsesMinuteBadge(entry, ctx)).toBe(true);
    expect(formatHistoryTimeBadge(entry, ctx)).toBe("23'");
  });
});
