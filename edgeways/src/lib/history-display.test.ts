import { describe, expect, it, vi } from "vitest";
import {
  balanceAdjustmentAccountName,
  buildHistoryContext,
  formatAccaHistoryDetail,
  formatAccaPlacedTitle,
  formatAccaSettlementTitle,
  formatHistoryDateGroup,
  formatHistoryTimeBadge,
  formatHistoryTimeBadgeParts,
  groupHistoryFeedByDay,
  historyEntrySubtitle,
  historyEntryTitle,
  historyEntryTitleParts,
  historyGoalEventLabel,
  historyGoalScoreline,
  historyGoalScorelineSegments,
  historyGoalTwoUpTrigger,
  historyMatchMomentHeadline,
  historyMatchMomentSubline,
  historyRacingResultCopy,
  historyRacingResultHeadline,
  historySportMomentHeadline,
  isFootballMatchMoment,
  isRacingResultMoment,
  historyEntryHref,
  historyEntryLinkLabel,
  historyEntryFixtureLockup,
  historyEntryOpensMatchTape,
  historyFootballEventsForCrests,
  isFreeBetWonHistoryEntry,
  historyKindLabel,
  historyOccurredAt,
  historyUsesMinuteBadge,
  historyInPlayPlacementMinute,
  historyBetPlacedMatchMinute,
  isAbsorbedTwoUpHistoryEntry,
  isDeskCampaignLayHistoryEntry,
  isHiddenHistoryFeedEntry,
  isFreeBetHistoryEntry,
  isFreeBetPlacedHistoryEntry,
  isLockInPlacedHistoryEntry,
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
    importFingerprint: null,
    importMeta: null,
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
    importFingerprint: null,
    importMeta: null,
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

describe("historyEntryTitle for goals", () => {
  const event: EventRow = {
    id: 4,
    sport: "football",
    externalId: null,
    competition: "Champions League",
    homeTeam: "Paris Saint Germain",
    awayTeam: "Aston Villa",
    startTime: Date.now(),
    status: "live",
    homeScore: 2,
    awayScore: 1,
    minute: 66,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: JSON.stringify([{ minute: 21, side: "home", player: "K. Mbappé" }]),
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
    createdAt: Date.now(),
  };
  const ctx = buildHistoryContext([event], [], {});

  it("names the player when the timeline has a scorer", () => {
    const entry = row({
      kind: "goal",
      title: "K. Mbappé",
      eventId: 4,
      betId: undefined,
      minute: 21,
      dedupe: "goal:4:0",
      detail: "1st goalscorer - Paris Saint Germain 1-0 Aston Villa",
    });
    expect(historyEntryTitle(entry, ctx)).toBe("Goal: K. Mbappé!");
    expect(historyEntryTitleParts(entry, ctx)).toBeNull();
    expect(historyGoalScoreline(entry, ctx)?.scoringSide).toBe("home");
  });

  it("keeps Goal in the title when there is no scorer", () => {
    const noTimeline = buildHistoryContext([{ ...event, goals: null }], [], {});
    const opening = row({
      kind: "goal",
      title: "Goal",
      eventId: 4,
      betId: undefined,
      minute: 21,
      dedupe: "score:4:1-0",
      detail: "Paris Saint Germain 1-0 Aston Villa",
    });
    expect(historyEntryTitle(opening, noTimeline)).toBe("Goal!");
    expect(historyGoalScoreline(opening, noTimeline)?.scoringSide).toBe("home");
  });

  it("bolds the equaliser from the previous scoreline", () => {
    const g1 = row({
      id: 11,
      kind: "goal",
      title: "Goal",
      eventId: 4,
      betId: undefined,
      minute: 21,
      detail: "Paris Saint Germain 1-0 Aston Villa",
    });
    const g2 = row({
      id: 12,
      kind: "goal",
      title: "Goal",
      eventId: 4,
      betId: undefined,
      minute: 45,
      detail: "Paris Saint Germain 1-1 Aston Villa",
    });
    const sequenced = buildHistoryContext([{ ...event, goals: null }], [], {}, [], [g1, g2]);
    expect(historyEntryTitle(g2, sequenced)).toBe("Goal!");
    expect(historyGoalScoreline(g2, sequenced)?.scoringSide).toBe("away");
  });
});

describe("football match-moment feed copy", () => {
  const event: EventRow = {
    id: 8,
    sport: "football",
    externalId: null,
    competition: "Championship",
    homeTeam: "Wolves",
    awayTeam: "Blackburn",
    startTime: Date.now(),
    status: "finished",
    homeScore: 2,
    awayScore: 2,
    minute: 90,
    homeLed2: 0,
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
    createdAt: Date.now(),
  };

  it("puts the fixture on the top row for match-only updates", () => {
    const ctx = buildHistoryContext([event], [], {});
    const kickoff = row({
      kind: "kickoff",
      title: "Kick-off",
      eventId: 8,
      betId: undefined,
      detail: "Wolves v Blackburn",
    });
    const goal = row({
      kind: "goal",
      title: "Goal",
      eventId: 8,
      betId: undefined,
      minute: 90,
      detail: "Wolves 2-2 Blackburn",
    });
    const fullTime = row({
      kind: "full_time",
      title: "Full time",
      eventId: 8,
      betId: undefined,
      minute: 90,
      detail: "Wolves 2-2 Blackburn",
    });

    expect(isFootballMatchMoment(kickoff, ctx)).toBe(true);
    expect(historyMatchMomentHeadline(kickoff, ctx)).toBe("Wolves v Blackburn");
    expect(historyMatchMomentSubline(kickoff, ctx)).toBe("Kick-off");
    expect(historyMatchMomentHeadline(goal, ctx)).toBe("Wolves v Blackburn");
    expect(historyGoalEventLabel(goal, ctx)).toBe("Goal!");
    expect(historyMatchMomentHeadline(fullTime, ctx)).toBe("Wolves v Blackburn");
    expect(historyMatchMomentSubline(fullTime, ctx)).toBe("Full time · 2-2");
    expect(historyEntryOpensMatchTape(kickoff, ctx)?.id).toBe(8);
    expect(historyEntryLinkLabel(kickoff, ctx)).toBe(
      "Open match events for Wolves v Blackburn"
    );
    expect(historyEntryLinkLabel(fullTime, ctx)).toBe(
      "Open match events for Wolves v Blackburn"
    );
  });

  it("puts the crest lock-up on football Bet placed without opening the tape", () => {
    const ctx = buildHistoryContext([event], [], {});
    const placed = row({
      kind: "bet_placed",
      title: "Bet placed",
      eventId: 8,
      betId: undefined,
    });
    expect(historyEntryOpensMatchTape(placed, ctx)).toBeNull();
    expect(historyEntryFixtureLockup(placed, ctx)?.id).toBe(8);
    expect(historyFootballEventsForCrests([placed], ctx).map((event) => event.id)).toEqual([
      8,
    ]);
    expect(historyEntryLinkLabel(placed, ctx)).toBe("Open profit tracker");
  });

  it("skips the crest lock-up on racing Bet placed", () => {
    const race: EventRow = { ...event, id: 19, sport: "horse_racing", homeTeam: "1:15 Newbury" };
    const raceCtx = buildHistoryContext([race], [], {});
    const placed = row({
      kind: "bet_placed",
      title: "Bet placed",
      eventId: 19,
      betId: undefined,
    });
    expect(historyEntryFixtureLockup(placed, raceCtx)).toBeNull();
  });

  it("folds the 2UP trigger onto the goal that went two ahead", () => {
    const g1 = row({
      id: 31,
      kind: "goal",
      title: "Goal!",
      eventId: 8,
      betId: undefined,
      minute: 20,
      detail: "Wolves 1-0 Blackburn",
    });
    const g2 = row({
      id: 32,
      kind: "goal",
      title: "Goal!",
      eventId: 8,
      betId: undefined,
      minute: 38,
      detail: "Wolves 2-0 Blackburn",
    });
    const twoUp = row({
      id: 33,
      kind: "two_up",
      title: "2UP triggered",
      eventId: 8,
      betId: undefined,
      minute: 38,
      dedupe: "2up:8:home",
      detail: "Wolves went 2 goals ahead",
    });
    const ctx = buildHistoryContext([event], [], {}, [], [g1, g2, twoUp]);

    expect(historyGoalTwoUpTrigger(g1, ctx)).toBeNull();
    expect(historyGoalTwoUpTrigger(g2, ctx)).toEqual({
      side: "home",
      eventId: 8,
      team: "Wolves",
      backed: false,
    });
    expect(isAbsorbedTwoUpHistoryEntry(twoUp, ctx)).toBe(true);
    expect(isHiddenHistoryFeedEntry(twoUp, ctx)).toBe(true);
    expect(isHiddenHistoryFeedEntry(g2, ctx)).toBe(false);
    expect(historyEntryLinkLabel(g2, ctx)).toBe(
      "Open match events for Wolves v Blackburn"
    );
  });

  it("marks the 2UP goal as backed when that side has a desk back", () => {
    const g2 = row({
      id: 32,
      kind: "goal",
      title: "Goal!",
      eventId: 8,
      betId: undefined,
      minute: 38,
      detail: "Wolves 2-0 Blackburn",
    });
    const twoUp = row({
      id: 33,
      kind: "two_up",
      title: "2UP triggered",
      eventId: 8,
      betId: undefined,
      minute: 38,
      dedupe: "2up:8:home",
      detail: "Wolves went 2 goals ahead",
    });
    const homeBack: BetRow = {
      id: 70,
      eventId: 8,
      label: "Wolves",
      market: "match_odds",
      selection: "home",
      betType: "qualifying",
      bookmaker: "Bet365",
      exchangeId: 1,
      backStake: 10,
      backOdds: 2.1,
      layStake: 9.5,
      layOdds: 2.2,
      commission: 0.02,
      earlyPayout: 1,
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
      sport: "football",
      purpose: null,
      importFingerprint: null,
      importMeta: null,
    };
    const ctx = buildHistoryContext([event], [homeBack], {}, [], [g2, twoUp]);
    expect(historyGoalTwoUpTrigger(g2, ctx)?.backed).toBe(true);
  });

  it("dates 2UP paid early at the two-ahead kick, not the morning settle poll", () => {
    const kickoff = Date.parse("2026-09-09T19:00:00+01:00");
    const settlePoll = Date.parse("2026-09-10T08:04:00+01:00");
    const chelsea: EventRow = {
      ...event,
      id: 21,
      homeTeam: "Chelsea",
      awayTeam: "Leeds",
      startTime: kickoff,
      homeLed2: 1,
      awayLed2: 0,
      goals: JSON.stringify([
        { kind: "goal", minute: 12, side: "home" },
        { kind: "goal", minute: 38, side: "home" },
      ]),
    };
    const twoUpBet: BetRow = {
      id: 81,
      eventId: 21,
      label: "2UP Chelsea",
      market: "match_odds",
      selection: "home",
      betType: "qualifying",
      bookmaker: "Bet365",
      exchangeId: 1,
      backStake: 10,
      backOdds: 2.1,
      layStake: 9.5,
      layOdds: 2.2,
      commission: 0.02,
      earlyPayout: 1,
      refundAmount: null,
      refundRetention: null,
      legs: null,
      triggerText: null,
      triggerRule: null,
      status: "early_payout",
      expectedProfit: 0.4,
      actualProfit: 589.53,
      notes: null,
      balanceLedgered: 1,
      balanceSettled: 1,
      createdAt: kickoff,
      settledAt: settlePoll,
      offerId: null,
      source: null,
      quickLogged: null,
      sport: "football",
      purpose: null,
      importFingerprint: null,
      importMeta: null,
    };
    const paid = row({
      id: 90,
      kind: "settlement",
      title: "2UP paid early",
      eventId: 21,
      betId: 81,
      createdAt: settlePoll,
    });
    const ctx = buildHistoryContext([chelsea], [twoUpBet], {}, [], [paid]);
    expect(historyOccurredAt(paid, ctx)).toBe(kickoff + 38 * 60 * 1000);
    expect(historyOccurredAt(paid, ctx)).not.toBe(settlePoll);
  });

  it("keeps a 2UP row when no goal shows the two-ahead score", () => {
    const twoUp = row({
      id: 34,
      kind: "two_up",
      title: "2UP triggered",
      eventId: 8,
      betId: undefined,
      minute: 38,
      dedupe: "2up:8:home",
      detail: "Wolves went 2 goals ahead",
    });
    const ctx = buildHistoryContext([event], [], {}, [], [twoUp]);
    expect(isAbsorbedTwoUpHistoryEntry(twoUp, ctx)).toBe(false);
  });

  it("brackets the scoring side on a 1-1 equaliser", () => {
    const g1 = row({
      id: 21,
      kind: "goal",
      title: "Goal",
      eventId: 8,
      betId: undefined,
      minute: 20,
      detail: "Wolves 1-0 Blackburn",
    });
    const g2 = row({
      id: 22,
      kind: "goal",
      title: "Goal",
      eventId: 8,
      betId: undefined,
      minute: 28,
      detail: "Wolves 1-1 Blackburn",
    });
    const g3 = row({
      id: 23,
      kind: "goal",
      title: "Goal",
      eventId: 8,
      betId: undefined,
      minute: 50,
      detail: "Wolves 1-2 Blackburn",
    });
    const g4 = row({
      id: 24,
      kind: "goal",
      title: "Goal",
      eventId: 8,
      betId: undefined,
      minute: 90,
      detail: "Wolves 2-2 Blackburn",
    });
    const ctx = buildHistoryContext([event], [], {}, [], [g1, g2, g3, g4]);

    expect(historyGoalScorelineSegments(g1, ctx)).toEqual([
      { text: "Wolves " },
      { text: "[1]", emphasize: true },
      { text: " - 0 Blackburn" },
    ]);
    expect(historyGoalScorelineSegments(g2, ctx)).toEqual([
      { text: "Wolves 1 - " },
      { text: "[1]", emphasize: true },
      { text: " Blackburn" },
    ]);
    expect(historyGoalScorelineSegments(g4, ctx)).toEqual([
      { text: "Wolves " },
      { text: "[2]", emphasize: true },
      { text: " - 2 Blackburn" },
    ]);
    expect(historyGoalScorelineSegments(g4, ctx, { omitTeams: true })).toEqual([
      { text: "[2]", emphasize: true },
      { text: " - 2" },
    ]);
    expect(historyEntryLinkLabel(g4, ctx)).toBe(
      "Open match events for Wolves v Blackburn"
    );
  });

  it("puts the meeting on top for race-only results", () => {
    const race: EventRow = {
      ...event,
      id: 9,
      sport: "horse_racing",
      homeTeam: "Race",
      awayTeam: "",
      competition: "York",
      goals: JSON.stringify({
        kind: "horse_racing",
        winner: "Dark Moon Rising",
        fieldSize: 8,
        runners: [
          { horse: "Dark Moon Rising", position: 1 },
          { horse: "Kahin", position: 2 },
        ],
      }),
    };
    const ctx = buildHistoryContext([race], [], {});
    const result = row({
      kind: "full_time",
      title: "Result",
      eventId: 9,
      betId: undefined,
      detail: "York · 16:30 - won by Dark Moon Rising",
    });
    expect(isFootballMatchMoment(result, ctx)).toBe(false);
    expect(isRacingResultMoment(result, ctx)).toBe(true);
    expect(historyMatchMomentHeadline(result, ctx)).toBeNull();
    expect(historyRacingResultHeadline(result, ctx)).toBe("York");
    expect(historySportMomentHeadline(result, ctx)).toBe("York");
    expect(historyEntryTitle(result, ctx)).toBe("Result");
    expect(historyRacingResultCopy(result, ctx)).toEqual({
      label: "Result",
      parts: [
        { text: "[1st] Dark Moon Rising" },
        { text: " · " },
        { text: "[2nd] Kahin" },
      ],
    });
    expect(historyEntryLinkLabel(result, ctx)).toBe(
      "Open Result, York, [1st] Dark Moon Rising · [2nd] Kahin in tracked events"
    );
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
    period: null,
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
    simScript: null,
    simStartedAt: null,
    resultPostedAt: null,
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

  it("shows 120' for extra-time full time", () => {
    const aetCtx = buildHistoryContext([{ ...event, matchEnding: "aet" }], [], {});
    const entry = row({
      kind: "full_time",
      title: "Full time",
      eventId: 1,
      minute: 120,
      betId: undefined,
    });

    expect(historyUsesMinuteBadge(entry, aetCtx)).toBe(true);
    expect(formatHistoryTimeBadge(entry, aetCtx)).toBe("120'");
  });

  it("does not throw when the fixture is missing from context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T21:00:00"));

    const emptyCtx = buildHistoryContext([], [], {});
    const kinds = [
      "full_time",
      "goal",
      "kickoff",
      "two_up",
      "bet_placed",
      "settlement",
    ] as const;

    for (const kind of kinds) {
      const entry = row({
        kind,
        title: kind === "full_time" ? "Full time" : kind,
        eventId: 99,
        minute: kind === "goal" ? 23 : kind === "full_time" ? 90 : null,
        betId: undefined,
        createdAt: new Date("2026-07-08T20:10:00").getTime(),
      });

      expect(() => {
        historyUsesMinuteBadge(entry, emptyCtx);
        formatHistoryTimeBadgeParts(entry, emptyCtx);
        formatHistoryTimeBadge(entry, emptyCtx);
        historyOccurredAt(entry, emptyCtx);
        historyEntryTitle(entry, emptyCtx);
        historyEntryHref(entry, emptyCtx);
        historyEntryLinkLabel(entry, emptyCtx);
        historySportMomentHeadline(entry, emptyCtx);
        historyMatchMomentSubline(entry, emptyCtx);
        historyGoalScoreline(entry, emptyCtx);
        isFootballMatchMoment(entry, emptyCtx);
        historyEntryOpensMatchTape(entry, emptyCtx);
        historyEntryFixtureLockup(entry, emptyCtx);
        isHiddenHistoryFeedEntry(entry, emptyCtx);
        sortHistoryEntries([entry], emptyCtx);
      }).not.toThrow();
    }

    const orphanFt = row({
      kind: "full_time",
      title: "Full time",
      eventId: 99,
      minute: 90,
      betId: undefined,
      createdAt: new Date("2026-07-08T21:00:00").getTime(),
    });
    expect(historyUsesMinuteBadge(orphanFt, emptyCtx)).toBe(false);
    expect(formatHistoryTimeBadge(orphanFt, emptyCtx)).toBe("Today, 21:00");

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
    expect(formatHistoryTimeBadge(entry, ctx, { omitDay: true })).toBe("08:56");

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
    expect(formatHistoryTimeBadgeParts(entry, olderCtx, { omitDay: true })).toEqual({
      primary: "16:23",
    });

    vi.useRealTimers();
  });

  it("groups newest-first feed rows into Today then Yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T21:00:00"));

    const today = row({
      id: 2,
      kind: "bet_placed",
      title: "Bet placed",
      betId: undefined,
      createdAt: new Date("2026-07-08T11:53:00").getTime(),
    });
    const yesterday = row({
      id: 3,
      kind: "settlement",
      title: "Bet lost",
      betId: undefined,
      createdAt: new Date("2026-07-07T21:56:00").getTime(),
    });
    const emptyCtx = buildHistoryContext([], [], {});

    expect(formatHistoryTimeBadgeParts(today, emptyCtx, { omitDay: true })).toEqual({
      primary: "11:53",
    });
    expect(groupHistoryFeedByDay([today, yesterday], emptyCtx)).toEqual([
      { key: "2026-07-08", label: "Today", entries: [today] },
      { key: "2026-07-07", label: "Yesterday", entries: [yesterday] },
    ]);

    const older = row({
      id: 4,
      kind: "bet_placed",
      title: "Bet placed",
      betId: undefined,
      createdAt: new Date("2026-07-05T16:00:00").getTime(),
    });
    expect(formatHistoryDateGroup(older, emptyCtx)).toBe("Sunday 5th July");

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

  it("shows match minute for a lock-in placed in-play (KO 12:30, placed 12:52 → 22')", () => {
    const kickoff = new Date("2026-08-22T12:30:00").getTime();
    const placedAt = new Date("2026-08-22T12:52:00").getTime();
    const liveEvent: EventRow = {
      ...event,
      startTime: kickoff,
      status: "live",
      minute: 26,
    };
    const lockIn: BetRow = {
      id: 88,
      eventId: 1,
      label: "Lock-in lay · Convert FB · Dynobet",
      market: "match_odds",
      selection: "home",
      betType: "lay_only",
      bookmaker: null,
      exchangeId: 1,
      backStake: 0,
      backOdds: 0,
      layStake: 7.5,
      layOdds: 4,
      commission: 0,
      earlyPayout: 0,
      refundAmount: null,
      refundRetention: null,
      legs: null,
      triggerText: null,
      triggerRule: null,
      status: "open",
      expectedProfit: null,
      actualProfit: null,
      notes: 'Lock-in close of "Convert FB · Dynobet"',
      balanceLedgered: 0,
      balanceSettled: 0,
      createdAt: placedAt,
      settledAt: null,
      offerId: null,
      source: null,
      quickLogged: null,
      sport: "football",
      purpose: null,
      importFingerprint: null,
      importMeta: null,
    };
    const liveCtx = buildHistoryContext([liveEvent], [lockIn], {});
    const entry = row({
      kind: "bet_placed",
      title: "Bet placed",
      eventId: 1,
      betId: 88,
      createdAt: placedAt,
    });

    expect(historyInPlayPlacementMinute(placedAt, liveEvent)).toBe(22);
    expect(historyBetPlacedMatchMinute(entry, liveCtx)).toBe(22);
    expect(historyUsesMinuteBadge(entry, liveCtx)).toBe(true);
    expect(formatHistoryTimeBadge(entry, liveCtx)).toBe("22'");
    expect(isLockInPlacedHistoryEntry(entry, liveCtx)).toBe(true);
    expect(historyEntryTitle(entry, liveCtx)).toBe("Lock-in placed");
  });

  it("keeps pre-match placements on the clock", () => {
    const kickoff = new Date("2026-08-22T12:30:00").getTime();
    const placedAt = new Date("2026-08-22T08:01:00").getTime();
    const liveEvent: EventRow = { ...event, startTime: kickoff, status: "live", minute: 26 };
    const preCtx = buildHistoryContext([liveEvent], [], {});
    const entry = row({
      kind: "bet_placed",
      title: "Free bet placed",
      eventId: 1,
      betId: undefined,
      createdAt: placedAt,
    });

    expect(historyInPlayPlacementMinute(placedAt, liveEvent)).toBeNull();
    expect(historyUsesMinuteBadge(entry, preCtx)).toBe(false);
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
    period: null,
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
    simScript: null,
    simStartedAt: null,
    resultPostedAt: null,
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
    importFingerprint: null,
    importMeta: null,
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

  it("orders football rows by when they happened, not full-time for every settlement", () => {
    const kickoff = Date.parse("2026-09-09T20:00:00+01:00");
    const football: EventRow = {
      ...event,
      id: 21,
      sport: "football",
      homeTeam: "Chelsea",
      awayTeam: "Leeds",
      startTime: kickoff,
      status: "finished",
      homeScore: 6,
      awayScore: 3,
      minute: 90,
      homeLed2: 1,
      goals: JSON.stringify([
        { kind: "goal", minute: 12, side: "home" },
        { kind: "goal", minute: 48, side: "home" },
        { kind: "goal", minute: 94, side: "home" },
      ]),
    };
    const twoUpBet: BetRow = {
      ...bet,
      id: 81,
      eventId: 21,
      market: "match_odds",
      selection: "home",
      earlyPayout: 1,
      status: "early_payout",
      backStake: 100,
      backOdds: 6,
      layStake: 90,
      layOdds: 5.5,
      settledAt: Date.parse("2026-09-10T08:04:00+01:00"),
    };
    const footCtx = buildHistoryContext([football], [twoUpBet], {});
    const goalTwoNil = row({
      id: 1,
      kind: "goal",
      title: "Goal!",
      eventId: 21,
      betId: undefined,
      minute: 48,
      createdAt: kickoff + 48 * 60 * 1000,
      detail: "Chelsea 2-0 Leeds",
    });
    const paid = row({
      id: 2,
      kind: "settlement",
      title: "2UP paid early",
      eventId: 21,
      betId: 81,
      minute: 94,
      createdAt: twoUpBet.settledAt!,
      amount: 588.2,
    });
    const lateGoal = row({
      id: 3,
      kind: "goal",
      title: "Goal!",
      eventId: 21,
      betId: undefined,
      minute: 94,
      createdAt: kickoff + 94 * 60 * 1000,
      detail: "Chelsea 6-3 Leeds",
    });
    const fullTime = row({
      id: 4,
      kind: "full_time",
      title: "Full time",
      eventId: 21,
      betId: undefined,
      minute: 90,
      createdAt: kickoff + 90 * 60 * 1000,
      detail: "Chelsea 6-3 Leeds",
    });
    const sorted = sortHistoryEntries([paid, lateGoal, goalTwoNil, fullTime], footCtx);
    expect(sorted.map((e) => e.title)).toEqual([
      "Lay lost",
      "Full time",
      "Goal!",
      "2UP paid early",
      "Goal!",
    ]);
    expect(historyOccurredAt(sorted[0]!, footCtx)).toBe(kickoff + 94 * 60 * 1000 + 1000);
    expect(historyOccurredAt(sorted[1]!, footCtx)).toBe(kickoff + 94 * 60 * 1000 + 1000);
    expect(sorted[2]!.minute).toBe(94);
    expect(sorted[3]!.title).toBe("2UP paid early");
    expect(historyOccurredAt(sorted[3]!, footCtx)).toBe(kickoff + 48 * 60 * 1000);
  });

  it("puts the latest moment at the top", () => {
    const older = row({
      id: 10,
      kind: "settlement",
      title: "Older settlement",
      createdAt: raceTime - 2 * 24 * 60 * 60 * 1000,
      amount: -1.8,
    });
    const newer = row({
      id: 11,
      kind: "goal",
      title: "Goal!",
      eventId: 9,
      minute: 41,
      createdAt: raceTime + 41 * 60 * 1000,
    });
    const emptyCtx = buildHistoryContext([], [], {});
    expect(sortHistoryEntries([older, newer], emptyCtx).map((e) => e.id)).toEqual([
      11, 10,
    ]);
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
    period: null,
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
    simScript: null,
    simStartedAt: null,
    resultPostedAt: null,
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
    importFingerprint: null,
    importMeta: null,
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
      importFingerprint: null,
      importMeta: null,
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
    importFingerprint: null,
    importMeta: null,
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
