/**
 * Hosted fixture writes. Events are a global feed, so these hit Neon rather
 * than the Mac SQLite file. Racing result sync stays with the leased poller.
 */
import "server-only";

import {
  parseRaceResults,
  serializeRacecardRunners,
  serializeRaceResults,
  withPreservedRaceDisplayMeta,
  type RaceDisplayMeta,
} from "@/lib/racing";
import {
  findNeonEventByExternalId,
  getNeonEvent,
  insertNeonEvent,
  listNeonEvents,
  updateNeonEvent,
  type NeonEventValues,
} from "@/lib/db/neon-events";
import type { GoalEvent } from "@/lib/calc";
import type { EventRow } from "@/lib/db/schema";
import { listNeonDeskBets, patchNeonDeskBet } from "@/lib/db/neon-desk";
import { purgeNeonDeskSettlementTransactionsForBet } from "@/lib/db/neon-desk-accounts";
import { purgeNeonDeskSettlementHistoryForBet } from "@/lib/db/neon-desk-history";
import { followNeonEvent } from "@/lib/db/neon-desk-tracked-events";

async function withFollow(event: EventRow): Promise<EventRow> {
  await followNeonEvent(event.id);
  return event;
}

export function raceMetaFromTrackInput(input: {
  raceMeta?: {
    type?: string;
    distance?: string;
    raceClass?: string;
    prize?: string;
    going?: string;
    fieldSize?: number;
  };
  runners?: string[];
}): RaceDisplayMeta | undefined {
  const meta = input.raceMeta;
  if (!meta && !input.runners?.length) return undefined;
  return {
    ...meta,
    fieldSize: meta?.fieldSize ?? input.runners?.length,
  };
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function eventTeamsMatch(a: string, b: string): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export async function createOrRefreshNeonEvent(input: {
  sport: string;
  competition?: string;
  homeTeam: string;
  awayTeam: string;
  startTime?: number;
  source: "api" | "manual" | "sim";
  externalId?: string;
  status?: EventRow["status"];
  runners?: string[];
  raceMeta?: RaceDisplayMeta;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
}): Promise<{ event: EventRow; existing: boolean }> {
  if (input.source === "sim") {
    throw new Error("Match simulation is no longer available.");
  }
  const now = Date.now();
  if (input.externalId) {
    const existing = await findNeonEventByExternalId(input.externalId);
    if (existing) {
      if (
        existing.sport === "horse_racing" &&
        !parseRaceResults(existing.goals) &&
        input.runners?.length
      ) {
        const refreshed = await updateNeonEvent(existing.id, {
          homeTeam: input.homeTeam,
          competition: input.competition ?? existing.competition,
          goals: serializeRacecardRunners(
            input.runners,
            raceMetaFromTrackInput(input)
          ),
        });
        return { event: await withFollow(refreshed ?? existing), existing: true };
      }
      if (
        existing.sport === "horse_racing" &&
        parseRaceResults(existing.goals) &&
        input.raceMeta
      ) {
        const result = parseRaceResults(existing.goals)!;
        const refreshed = await updateNeonEvent(existing.id, {
          goals: serializeRaceResults(
            withPreservedRaceDisplayMeta(
              { ...result, ...raceMetaFromTrackInput(input) },
              existing.goals
            )
          ),
        });
        return { event: await withFollow(refreshed ?? existing), existing: true };
      }
      return { event: await withFollow(existing), existing: true };
    }
  }

  const values: NeonEventValues = {
    sport: input.sport,
    competition: input.competition,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    startTime: input.startTime ?? now,
    source: input.source,
    externalId: input.externalId,
    status: input.status ?? "upcoming",
    homeScore: input.homeScore ?? 0,
    awayScore: input.awayScore ?? 0,
    minute: input.minute ?? 0,
    goals:
      input.sport === "horse_racing" && input.runners?.length
        ? serializeRacecardRunners(input.runners, raceMetaFromTrackInput(input))
        : null,
    simScript: null,
    simStartedAt: null,
    resultPostedAt: null,
    createdAt: now,
  };
  return { event: await withFollow(await insertNeonEvent(values)), existing: false };
}

export async function findOpenNeonEventByTeams(
  sport: string,
  homeTeam: string,
  awayTeam: string
): Promise<EventRow | undefined> {
  const events = await listNeonEvents();
  return events.find(
    (e) =>
      e.status !== "finished" &&
      (e.sport ?? "football") === sport &&
      eventTeamsMatch(e.homeTeam, homeTeam) &&
      eventTeamsMatch(e.awayTeam, awayTeam)
  );
}

export { getNeonEvent, insertNeonEvent, listNeonEvents, updateNeonEvent };

export type HostedEventPatch = {
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  status?: EventRow["status"];
  homeLed2?: boolean;
  awayLed2?: boolean;
  raceWinner?: string;
  raceRunners?: Array<{
    horse: string;
    position: number;
    spDecimal?: number;
    spLabel?: string;
    isSpFavourite?: boolean;
  }>;
  addGoal?: { side: "home" | "away"; player?: string; og?: boolean };
  correctResult?: {
    ftHomeScore: number;
    ftAwayScore: number;
    matchEnding: "ft" | "aet" | "pen";
    finalHomeScore?: number;
    finalAwayScore?: number;
    homeLed2?: boolean;
    awayLed2?: boolean;
  };
};

export async function patchHostedNeonEvent(
  id: number,
  p: HostedEventPatch
): Promise<{ event: EventRow; resetBets?: number } | null> {
  const existing = await getNeonEvent(id);
  if (!existing) return null;

  if (p.correctResult) {
    const { ftHomeScore, ftAwayScore, matchEnding } = p.correctResult;
    const finalHome = p.correctResult.finalHomeScore ?? ftHomeScore;
    const finalAway = p.correctResult.finalAwayScore ?? ftAwayScore;
    let timeline: GoalEvent[] = existing.goals ? JSON.parse(existing.goals) : [];
    const syncCorrectedTimeline = (side: "home" | "away", target: number) => {
      while (timeline.filter((g) => g.side === side).length > target) {
        const idx = timeline.map((g) => g.side).lastIndexOf(side);
        timeline = timeline.filter((_, i) => i !== idx);
      }
      while (timeline.filter((g) => g.side === side).length < target) {
        timeline = [...timeline, { minute: matchEnding === "ft" ? 90 : 120, side }];
      }
    };
    syncCorrectedTimeline("home", finalHome);
    syncCorrectedTimeline("away", finalAway);

    const updated = await updateNeonEvent(id, {
      matchEnding,
      ftHomeScore,
      ftAwayScore,
      homeScore: finalHome,
      awayScore: finalAway,
      minute: matchEnding === "ft" ? 90 : 120,
      status: "finished",
      goals: JSON.stringify(timeline),
      ...(p.correctResult.homeLed2 !== undefined
        ? { homeLed2: p.correctResult.homeLed2 ? 1 : 0 }
        : {}),
      ...(p.correctResult.awayLed2 !== undefined
        ? { awayLed2: p.correctResult.awayLed2 ? 1 : 0 }
        : {}),
    });

    const settledBets = (await listNeonDeskBets()).filter(
      (b) => b.eventId === id && b.status !== "open"
    );
    for (const bet of settledBets) {
      if (bet.balanceSettled === 1) {
        await purgeNeonDeskSettlementTransactionsForBet(bet.id);
      }
      await purgeNeonDeskSettlementHistoryForBet(bet.id);
      await patchNeonDeskBet(bet.id, {
        status: "open",
        settledAt: null,
        actualProfit: null,
        balanceSettled: 0,
      });
    }
    return { event: updated ?? existing, resetBets: settledBets.length };
  }

  if (existing.sport === "horse_racing" && p.raceWinner?.trim()) {
    const winner = p.raceWinner.trim();
    const runners = p.raceRunners?.length
      ? p.raceRunners
      : [{ horse: winner, position: 1 }];
    const goals = serializeRaceResults(
      withPreservedRaceDisplayMeta(
        { winner, runners, fieldSize: runners.length },
        existing.goals
      )
    );
    const updated = await updateNeonEvent(id, {
      status: p.status ?? "finished",
      goals,
      homeScore: 1,
      awayScore: 0,
    });
    return { event: updated ?? existing };
  }

  let goalEvents: GoalEvent[] = existing.goals ? JSON.parse(existing.goals) : [];
  let homeScore = p.homeScore ?? existing.homeScore;
  let awayScore = p.awayScore ?? existing.awayScore;
  let status = p.status ?? existing.status;

  if (p.addGoal) {
    goalEvents = [
      ...goalEvents,
      {
        minute: p.minute ?? existing.minute,
        side: p.addGoal.side,
        player: p.addGoal.player?.trim() || undefined,
        og: p.addGoal.og || undefined,
      },
    ];
    if (p.addGoal.side === "home") homeScore += 1;
    else awayScore += 1;
    if (status === "upcoming") status = "live";
  }

  const syncTimeline = (side: "home" | "away", target: number) => {
    while (goalEvents.filter((g) => g.side === side).length > target) {
      const idx = goalEvents.map((g) => g.side).lastIndexOf(side);
      goalEvents = goalEvents.filter((_, i) => i !== idx);
    }
    while (goalEvents.filter((g) => g.side === side).length < target) {
      goalEvents = [...goalEvents, { minute: p.minute ?? existing.minute, side }];
    }
  };
  syncTimeline("home", homeScore);
  syncTimeline("away", awayScore);

  const homeLed2 = p.homeLed2 ?? (existing.homeLed2 === 1 || homeScore - awayScore >= 2);
  const awayLed2 = p.awayLed2 ?? (existing.awayLed2 === 1 || awayScore - homeScore >= 2);

  const updated = await updateNeonEvent(id, {
    homeScore,
    awayScore,
    minute: p.minute ?? existing.minute,
    status,
    homeLed2: homeLed2 ? 1 : 0,
    awayLed2: awayLed2 ? 1 : 0,
    goals: JSON.stringify(goalEvents),
  });
  return { event: updated ?? existing };
}
