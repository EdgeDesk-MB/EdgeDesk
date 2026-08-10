import { describe, expect, it, vi } from "vitest";
import {
  balanceAdjustmentAccountName,
  buildHistoryContext,
  formatAccaHistoryDetail,
  formatAccaPlacedTitle,
  formatAccaSettlementTitle,
  formatHistoryTimeBadge,
  formatHistoryTimeBadgeParts,
  historyEntrySubtitle,
  historyEntryTitle,
  historyEntryHref,
  isFreeBetWonHistoryEntry,
  historyKindLabel,
  historyOccurredAt,
  historyUsesMinuteBadge,
  isDeskCampaignLayHistoryEntry,
  isFreeBetHistoryEntry,
  isFreeBetPlacedHistoryEntry,
  isBoostHistoryEntry,
  matchesHistoryFilter,
  sortHistoryEntries,
} from "@/lib/history-display";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";

function row(partial: Partial<HistoryRow> & Pick<HistoryRow, "kind" | "title">): HistoryRow {
  return {
    id: 1,
    dedupe: `test:${partial.kind}:${partial.title}`,
    detail: null,
    note: null,
    amount: null,
    minute: null,
    eventId: null,
    betId: 42,
    createdAt: Date.now(),
    ...partial,
  };
}

describe("isDeskCampaignLayHistoryEntry", () => {
  const lay: BetRow = {
    id: 9,
    eventId: null,
    label: "Acca lay · Middlesbrough",
    market: "match_odds",
    selection: "Middlesbrough",
    betType: "lay_only",
    bookmaker: null,
    exchangeId: 1,
    backStake: 0,
    backOdds: 0,
    layStake: 20,
    layOdds: 1.81,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "lost",
    expectedProfit: null,
    actualProfit: -16.2,
    notes: "Acca desk: leg 1 of 3",
    balanceLedgered: 1,
    balanceSettled: 1,
    createdAt: 1,
    settledAt: 2,
    offerId: null,
    source: null,
    quickLogged: null,
    sport: null,
    purpose: null,
  };

  it("flags Acca desk lay settlements for History exclusion", () => {
    const ctx = buildHistoryContext([], [lay], {});
    expect(
      isDeskCampaignLayHistoryEntry(
        row({ kind: "settlement", title: "Bet lost", betId: 9, amount: -16.2 }),
        ctx
      )
    ).toBe(true);
    expect(
      isDeskCampaignLayHistoryEntry(
        row({ kind: "bet_placed", title: "Bet placed", betId: 9 }),
        ctx
      )
    ).toBe(true);
  });

  it("leaves ordinary bet settlements alone", () => {
    const ordinary: BetRow = { ...lay, id: 10, label: "Arsenal", betType: "qualifying" };
    const ctx = buildHistoryContext([], [ordinary], {});
    expect(
      isDeskCampaignLayHistoryEntry(
        row({ kind: "settlement", title: "Bet lost", betId: 10, amount: -10 }),
        ctx
      )
    ).toBe(false);
  });
});

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

  it("includes settlement rows with Free bet won/earned in the title", () => {
    expect(
      isFreeBetHistoryEntry(
        row({ kind: "settlement", title: "Bet lost · Free bet won!" }),
        ctx
      )
    ).toBe(true);
    expect(
      isFreeBetHistoryEntry(
        row({ kind: "settlement", title: "Bet lost · Free bet earned!" }),
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
    source: null,
    quickLogged: null,
    sport: null,
    purpose: null,
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
    ftHomeScore: null,
    ftAwayScore: null,
    matchEnding: null,
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
    expect(formatHistoryTimeBadgeParts(entry, ctx)).toEqual({
      primary: "Today",
      secondary: "19:30",
    });
    expect(formatHistoryTimeBadge(entry, ctx)).toBe("Today, 19:30");
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
    expect(formatHistoryTimeBadge(entry, ctx)).toBe("Today, 21:00");
    expect(historyOccurredAt(entry, ctx)).toBe(kickoffAt.getTime() + 90 * 60 * 1000);

    vi.useRealTimers();
  });

  it("shows Today on one line and time on the next", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T21:00:00"));

    const entry = row({
      kind: "bet_placed",
      title: "Bet placed",
      betId: undefined,
      createdAt: new Date("2026-07-08T08:56:00").getTime(),
    });

    expect(formatHistoryTimeBadgeParts(entry, ctx)).toEqual({
      primary: "Today",
      secondary: "08:56",
    });
    expect(formatHistoryTimeBadge(entry, ctx)).toBe("Today, 08:56");

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

describe("sortHistoryEntries", () => {
  const raceTime = new Date("2026-07-10T16:30:00").getTime();
  const event: EventRow = {
    id: 9,
    sport: "horse_racing",
    externalId: "york-1",
    competition: "York",
    homeTeam: "Race",
    awayTeam: "",
    startTime: raceTime,
    status: "finished",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: JSON.stringify({ winner: "Dark Moon Rising", places: [] }),
    ftHomeScore: null,
    ftAwayScore: null,
    matchEnding: null,
    simScript: null,
    simStartedAt: null,
    createdAt: raceTime,
  };
  const bet: BetRow = {
    id: 32,
    eventId: 9,
    label: "Kahin",
    market: "win",
    selection: "Kahin",
    betType: "qualifying",
    bookmaker: "Betfair Sportsbook",
    exchangeId: 1,
    backStake: 50,
    backOdds: 5,
    layStake: 40,
    layOdds: 5.2,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: "Bet £50 get £50 FB if 2nd, 3rd, 4th",
    triggerRule: null,
    status: "lost",
    expectedProfit: 0,
    actualProfit: -2.7,
    notes: null,
    balanceLedgered: 1,
    balanceSettled: 1,
    createdAt: raceTime,
    settledAt: raceTime + 60_000,
    offerId: null,
    source: null,
    quickLogged: null,
    sport: null,
    purpose: null,
  };
  const ctx = buildHistoryContext([event], [bet], {
    32: { amount: 50, reason: "Finished 2nd" },
  });

  it("orders settlement, then result, then bet placed when times match", () => {
    const placed = row({
      id: 1,
      kind: "bet_placed",
      title: "Bet placed",
      betId: 32,
      eventId: 9,
      createdAt: raceTime,
    });
    const result = row({
      id: 2,
      kind: "full_time",
      title: "Result",
      eventId: 9,
      betId: undefined,
      createdAt: raceTime,
    });
    const settlement = row({
      id: 3,
      kind: "settlement",
      title: "Bet lost · Free bet won!",
      betId: 32,
      eventId: 9,
      createdAt: raceTime,
      amount: -2.7,
    });

    const sorted = sortHistoryEntries([settlement, result, placed], ctx).map((e) => e.kind);
    expect(sorted).toEqual(["settlement", "full_time", "bet_placed"]);
  });

  it("keeps bet placed last when createdAt is after the race", () => {
    const lateBet: BetRow = { ...bet, createdAt: raceTime + 120_000 };
    const lateCtx = buildHistoryContext([event], [lateBet], {
      32: { amount: 50, reason: "Finished 2nd" },
    });
    const placed = row({
      id: 1,
      kind: "bet_placed",
      title: "Bet placed",
      betId: 32,
      eventId: 9,
      createdAt: raceTime + 120_000,
    });
    const result = row({
      id: 2,
      kind: "full_time",
      title: "Result",
      eventId: 9,
      createdAt: raceTime,
    });
    const settlement = row({
      id: 3,
      kind: "settlement",
      title: "Bet lost · Free bet won!",
      betId: 32,
      eventId: 9,
      createdAt: raceTime,
      amount: -2.7,
    });

    const sorted = sortHistoryEntries([placed, settlement, result], lateCtx).map((e) => e.kind);
    expect(sorted).toEqual(["settlement", "full_time", "bet_placed"]);
  });
});

describe("historyEntryHref", () => {
  const raceTime = new Date("2026-07-10T16:30:00").getTime();
  const event: EventRow = {
    id: 9,
    sport: "horse_racing",
    externalId: "york-1",
    competition: "York",
    homeTeam: "Race",
    awayTeam: "",
    startTime: raceTime,
    status: "finished",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: JSON.stringify({ winner: "Dark Moon Rising", places: [] }),
    ftHomeScore: null,
    ftAwayScore: null,
    matchEnding: null,
    simScript: null,
    simStartedAt: null,
    createdAt: raceTime,
  };
  const bet: BetRow = {
    id: 32,
    eventId: 9,
    label: "Kahin",
    market: "win",
    selection: "Kahin",
    betType: "qualifying",
    bookmaker: "Betfair Sportsbook",
    exchangeId: 1,
    backStake: 50,
    backOdds: 5,
    layStake: 40,
    layOdds: 5.2,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: "Bet £50 get £50 FB if 2nd, 3rd, 4th",
    triggerRule: null,
    status: "lost",
    expectedProfit: 0,
    actualProfit: -2.7,
    notes: null,
    balanceLedgered: 1,
    balanceSettled: 1,
    createdAt: raceTime,
    settledAt: raceTime + 60_000,
    offerId: null,
    source: null,
    quickLogged: null,
    sport: null,
    purpose: null,
  };
  const ctx = buildHistoryContext([event], [bet]);

  it("links bet rows to the tracker with highlight", () => {
    expect(
      historyEntryHref(row({ kind: "bet_placed", title: "Bet placed", betId: 32 }), ctx)
    ).toBe("/tracker?highlight=32");
    expect(
      historyEntryHref(row({ kind: "settlement", title: "Bet lost", betId: 32 }), ctx)
    ).toBe("/tracker?highlight=32");
  });

  it("links event-only moments to tracked events", () => {
    expect(
      historyEntryHref(
        row({ kind: "full_time", title: "Result", eventId: 9, betId: undefined }),
        ctx
      )
    ).toBe("/tracked-events");
    expect(
      historyEntryHref(
        row({ kind: "goal", title: "Goal", eventId: 9, betId: undefined, minute: 12 }),
        ctx
      )
    ).toBe("/tracked-events");
  });

  it("prefers tracker when an event moment is tied to a bet", () => {
    expect(
      historyEntryHref(row({ kind: "goal", title: "Goal", eventId: 9, betId: 32, minute: 12 }), ctx)
    ).toBe("/tracker?highlight=32");
  });

  it("links casino settlements to the Casino desk", () => {
    expect(
      historyEntryHref(
        row({
          kind: "casino_settlement",
          title: "Casino settled",
          betId: undefined,
          detail: "PricedUp · Spend £30",
          amount: 11.31,
        }),
        ctx
      )
    ).toBe("/casino");
  });
});

describe("casino history filter", () => {
  const ctx = buildHistoryContext([], [], {});
  const casino = row({
    kind: "casino_settlement",
    title: "Casino settled",
    betId: undefined,
    amount: 11.31,
  });

  it("labels and filters casino settlements", () => {
    expect(historyKindLabel("casino_settlement")).toBe("Casino");
    expect(matchesHistoryFilter(casino, "casino", ctx)).toBe(true);
    expect(matchesHistoryFilter(casino, "settlements", ctx)).toBe(true);
    expect(matchesHistoryFilter(casino, "bets", ctx)).toBe(false);
  });
});

describe("Acca History copy", () => {
  it("titles Acca settlements as Acca won/lost (earned vs won free-bet promo)", () => {
    expect(formatAccaSettlementTitle("lost")).toBe("Acca lost");
    expect(formatAccaSettlementTitle("won")).toBe("Acca won");
    expect(
      formatAccaSettlementTitle("lost", { amount: 10, reason: "Offer unlocked" }, "Free bet earned!")
    ).toBe("Acca lost · Free bet earned!");
    expect(
      formatAccaSettlementTitle("lost", { amount: 50, reason: "Finished 2nd" }, "Free bet won!")
    ).toBe("Acca lost · Free bet won!");
    expect(formatAccaPlacedTitle("qualifying")).toBe("Acca placed");
    expect(formatAccaPlacedTitle("free_snr")).toBe("Acca free bet placed");
  });

  it("uses fold + run label for the subtitle (not a leg list)", () => {
    expect(
      formatAccaHistoryDetail(
        { label: "Bet £20 (ACCA) get £10 free bet" },
        [
          { label: "Middlesbrough", result: "lost" },
          { label: "Cambridge United", result: "won" },
          { label: "Stockport County", result: "pending" },
        ]
      )
    ).toBe("Treble · Bet £20 (ACCA) get £10 free bet");
  });

  it("surfaces Acca detail as the History subtitle (not the bet label)", () => {
    const accaBet: BetRow = {
      id: 42,
      eventId: null,
      label: "Acca · Bet £20 (ACCA) get £10 free bet",
      market: "other",
      selection: "",
      betType: "qualifying",
      bookmaker: null,
      exchangeId: null,
      backStake: 20,
      backOdds: 10,
      layStake: 0,
      layOdds: 0,
      commission: 0,
      earlyPayout: 0,
      refundAmount: null,
      refundRetention: null,
      legs: null,
      triggerText: null,
      triggerRule: null,
      status: "lost",
      expectedProfit: null,
      actualProfit: -40.84,
      notes: "Acca desk run - hedged on the exchange",
      balanceLedgered: 1,
      balanceSettled: 1,
      createdAt: 1,
      settledAt: 2,
      offerId: null,
      quickLogged: null,
      source: null,
      sport: null,
      purpose: null,
    };
    const entry = row({
      kind: "settlement",
      title: "Acca lost · Free bet earned!",
      detail: "Treble · Bet £20 (ACCA) get £10 free bet",
      amount: -40.84,
    });
    expect(historyEntrySubtitle(entry, accaBet)).toBe(
      "Treble · Bet £20 (ACCA) get £10 free bet"
    );
    expect(isFreeBetWonHistoryEntry(entry)).toBe(true);
  });
});

describe("balance adjustment display", () => {
  it("strips the embedded GBP amount from the account subtitle", () => {
    const entry = row({
      kind: "balance_adjustment",
      title: "Balance correction",
      betId: undefined,
      detail: "BetMGM - +GBP 2.30",
      amount: 2.3,
    });
    expect(balanceAdjustmentAccountName(entry)).toBe("BetMGM");
    expect(historyEntrySubtitle(entry, undefined)).toBe("BetMGM");
  });
});

describe("boosts history filter (J2b)", () => {
  const boostBet: BetRow = {
    id: 77,
    eventId: null,
    label: "Boost play",
    market: "anytime_scorer",
    selection: "",
    betType: "boost",
    bookmaker: "Sky Bet",
    exchangeId: 1,
    backStake: 10,
    backOdds: 3,
    layStake: 9.5,
    layOdds: 2.9,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: 0.4,
    actualProfit: null,
    notes: null,
    balanceLedgered: 1,
    balanceSettled: 0,
    createdAt: Date.now(),
    settledAt: null,
    offerId: null,
    source: null,
    quickLogged: null,
    sport: null,
    purpose: null,
  };
  const ctx = buildHistoryContext([], [boostBet], {});
  const placed = row({
    kind: "bet_placed",
    title: "Bet placed",
    betId: 77,
  });

  it("filters boost bet placed/settled rows", () => {
    expect(isBoostHistoryEntry(placed, ctx)).toBe(true);
    expect(matchesHistoryFilter(placed, "boosts", ctx)).toBe(true);
    expect(matchesHistoryFilter(placed, "bets", ctx)).toBe(true);
    expect(matchesHistoryFilter(placed, "racing", ctx)).toBe(false);
  });
});
