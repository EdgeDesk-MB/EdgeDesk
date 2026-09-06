import { describe, expect, it, vi } from "vitest";
import {
  maybeRunNeonFeedSync,
  runNeonFeedSync,
  type NeonFeedSyncDeps,
} from "@/lib/services/feed-sync-neon";
import { createInMemoryFeedSyncLease } from "@/lib/services/feed-sync-lease";
import type { Fixture } from "@/lib/services/apifootball";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type {
  NeonBetSettlement,
  OwnedBet,
  OwnedHistoryValues,
} from "@/lib/db/neon-feed-settlement";
import type { NeonEventFeedPatch } from "@/lib/db/neon-events";
import type { SettledBetNotice } from "@/lib/alerts/rules";
import { serializeRaceResults, type RaceResult } from "@/lib/racing";

const NOW = 1_800_000_000_000;

function event(partial: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    sport: "football",
    externalId: "ext-1",
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Liverpool",
    startTime: NOW - 95 * 60 * 1000,
    status: "live",
    homeScore: 0,
    awayScore: 0,
    minute: 88,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: null,
    ftHomeScore: null,
    ftAwayScore: null,
    matchEnding: null,
    period: "2H",
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
    simScript: null,
    simStartedAt: null,
    createdAt: NOW - 4 * 60 * 60 * 1000,
    ...partial,
  };
}

function bet(partial: Partial<BetRow> = {}): BetRow {
  return {
    id: 100,
    eventId: 1,
    label: "Arsenal to win",
    market: "match_odds",
    selection: "home",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 10,
    backOdds: 2.1,
    layStake: 9.9,
    layOdds: 2.12,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: -0.4,
    actualProfit: null,
    notes: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: NOW - 4 * 60 * 60 * 1000,
    settledAt: null,
    offerId: null,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: "football",
    importFingerprint: null,
    importMeta: null,
    ...partial,
  };
}

function fixture(partial: Partial<Fixture> = {}): Fixture {
  return {
    externalId: "ext-1",
    sport: "football",
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Liverpool",
    startTime: NOW - 95 * 60 * 1000,
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    minute: 90,
    matchEnding: "ft",
    period: null,
    ...partial,
  };
}

type Harness = {
  deps: Partial<NeonFeedSyncDeps>;
  updates: Array<{ id: number; patch: NeonEventFeedPatch }>;
  settlements: NeonBetSettlement[];
  history: OwnedHistoryValues[];
  notifications: Array<{ clerkUserId: string; notice: SettledBetNotice }>;
  fixturesByIds: ReturnType<typeof vi.fn>;
  fixtureMatchEvents: ReturnType<typeof vi.fn>;
  fixtureLineups: ReturnType<typeof vi.fn>;
  resultsForRaceIds: ReturnType<typeof vi.fn>;
};

function harness(options: {
  events: EventRow[];
  openBets: OwnedBet[];
  fixtures?: Fixture[];
  raceResults?: Map<string, RaceResult>;
  racingKey?: boolean;
}): Harness {
  const updates: Array<{ id: number; patch: NeonEventFeedPatch }> = [];
  const settlements: NeonBetSettlement[] = [];
  const history: OwnedHistoryValues[] = [];
  const notifications: Array<{ clerkUserId: string; notice: SettledBetNotice }> = [];
  const fixturesByIds = vi.fn(async () => options.fixtures ?? []);
  const fixtureMatchEvents = vi.fn(async () => [
    { kind: "goal" as const, minute: 10, side: "home" as const, player: "Saka" },
  ]);
  const fixtureLineups = vi.fn(async () => null);
  const resultsForRaceIds = vi.fn(async () => ({
    results: options.raceResults ?? new Map<string, RaceResult>(),
    tierBlocked: false,
    historicBlocked: false,
    tier: "basic" as const,
  }));

  return {
    updates,
    settlements,
    history,
    notifications,
    fixturesByIds,
    fixtureMatchEvents,
    fixtureLineups,
    resultsForRaceIds,
    deps: {
      listEvents: async () => options.events,
      updateEvent: async (id, patch) => {
        updates.push({ id, patch });
      },
      listOpenBetsForEvents: async () => options.openBets,
      settleBet: async (settlement) => {
        settlements.push(settlement);
        return true;
      },
      insertHistory: async (values) => {
        history.push(values);
      },
      fixturesByIds: fixturesByIds as unknown as NeonFeedSyncDeps["fixturesByIds"],
      fixtureMatchEvents:
        fixtureMatchEvents as unknown as NeonFeedSyncDeps["fixtureMatchEvents"],
      fixtureLineups:
        fixtureLineups as unknown as NeonFeedSyncDeps["fixtureLineups"],
      resultsForRaceIds:
        resultsForRaceIds as unknown as NeonFeedSyncDeps["resultsForRaceIds"],
      hasApiKey: () => true,
      hasRacingApiKey: () => options.racingKey ?? false,
      now: () => NOW,
      notifySettlement: async (clerkUserId, notice) => {
        notifications.push({ clerkUserId, notice });
      },
    },
  };
}

describe("runNeonFeedSync — football", () => {
  it("writes the fixture score onto the global Neon event", async () => {
    const h = harness({
      events: [event()],
      openBets: [],
      fixtures: [fixture()],
    });
    const result = await runNeonFeedSync(h.deps);

    expect(result.footballUpdated).toBe(1);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]!.patch).toMatchObject({
      status: "finished",
      homeScore: 2,
      awayScore: 1,
      minute: 90,
      homeLed2: 0,
      matchEnding: "ft",
    });
  });

  it("does nothing without an API key", async () => {
    const h = harness({ events: [event()], openBets: [], fixtures: [fixture()] });
    const result = await runNeonFeedSync({ ...h.deps, hasApiKey: () => false });
    expect(result.footballUpdated).toBe(0);
    expect(h.fixturesByIds).not.toHaveBeenCalled();
  });

  it("fetches the event tape for every live tracked match, not only scorers", async () => {
    const live = harness({
      events: [event()],
      openBets: [{ bet: bet(), clerkUserId: "user_a" }],
      fixtures: [fixture({ status: "live", homeScore: 1, awayScore: 0 })],
    });
    await runNeonFeedSync(live.deps);
    expect(live.fixtureMatchEvents).toHaveBeenCalledTimes(1);
    expect(live.updates[0]!.patch.goals).toContain("Saka");
  });

  it("fetches the event tape for a finished match that never stored one", async () => {
    const finished = harness({
      events: [
        event({
          status: "finished",
          startTime: NOW - 24 * 60 * 60 * 1000,
          homeScore: 1,
          awayScore: 1,
          minute: 90,
          goals: null,
        }),
      ],
      openBets: [],
      fixtures: [
        fixture({
          status: "finished",
          homeScore: 1,
          awayScore: 1,
          minute: 90,
        }),
      ],
    });
    await runNeonFeedSync(finished.deps);
    expect(finished.fixtureMatchEvents).toHaveBeenCalledTimes(1);
    expect(finished.updates[0]!.patch.goals).toContain("Saka");
  });
});

describe("runNeonFeedSync — settlement", () => {
  it("settles an event-linked hosted bet and narrates it into that owner's feed", async () => {
    const h = harness({
      events: [event()],
      openBets: [{ bet: bet(), clerkUserId: "user_a" }],
      fixtures: [fixture()],
    });
    const result = await runNeonFeedSync(h.deps);

    expect(result.betsSettled).toBe(1);
    expect(h.settlements).toHaveLength(1);
    expect(h.settlements[0]).toMatchObject({ id: 100, status: "won" });

    const settlementRow = h.history.find((row) => row.kind === "settlement")!;
    expect(settlementRow.clerkUserId).toBe("user_a");
    expect(settlementRow.dedupe).toBe(`bet:100:${NOW}`);
    expect(settlementRow.title).toBe("Bet won");
    expect(settlementRow.amount).toBe(h.settlements[0]!.actualProfit);

    const fullTime = h.history.find((row) => row.kind === "full_time")!;
    expect(fullTime.clerkUserId).toBe("user_a");
    expect(fullTime.detail).toBe("Arsenal 2-1 Liverpool");
  });

  it("emits a result_settled notification to the bet owner (EDGE-110)", async () => {
    const h = harness({
      events: [event()],
      openBets: [{ bet: bet(), clerkUserId: "user_a" }],
      fixtures: [fixture()],
    });
    await runNeonFeedSync(h.deps);

    expect(h.notifications).toHaveLength(1);
    expect(h.notifications[0]!.clerkUserId).toBe("user_a");
    expect(h.notifications[0]!.notice).toMatchObject({
      betId: 100,
      status: "won",
      profit: h.settlements[0]!.actualProfit,
    });
  });

  it("emits no notification for pre-cutover rows with no owner", async () => {
    const h = harness({
      events: [event()],
      openBets: [{ bet: bet(), clerkUserId: null }],
      fixtures: [fixture()],
    });
    await runNeonFeedSync(h.deps);
    expect(h.notifications).toEqual([]);
  });

  it("leaves open bets alone when the match is still live", async () => {
    const h = harness({
      events: [event()],
      openBets: [{ bet: bet(), clerkUserId: "user_a" }],
      fixtures: [fixture({ status: "live", homeScore: 1, awayScore: 0, matchEnding: null })],
    });
    const result = await runNeonFeedSync(h.deps);
    expect(result.footballUpdated).toBe(1);
    expect(result.betsSettled).toBe(0);
    expect(h.settlements).toEqual([]);
  });

  it("skips history for pre-cutover rows with no owner", async () => {
    const h = harness({
      events: [event()],
      openBets: [{ bet: bet(), clerkUserId: null }],
      fixtures: [fixture()],
    });
    const result = await runNeonFeedSync(h.deps);
    expect(result.betsSettled).toBe(1);
    expect(h.history).toEqual([]);
  });
});

describe("runNeonFeedSync — settlement sweep", () => {
  /** Finished before this run started: never a football poll candidate again. */
  const finishedEvent = event({
    id: 9,
    externalId: "ext-9",
    status: "finished",
    startTime: NOW - 5 * 60 * 60 * 1000,
    homeScore: 2,
    awayScore: 1,
    minute: 90,
    matchEnding: "ft",
  });

  it("settles a bet whose event was already finished before this run", async () => {
    const h = harness({
      events: [finishedEvent],
      openBets: [{ bet: bet({ id: 400, eventId: 9 }), clerkUserId: "user_a" }],
    });
    const out = await runNeonFeedSync(h.deps);

    // Nothing was synced — the event is past the live window and already final.
    expect(out.syncedEventIds).toEqual([]);
    expect(h.updates).toEqual([]);
    // …yet the bet still settles, via the sweep.
    expect(out.betsSettled).toBe(1);
    expect(out.sweepSettled).toBe(1);
    expect(h.settlements[0]).toMatchObject({ id: 400, status: "won" });
    expect(h.history.find((r) => r.kind === "settlement")?.clerkUserId).toBe("user_a");
  });

  it("settles a racing bet on a race whose result was already stored", async () => {
    const race: RaceResult = {
      kind: "horse_racing",
      winner: "Kauto Star",
      fieldSize: 3,
      runners: [
        { horse: "Kauto Star", position: 1 },
        { horse: "Denman", position: 2 },
        { horse: "Neptune Collonges", position: 3 },
      ],
    };
    const settledRace = event({
      id: 10,
      sport: "horse_racing",
      externalId: "rac-10",
      competition: "Cheltenham",
      homeTeam: "Cheltenham",
      awayTeam: "",
      status: "finished",
      startTime: NOW - 3 * 60 * 60 * 1000,
      minute: 0,
      period: null,
      goals: serializeRaceResults(race),
    });
    const h = harness({
      events: [settledRace],
      openBets: [
        {
          bet: bet({
            id: 500,
            eventId: 10,
            market: "win",
            selection: "Kauto Star",
            label: "Kauto Star",
            sport: "horse_racing",
            layStake: 0,
            layOdds: 0,
          }),
          clerkUserId: "user_a",
        },
      ],
      racingKey: true,
    });
    const out = await runNeonFeedSync(h.deps);

    expect(out.racingUpdated).toBe(0);
    expect(out.sweepSettled).toBe(1);
    expect(h.settlements[0]).toMatchObject({ id: 500, status: "won" });
  });

  it("does not double-settle a bet the per-event pass already handled", async () => {
    const h = harness({
      events: [event()],
      openBets: [{ bet: bet(), clerkUserId: "user_a" }],
      fixtures: [fixture()],
    });
    const out = await runNeonFeedSync(h.deps);

    // Synced this run, so it belongs to the per-event pass, not the sweep.
    expect(out.syncedEventIds).toEqual([1]);
    expect(out.betsSettled).toBe(1);
    expect(out.sweepSettled).toBe(0);
    expect(h.settlements).toHaveLength(1);
    expect(h.history.filter((r) => r.kind === "settlement")).toHaveLength(1);
    expect(h.history.filter((r) => r.kind === "full_time")).toHaveLength(1);
  });

  it("counts a bet once when the guarded write reports it already settled", async () => {
    const h = harness({
      events: [finishedEvent],
      openBets: [{ bet: bet({ id: 401, eventId: 9 }), clerkUserId: "user_a" }],
    });
    // Emulate another poller winning the race on this row.
    const out = await runNeonFeedSync({ ...h.deps, settleBet: async () => false });

    expect(out.betsSettled).toBe(0);
    expect(out.sweepSettled).toBe(0);
    expect(h.history).toEqual([]);
  });

  it("respects the same exclusions as the per-event pass", async () => {
    const dutchTrigger = bet({
      id: 402,
      eventId: 9,
      betType: "dutch",
      triggerRule: JSON.stringify({ kind: "team_scores_first", team: "home" }),
    });
    const accaLay = bet({
      id: 403,
      eventId: 9,
      betType: "lay_only",
      label: "Acca lay · Weekend",
    });
    const liveEvent = event({ id: 11, externalId: "ext-11", status: "live" });
    const onLiveEvent = bet({ id: 404, eventId: 11 });

    const h = harness({
      events: [finishedEvent, liveEvent],
      openBets: [
        { bet: dutchTrigger, clerkUserId: "user_a" },
        { bet: accaLay, clerkUserId: "user_a" },
        { bet: onLiveEvent, clerkUserId: "user_a" },
      ],
      // No fixture payload, so the live event is not advanced by this run.
      fixtures: [],
    });
    const out = await runNeonFeedSync(h.deps);

    expect(out.betsSettled).toBe(0);
    expect(h.settlements).toEqual([]);
  });

  it("prioritises just-synced events, then drains the backlog", async () => {
    // Lower ids sort first out of Neon, so without prioritisation the backlog
    // would push the live settlement behind it.
    const backlog = Array.from({ length: 3 }, (_, i) => ({
      bet: bet({ id: 10 + i, eventId: 9 }),
      clerkUserId: "user_a",
    }));
    const h = harness({
      events: [finishedEvent, event()],
      openBets: [...backlog, { bet: bet({ id: 900 }), clerkUserId: "user_b" }],
      fixtures: [fixture()],
    });
    const out = await runNeonFeedSync(h.deps);

    expect(out.betsSettled).toBe(4);
    expect(out.sweepSettled).toBe(3);
    expect(h.settlements.map((s) => s.id)).toEqual([900, 10, 11, 12]);
  });

  it("caps one run and leaves the rest for the next lease window", async () => {
    const many = Array.from({ length: 260 }, (_, i) => ({
      bet: bet({ id: 1000 + i, eventId: 9 }),
      clerkUserId: "user_a",
    }));
    const h = harness({ events: [finishedEvent], openBets: many });
    const out = await runNeonFeedSync(h.deps);

    expect(out.betsSettled).toBe(250);
    expect(h.settlements).toHaveLength(250);
  });
});

describe("runNeonFeedSync — fan-out (EDGE-81d)", () => {
  it("syncs a shared event once for two users, then settles both bets", async () => {
    const h = harness({
      events: [event()],
      openBets: [
        { bet: bet({ id: 100 }), clerkUserId: "user_a" },
        { bet: bet({ id: 200, label: "Arsenal (B)" }), clerkUserId: "user_b" },
      ],
      fixtures: [fixture()],
    });
    const result = await runNeonFeedSync(h.deps);

    // One upstream call, with one external id — not one per user.
    expect(h.fixturesByIds).toHaveBeenCalledTimes(1);
    expect(h.fixturesByIds.mock.calls[0]![0]).toEqual(["ext-1"]);
    // One event write, not one per user.
    expect(h.updates).toHaveLength(1);
    expect(result.syncedEventIds).toEqual([1]);

    expect(result.betsSettled).toBe(2);
    expect(h.settlements.map((s) => s.id)).toEqual([100, 200]);
    const owners = h.history
      .filter((row) => row.kind === "settlement")
      .map((row) => row.clerkUserId);
    expect(owners.sort()).toEqual(["user_a", "user_b"]);
  });
});

describe("runNeonFeedSync — racing", () => {
  const result: RaceResult = {
    kind: "horse_racing",
    winner: "Kauto Star",
    fieldSize: 3,
    runners: [
      { horse: "Kauto Star", position: 1 },
      { horse: "Denman", position: 2 },
      { horse: "Neptune Collonges", position: 3 },
    ],
  };

  const race = event({
    id: 5,
    sport: "horse_racing",
    externalId: "rac-5",
    competition: "Cheltenham",
    homeTeam: "Cheltenham",
    awayTeam: "",
    status: "upcoming",
    startTime: NOW - 10 * 60 * 1000,
    minute: 0,
    period: null,
  });

  it("writes the placings and settles the linked bet", async () => {
    const racingBet = bet({
      id: 300,
      eventId: 5,
      market: "win",
      selection: "Kauto Star",
      label: "Kauto Star",
      sport: "horse_racing",
      layStake: 0,
      layOdds: 0,
    });
    const h = harness({
      events: [race],
      openBets: [{ bet: racingBet, clerkUserId: "user_a" }],
      raceResults: new Map([["rac-5", result]]),
      racingKey: true,
    });

    const out = await runNeonFeedSync(h.deps);
    expect(out.racingUpdated).toBe(1);
    expect(h.updates[0]!.patch.status).toBe("finished");
    expect(h.updates[0]!.patch.goals).toBe(serializeRaceResults(result));
    expect(out.betsSettled).toBe(1);
    expect(h.settlements[0]).toMatchObject({ id: 300, status: "won" });
    expect(h.history.find((r) => r.kind === "full_time")?.detail).toContain(
      "won by Kauto Star"
    );
  });

  it("does nothing without racing credentials", async () => {
    const h = harness({
      events: [race],
      openBets: [],
      raceResults: new Map([["rac-5", result]]),
      racingKey: false,
    });
    const out = await runNeonFeedSync(h.deps);
    expect(out.racingUpdated).toBe(0);
    expect(h.resultsForRaceIds).not.toHaveBeenCalled();
  });
});

describe("maybeRunNeonFeedSync", () => {
  it("does no work when another instance holds the lease", async () => {
    const lease = createInMemoryFeedSyncLease();
    await lease.acquire("feed:live", NOW);

    const h = harness({ events: [event()], openBets: [], fixtures: [fixture()] });
    const outcome = await maybeRunNeonFeedSync({ lease, deps: h.deps });

    expect(outcome.acquired).toBe(false);
    expect(h.fixturesByIds).not.toHaveBeenCalled();
    expect(h.updates).toEqual([]);
  });

  it("reports no acquisition when the lease query fails (migration not applied)", async () => {
    const h = harness({ events: [event()], openBets: [], fixtures: [fixture()] });
    const outcome = await maybeRunNeonFeedSync({
      lease: {
        acquire: async () => {
          throw new Error('relation "feed_sync_state" does not exist');
        },
        release: async () => {},
      },
      deps: h.deps,
    });
    expect(outcome.acquired).toBe(false);
    expect(h.updates).toEqual([]);
  });
});
