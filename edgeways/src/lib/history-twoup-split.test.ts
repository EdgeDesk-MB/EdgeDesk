import { describe, expect, it } from "vitest";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import {
  expandTwoUpHistoryEntries,
  isChelseaLeedsFixture,
  shouldSplitTwoUpHistory,
  TWO_UP_SPLIT_FUTURE_FROM,
  twoUpSplitLegs,
} from "./history-twoup-split";

const KICKOFF = Date.parse("2026-09-09T20:00:00+01:00");

function event(partial: Partial<EventRow> = {}): EventRow {
  return {
    id: 21,
    sport: "football",
    externalId: "che-lee",
    competition: "League Cup",
    homeTeam: "Chelsea",
    awayTeam: "Leeds",
    startTime: KICKOFF,
    status: "finished",
    homeScore: 6,
    awayScore: 3,
    minute: 90,
    homeLed2: 1,
    awayLed2: 0,
    source: "api",
    goals: JSON.stringify([
      { kind: "goal", minute: 12, side: "home" },
      { kind: "goal", minute: 48, side: "home" },
      { kind: "goal", minute: 94, side: "home" },
    ]),
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
    createdAt: KICKOFF,
    ...partial,
  };
}

function bet(partial: Partial<BetRow> = {}): BetRow {
  return {
    id: 81,
    eventId: 21,
    label: "2UP Chelsea",
    market: "match_odds",
    selection: "home",
    betType: "qualifying",
    bookmaker: "Paddy Power",
    exchangeId: 1,
    backStake: 100,
    backOdds: 6,
    layStake: 90,
    layOdds: 5.5,
    commission: 0.02,
    earlyPayout: 1,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "early_payout",
    expectedProfit: 0,
    actualProfit: 588.2,
    notes: null,
    balanceLedgered: 1,
    balanceSettled: 1,
    createdAt: KICKOFF,
    settledAt: Date.parse("2026-09-10T08:04:00+01:00"),
    offerId: null,
    source: null,
    quickLogged: null,
    sport: "football",
    purpose: null,
    importFingerprint: null,
    importMeta: null,
    ...partial,
  };
}

describe("shouldSplitTwoUpHistory", () => {
  it("allows Chelsea v Leeds and kick-offs from 10 Sep 2026", () => {
    expect(isChelseaLeedsFixture({ homeTeam: "Chelsea", awayTeam: "Leeds United" })).toBe(
      true
    );
    expect(shouldSplitTwoUpHistory(event())).toBe(true);
    expect(
      shouldSplitTwoUpHistory(
        event({
          homeTeam: "Napoli",
          awayTeam: "Arsenal",
          startTime: TWO_UP_SPLIT_FUTURE_FROM - 1,
        })
      )
    ).toBe(false);
    expect(
      shouldSplitTwoUpHistory(
        event({
          homeTeam: "Napoli",
          awayTeam: "Arsenal",
          startTime: TWO_UP_SPLIT_FUTURE_FROM,
        })
      )
    ).toBe(true);
  });
});

describe("twoUpSplitLegs", () => {
  it("bookie is +£500 at 2-0 (48'), lay is −£405 at full time when Chelsea win", () => {
    // Back 100 @ 6.00 paid: 100 × (6 − 1) = +500
    // Chelsea win → lay loses: 90 × (5.5 − 1) = −405
    const legs = twoUpSplitLegs(bet({ status: "won" }), event())!;
    expect(legs.bookie).toMatchObject({
      title: "2UP paid early",
      amount: 500,
      minute: 48,
      at: KICKOFF + 48 * 60 * 1000,
    });
    expect(legs.lay).toMatchObject({
      title: "Lay lost",
      amount: -405,
      minute: 90,
      at: KICKOFF + 94 * 60 * 1000 + 1000,
    });
  });

  it("lay is +£88.20 when the selection fails to win after 2UP", () => {
    // Lay wins: 90 × (1 − 0.02) = 88.20
    const legs = twoUpSplitLegs(
      bet({ status: "early_payout" }),
      event({ homeScore: 2, awayScore: 2 })
    )!;
    expect(legs.bookie.amount).toBe(500);
    expect(legs.lay).toMatchObject({ title: "Lay won", amount: 88.2 });
  });
});

describe("expandTwoUpHistoryEntries", () => {
  it("splits the Chelsea combined row and leaves a Napoli loss alone", () => {
    const chelsea = event();
    const napoli = event({
      id: 22,
      homeTeam: "Napoli",
      awayTeam: "Arsenal",
      startTime: KICKOFF,
      homeLed2: 0,
    });
    const twoUp = bet();
    const napoliBet = bet({
      id: 82,
      eventId: 22,
      label: "Napoli",
      earlyPayout: 0,
      status: "lost",
      actualProfit: -2.59,
      layStake: 0,
      layOdds: 0,
    });
    const combined: HistoryRow = {
      id: 90,
      dedupe: `bet:81:${twoUp.settledAt}`,
      kind: "settlement",
      title: "2UP paid early",
      detail: "Chelsea v Leeds",
      note: null,
      amount: 588.2,
      minute: 94,
      eventId: 21,
      betId: 81,
      createdAt: twoUp.settledAt!,
    };
    const napoliRow: HistoryRow = {
      ...combined,
      id: 91,
      dedupe: "bet:82:x",
      title: "Bet lost",
      amount: -2.59,
      eventId: 22,
      betId: 82,
    };
    const expanded = expandTwoUpHistoryEntries(
      [combined, napoliRow],
      new Map([
        [81, twoUp],
        [82, napoliBet],
      ]),
      new Map([
        [21, chelsea],
        [22, napoli],
      ])
    );
    expect(expanded.map((row) => row.title)).toEqual([
      "2UP paid early",
      "Lay lost",
      "Bet lost",
    ]);
    expect(expanded[0]!.amount).toBe(500);
    expect(expanded[1]!.amount).toBe(-405);
    expect(expanded[2]!.amount).toBe(-2.59);
  });
});
