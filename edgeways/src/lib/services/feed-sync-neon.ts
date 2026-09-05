/**
 * Leased global feed poller for the hosted desk (EDGE-81b).
 *
 * WHY THIS EXISTS
 * `getAppState()` short-circuits to `buildNeonDeskAppState()` when the desk is
 * Neon, so the hosted desk never ran `refreshApiEvents()` /
 * `refreshRacingApiEvents()` / the settlement passes. Hosted customers saw no
 * live scores and event-linked bets never settled. This module is the hosted
 * equivalent, with two differences forced by the platform:
 *
 * 1. It is LEASED. Vercel runs many serverless instances and each hosted
 *    dashboard poll could otherwise trigger its own upstream fetch. The lease in
 *    `feed_sync_state` means one poller runs at a time, once per 20s, across the
 *    whole fleet (see `db/neon-feed-sync.ts` for the single atomic statement).
 * 2. It is a SYSTEM process. `events` is global feed data, so the poller settles
 *    EVERY user's open bets against current event state. One upstream call per
 *    event, not per user (EDGE-81d fan-out).
 *
 * COLD STARTS: polling is request-driven, so no traffic means no sync. That is
 * accepted — the next request catches up, and the football path still has the
 * one-shot result backfill for matches that slept through their live window.
 *
 * NOT PORTED (and why):
 * - The budget-exhaustion alert from `refreshApiEvents()`. It is a
 *   single-operator nudge rather than customer-facing. Hosted usage is still
 *   visible via `apiUsageTodayAsync`. (Customer-facing result_settled alerts
 *   ARE emitted here - EDGE-110 - via the per-user Neon inbox + push.)
 * - Free-bet lots and wagering on settlement. Cash stake/payout rows ledger
 *   on place and settle (including a placement heal for older un-ledgered
 *   bets). Lots/WR stay on the SQLite Core path.
 */
import "server-only";

import { settlementForBetOnEvent } from "@/lib/services/event-settlement";
import {
  footballEventPatch,
  racingResultPatch,
  selectFootballSyncEvents,
} from "@/lib/services/feed-sync-rules";
import {
  FEED_SYNC_KEY,
  type FeedSyncLease,
} from "@/lib/services/feed-sync-lease";
import {
  fixtureLineups as realFixtureLineups,
  fixtureMatchEvents as realFixtureMatchEvents,
  fixturesByIds as realFixturesByIds,
  hasApiKey as realHasApiKey,
} from "@/lib/services/apifootball";
import {
  hasRacingApiKey as realHasRacingApiKey,
  resultsForRaceIds as realResultsForRaceIds,
  RESULTS_TTL_ACTIVE,
} from "@/lib/services/theracingapi";
import {
  eventInRacingSyncWindow,
  eventNeedsRaceResult,
} from "@/lib/services/sync-racing-results";
import { shouldFetchGoalTimeline, shouldFetchLineups } from "@/lib/live-poll-rules";
import { formatEventTitle, formatRacingEventTitle, localCalendarDate } from "@/lib/events";
import { parseRaceResults } from "@/lib/racing";
import {
  isAccaDeskSettlement,
  settledResultAlert,
  type SettledBetNotice,
} from "@/lib/alerts/rules";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { NeonEventFeedPatch } from "@/lib/db/neon-events";
import type {
  NeonBetSettlement,
  OwnedBet,
  OwnedHistoryValues,
} from "@/lib/db/neon-feed-settlement";

export type NeonFeedSyncDeps = {
  listEvents: () => Promise<EventRow[]>;
  updateEvent: (
    id: number,
    patch: NeonEventFeedPatch
  ) => Promise<void | EventRow | null>;
  listOpenBetsForEvents: (eventIds: number[]) => Promise<OwnedBet[]>;
  settleBet: (settlement: NeonBetSettlement) => Promise<boolean>;
  insertHistory: (values: OwnedHistoryValues) => Promise<void>;
  fixturesByIds: typeof realFixturesByIds;
  fixtureMatchEvents: typeof realFixtureMatchEvents;
  fixtureLineups: typeof realFixtureLineups;
  resultsForRaceIds: typeof realResultsForRaceIds;
  hasApiKey: () => boolean;
  hasRacingApiKey: () => boolean;
  now: () => number;
  /**
   * EDGE-110: deliver a result_settled alert to one owner's Neon inbox and
   * push devices. Default respects the owner's alertsResultSettled pref.
   */
  notifySettlement: (clerkUserId: string, notice: SettledBetNotice) => Promise<void>;
  /** Cash wallet credits for a hosted bet that was ledgered at placement. */
  ledgerSettlement?: (bet: BetRow, clerkUserId: string) => Promise<void>;
};

export type NeonFeedSyncResult = {
  ran: boolean;
  footballUpdated: number;
  racingUpdated: number;
  betsSettled: number;
  /** Of `betsSettled`, how many were on events this run did not touch. */
  sweepSettled: number;
  /** Events whose feed data changed this run. */
  syncedEventIds: number[];
};

const EMPTY_RESULT: NeonFeedSyncResult = {
  ran: false,
  footballUpdated: 0,
  racingUpdated: 0,
  betsSettled: 0,
  sweepSettled: 0,
  syncedEventIds: [],
};

/** One result-backfill attempt per event per instance, as on local. */
const backfillAttempted = new Set<number>();

/**
 * Cap on settlements applied per run. A backlog — the first poll after a quiet
 * night, or an import of bets on already-finished events — drains over
 * successive lease windows rather than making one request do all the work.
 * Settled bets leave the open set, so the next run resumes where this one
 * stopped; nothing is starved because just-synced events settle first.
 */
const MAX_SETTLEMENTS_PER_RUN = 250;

/**
 * Default settlement notifier (EDGE-110): respect the owner's result_settled
 * pref, record to their Neon inbox (durable), then fan out push (best-effort).
 */
async function defaultNotifySettlement(
  clerkUserId: string,
  notice: SettledBetNotice
): Promise<void> {
  const [{ getNeonDeskSettingsForUser }, inbox, push] = await Promise.all([
    import("@/lib/db/neon-desk-settings"),
    import("@/lib/db/neon-alerts-inbox"),
    import("@/lib/services/push"),
  ]);
  const settings = await getNeonDeskSettingsForUser(clerkUserId);
  if (!settings.alertsResultSettled) return;
  if (isAccaDeskSettlement(notice)) return;
  const alert = settledResultAlert(notice);
  const recorded = await inbox.recordNeonAlertsForUser(clerkUserId, [alert]);
  if (recorded > 0) {
    await push.sendPushToUser(clerkUserId, alert).catch(() => {});
  }
}

async function defaultDeps(): Promise<NeonFeedSyncDeps> {
  const [{ listNeonEvents, updateNeonEvent }, settlement] = await Promise.all([
    import("@/lib/db/neon-events"),
    import("@/lib/db/neon-feed-settlement"),
  ]);
  return {
    listEvents: listNeonEvents,
    updateEvent: updateNeonEvent,
    listOpenBetsForEvents: settlement.listOpenNeonBetsForEvents,
    settleBet: settlement.settleNeonBet,
    insertHistory: settlement.insertNeonHistoryForOwner,
    fixturesByIds: realFixturesByIds,
    fixtureMatchEvents: realFixtureMatchEvents,
    fixtureLineups: realFixtureLineups,
    resultsForRaceIds: realResultsForRaceIds,
    hasApiKey: realHasApiKey,
    hasRacingApiKey: realHasRacingApiKey,
    now: Date.now,
    notifySettlement: defaultNotifySettlement,
    ledgerSettlement: async (bet, clerkUserId) => {
      const { ledgerNeonBetSettlement } = await import("@/lib/db/neon-desk-ledger");
      await ledgerNeonBetSettlement(bet, clerkUserId);
    },
  };
}

/** Football live scores for tracked hosted events. */
async function syncFootball(
  deps: NeonFeedSyncDeps,
  allEvents: EventRow[],
  _openBets: OwnedBet[]
): Promise<number[]> {
  if (!deps.hasApiKey()) return [];
  const now = deps.now();
  const { poll, backfill } = selectFootballSyncEvents(allEvents, now, backfillAttempted);
  for (const e of backfill) backfillAttempted.add(e.id);
  const candidates = [...poll, ...backfill];
  if (candidates.length === 0) return [];

  const touched: number[] = [];
  try {
    // One upstream lookup per external id, deduped inside fixturesByIds — the
    // number of users holding bets on the event is irrelevant.
    const fixtures = await deps.fixturesByIds(candidates.map((e) => e.externalId!));
    for (const event of candidates) {
      const fixture = fixtures.find((f) => f.externalId === event.externalId);
      if (!fixture) continue;

      let goals = event.goals;
      let tapeFetchedAt = event.tapeFetchedAt ?? null;
      if (shouldFetchGoalTimeline(event, fixture, now)) {
        try {
          goals = JSON.stringify(
            await deps.fixtureMatchEvents(event.externalId!, fixture.homeTeam)
          );
          tapeFetchedAt = now;
        } catch {
          // keep the previous timeline; the next poll retries
        }
      }

      let lineups = event.lineups ?? null;
      if (shouldFetchLineups(event, fixture, now)) {
        try {
          const xi = await deps.fixtureLineups(event.externalId!);
          if (xi) lineups = JSON.stringify(xi);
        } catch {
          // keep the previous XI
        }
      }

      const patch = footballEventPatch(event, fixture, goals, {
        lineups,
        tapeFetchedAt,
      });
      await deps.updateEvent(event.id, patch);
      // Keep the in-memory row current so the settlement pass below sees the
      // score and status this poll just wrote.
      Object.assign(event, patch);
      touched.push(event.id);
    }
  } catch {
    // API hiccups must never break the hosted dashboard.
  }
  return touched;
}

/** Race results for hosted events with open bets, or tracked API races. */
async function syncRacing(
  deps: NeonFeedSyncDeps,
  allEvents: EventRow[],
  openBets: OwnedBet[]
): Promise<number[]> {
  if (!deps.hasRacingApiKey()) return [];
  const now = deps.now();
  const openBetEventIds = new Set(
    openBets.map(({ bet }) => bet.eventId).filter((id): id is number => id != null)
  );

  // Union of the two local entry points: open-bet races (36h lookback) and
  // recently-started tracked races (6h lookback).
  const candidates = allEvents.filter((e) => {
    if (!eventNeedsRaceResult(e)) return false;
    const hasOpenBet = openBetEventIds.has(e.id);
    if (!hasOpenBet && e.source !== "api") return false;
    return eventInRacingSyncWindow(e, now, false, hasOpenBet);
  });
  if (candidates.length === 0) return [];

  const touched: number[] = [];
  try {
    const dateByRaceId: Record<string, string> = {};
    for (const event of candidates) {
      if (event.externalId) {
        dateByRaceId[event.externalId] = localCalendarDate(new Date(event.startTime));
      }
    }
    const { results, tierBlocked } = await deps.resultsForRaceIds(
      candidates.map((e) => e.externalId!),
      { maxStaleMs: RESULTS_TTL_ACTIVE, dateByRaceId }
    );
    if (tierBlocked) return [];

    for (const event of candidates) {
      const result = results.get(event.externalId!);
      if (!result) {
        if (event.startTime <= now && event.status === "upcoming") {
          await deps.updateEvent(event.id, { status: "live" });
          event.status = "live";
        }
        continue;
      }
      const patch = racingResultPatch(event, result);
      if (!patch) continue;
      await deps.updateEvent(event.id, patch);
      Object.assign(event, patch);
      touched.push(event.id);
    }
  } catch {
    // Results hiccups retry on the next lease window.
  }
  return touched;
}

/**
 * Settle every user's open bets against current event state, and narrate the
 * result into each owner's history feed.
 *
 * This deliberately does NOT gate on "was this event synced in this run", so it
 * matches local: `settleTriggers()` and `autoSettle()` both scan every open bet
 * each pass and join to the linked event, regardless of whether the feed just
 * refreshed it. Gating on the sync set stranded hosted bets whose event was
 * already final before the run — a late placement, an import, or a manually
 * entered result — because `isFootballLivePollCandidate` skips
 * `status === "finished"`, so such an event is never re-synced and its bets
 * never became eligible.
 *
 * The open-bet set is already in hand (one read covering every tracked event),
 * so the sweep costs no extra query. Bets on events this run touched settle
 * first, keeping live trigger latency intact while a backlog drains behind them.
 */
async function settleOpenBets(
  deps: NeonFeedSyncDeps,
  eventById: Map<number, EventRow>,
  openBets: OwnedBet[],
  syncedEventIds: number[]
): Promise<{ settled: number; sweepSettled: number }> {
  const synced = new Set(syncedEventIds);
  const fresh: OwnedBet[] = [];
  const backlog: OwnedBet[] = [];
  for (const owned of openBets) {
    if (owned.bet.eventId == null) continue;
    (synced.has(owned.bet.eventId) ? fresh : backlog).push(owned);
  }

  let settled = 0;
  let sweepSettled = 0;
  const narratedEvents = new Set<string>();

  // One pass per bet, so a bet cannot be settled twice in a run; `settleBet` is
  // additionally guarded on `status = 'open'` against overlapping pollers.
  for (const { bet, clerkUserId } of [...fresh, ...backlog]) {
    if (settled >= MAX_SETTLEMENTS_PER_RUN) break;
    const event = eventById.get(bet.eventId!);
    if (!event) continue;
    // Every exclusion (dutch triggers, Acca / Bet Builder desk lays, events not
    // yet decided) lives in here, so the sweep inherits them unchanged.
    const outcome = settlementForBetOnEvent(bet, event);
    if (!outcome) continue;

    const settledAt = deps.now();
    const applied = await deps.settleBet({
      id: bet.id,
      status: outcome.status,
      actualProfit: outcome.profit,
      settledAt,
      notes: outcome.notes,
    });
    if (!applied) continue;
    settled += 1;
    if (!synced.has(bet.eventId!)) sweepSettled += 1;
    if (clerkUserId) {
      await deps
        .ledgerSettlement?.(
          {
            ...bet,
            status: outcome.status,
            actualProfit: outcome.profit,
            settledAt,
            notes: outcome.notes,
          },
          clerkUserId
        )
        .catch(() => {});
    }
    if (!clerkUserId) continue;

    await deps
      .insertHistory({
        clerkUserId,
        dedupe: `bet:${bet.id}:${settledAt}`,
        kind: "settlement",
        betId: bet.id,
        eventId: bet.eventId,
        title: settlementTitle(outcome.status),
        detail: bet.label,
        amount:
          outcome.status === "void" || outcome.status === "push" ? null : outcome.profit,
        createdAt: settledAt,
      })
      .catch(() => {});

    // Full time / Result feed row, once per (event, owner).
    const narrationKey = `${bet.eventId}:${clerkUserId}`;
    if (event.status === "finished" && !narratedEvents.has(narrationKey)) {
      narratedEvents.add(narrationKey);
      await deps.insertHistory(fullTimeHistory(event, clerkUserId)).catch(() => {});
    }

    // EDGE-110: the owner's inbox + push devices. The poller is the only
    // place hosted settlements are detected, so this is the result_settled
    // source on hosted (local raises it from the dashboard poll instead).
    await deps
      .notifySettlement(clerkUserId, {
        betId: bet.id,
        label: bet.label,
        profit: outcome.profit,
        status: outcome.status,
        betType: bet.betType,
        offerTitle: null,
        bookmaker: bet.bookmaker,
        notes: bet.notes,
      })
      .catch(() => {});
  }
  return { settled, sweepSettled };
}

function settlementTitle(status: NeonBetSettlement["status"]): string {
  switch (status) {
    case "won":
      return "Bet won";
    case "lost":
      return "Bet lost";
    case "early_payout":
      return "2UP paid early";
    case "half_win":
      return "Bet half won";
    case "half_lose":
      return "Bet half lost";
    case "push":
      return "Bet push";
    default:
      return "Bet void";
  }
}

/** Mirrors the full_time rows written by `syncHistory` on local. */
function fullTimeHistory(event: EventRow, clerkUserId: string): OwnedHistoryValues {
  if (event.sport === "horse_racing") {
    const race = parseRaceResults(event.goals);
    return {
      clerkUserId,
      dedupe: event.externalId
        ? `ft:racing:${event.externalId}:${clerkUserId}`
        : `ft:${event.id}:${clerkUserId}`,
      kind: "full_time",
      eventId: event.id,
      title: "Result",
      detail: race
        ? `${formatRacingEventTitle(event)} - won by ${race.winner}`
        : formatRacingEventTitle(event),
      createdAt: event.startTime,
    };
  }
  const ending = event.matchEnding;
  const titleSuffix = ending === "aet" ? " (AET)" : ending === "pen" ? " (Pens)" : "";
  const hasFtScore = event.ftHomeScore != null && event.ftAwayScore != null;
  const detail =
    ending === "aet" && hasFtScore
      ? `${event.homeTeam} ${event.homeScore}-${event.awayScore} ${event.awayTeam} (FT: ${event.ftHomeScore}-${event.ftAwayScore})`
      : ending === "pen" && hasFtScore
        ? `${event.homeTeam} ${event.ftHomeScore}-${event.ftAwayScore} ${event.awayTeam} (Pens)`
        : `${event.homeTeam} ${event.homeScore}-${event.awayScore} ${event.awayTeam}`;
  return {
    clerkUserId,
    dedupe: `ft:${event.id}:${clerkUserId}`,
    kind: "full_time",
    eventId: event.id,
    minute: event.minute || 90,
    title: `Full time${titleSuffix}`,
    detail: detail || formatEventTitle(event),
    createdAt: event.startTime + (event.minute || 90) * 60 * 1000,
  };
}

/**
 * The sync body. Assumes the caller already holds the lease; call
 * `maybeRunNeonFeedSync` from request paths instead.
 */
export async function runNeonFeedSync(
  overrides: Partial<NeonFeedSyncDeps> = {}
): Promise<NeonFeedSyncResult> {
  const deps: NeonFeedSyncDeps = { ...(await defaultDeps()), ...overrides };
  const allEvents = await deps.listEvents();
  if (allEvents.length === 0) return { ...EMPTY_RESULT, ran: true };

  // One read of every user's open bets on tracked events, shared by the
  // timeline decision, the racing window and settlement. It spans all events,
  // not just this run's sync candidates, which is what lets the settlement pass
  // sweep bets on events that were already final.
  const openBets = await deps.listOpenBetsForEvents(allEvents.map((e) => e.id));

  const footballIds = await syncFootball(deps, allEvents, openBets);
  const racingIds = await syncRacing(deps, allEvents, openBets);
  const syncedEventIds = [...new Set([...footballIds, ...racingIds])];

  const eventById = new Map(allEvents.map((e) => [e.id, e]));
  const { settled, sweepSettled } = await settleOpenBets(
    deps,
    eventById,
    openBets,
    syncedEventIds
  );

  return {
    ran: true,
    footballUpdated: footballIds.length,
    racingUpdated: racingIds.length,
    betsSettled: settled,
    sweepSettled,
    syncedEventIds,
  };
}

/**
 * Try to take the lease and, if won, run the sync without blocking the
 * response. Called from every hosted dashboard poll: the lease check is one
 * cheap query, and 19 out of 20 seconds it does nothing.
 */
export async function maybeRunNeonFeedSync(options?: {
  lease?: FeedSyncLease;
  key?: string;
  deps?: Partial<NeonFeedSyncDeps>;
}): Promise<{ acquired: boolean }> {
  const key = options?.key ?? FEED_SYNC_KEY;
  let lease = options?.lease;
  if (!lease) {
    const { neonFeedSyncLease } = await import("@/lib/db/neon-feed-sync");
    lease = neonFeedSyncLease();
  }

  let acquired = false;
  try {
    acquired = await lease.acquire(key);
  } catch {
    // A missing feed_sync_state table (migration not applied yet) must not take
    // the hosted dashboard down.
    return { acquired: false };
  }
  if (!acquired) return { acquired: false };

  const work = async () => {
    try {
      await runNeonFeedSync(options?.deps);
    } catch {
      // Swallow: the next window retries.
    } finally {
      await lease!.release(key).catch(() => {});
    }
  };

  try {
    const { after } = await import("next/server");
    // Callback form: if `after` rejects the registration we have not started
    // the work yet, so the inline fallback cannot double-run it.
    after(work);
  } catch {
    // Outside a request context (scripts, tests) `after()` is unavailable —
    // run it inline; the 20s throttle keeps that bounded.
    await work();
  }
  return { acquired: true };
}
