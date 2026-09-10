/**
 * Kick-off, goal, 2UP and full-time facts for the History feed.
 * Local SQLite and the hosted Neon desk both write from this list.
 */
import type { EventRow, HistoryRow } from "@/lib/db/schema";
import { formatEventTitle, formatRacingEventTitle } from "@/lib/events";
import { tapeGoals } from "@/lib/events/match-tape";
import {
  formatGoalHistoryCopy,
  inferScoringSide,
  parseGoalHistoryScoreline,
  previousScorelineFromDedupe,
} from "@/lib/history-goal-copy";
import { parseRaceResults } from "@/lib/racing";
import { eventResultPostedAt } from "@/lib/events/result-posted";
import { regulationEndMinute } from "@/lib/history-match-clock";
import { twoUpLeadMinute, twoUpOccurredAt } from "@/lib/history-twoup-moment";

export type EventHistoryWrite = "put" | "upsert";

export type EventHistoryFact = {
  dedupe: string;
  kind: "kickoff" | "goal" | "two_up" | "full_time";
  eventId: number;
  minute?: number | null;
  title: string;
  detail?: string | null;
  createdAt: number;
  write: EventHistoryWrite;
};

export type EventHistorySource = Pick<
  EventRow,
  | "id"
  | "sport"
  | "source"
  | "status"
  | "homeTeam"
  | "awayTeam"
  | "homeScore"
  | "awayScore"
  | "homeLed2"
  | "awayLed2"
  | "minute"
  | "goals"
  | "startTime"
  | "externalId"
  | "matchEnding"
  | "ftHomeScore"
  | "ftAwayScore"
  | "competition"
  | "resultPostedAt"
>;

function occurredAt(event: EventHistorySource, minute: number): number {
  return event.startTime + minute * 60 * 1000;
}

function fullTimeDedupe(event: EventHistorySource, clerkUserId?: string): string {
  if (event.sport === "horse_racing") {
    const base = event.externalId ? `ft:racing:${event.externalId}` : `ft:${event.id}`;
    return clerkUserId ? `${base}:${clerkUserId}` : base;
  }
  return clerkUserId ? `ft:${event.id}:${clerkUserId}` : `ft:${event.id}`;
}

export function scoreTickDedupe(
  eventId: number,
  home: number,
  away: number
): string {
  return `score:${eventId}:${home}-${away}`;
}

/**
 * Score-tick History keys now covered by the match tape.
 * Those nameless "Goal!" rows must go once a scorer exists for that scoreline.
 */
export function obsoleteScoreHistoryDedupes(
  event: Pick<EventHistorySource, "id" | "goals">
): string[] {
  const goals = tapeGoals(event.goals);
  let home = 0;
  let away = 0;
  const out: string[] = [];
  for (const goal of goals) {
    if (goal.side === "home") home += 1;
    else away += 1;
    out.push(scoreTickDedupe(event.id, home, away));
  }
  return out;
}

/**
 * `score:{id}:{h}-{a}` keys already named by a `goal:{id}:{n}` row in the feed.
 * Used when `events.goals` is briefly empty so a leftover tick is still hidden.
 */
export function scoreTicksCoveredByNamedGoalRows(
  rows: Array<Pick<HistoryRow, "kind" | "dedupe" | "eventId" | "detail">>
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (row.kind !== "goal" || row.eventId == null) continue;
    if (!row.dedupe.startsWith(`goal:${row.eventId}:`)) continue;
    const parsed = parseGoalHistoryScoreline(row.detail);
    if (!parsed) continue;
    out.push(scoreTickDedupe(row.eventId, parsed.homeScore, parsed.awayScore));
  }
  return out;
}

function namedTapeGoalCount(eventId: number, existingDedupes: string[]): number {
  const prefix = `goal:${eventId}:`;
  return existingDedupes.filter((dedupe) => dedupe.startsWith(prefix)).length;
}

/** Commentary rows for one event. Skip upcoming and simulations. */
export function eventHistoryFacts(
  event: EventHistorySource,
  now: number,
  options?: {
    existingDedupes?: string[];
    clerkUserId?: string;
  }
): EventHistoryFact[] {
  if (event.status === "upcoming") return [];
  if (event.source === "sim") return [];

  if (event.sport === "horse_racing") {
    const race = parseRaceResults(event.goals);
    if (event.status !== "finished" || !race) return [];
    const title = formatRacingEventTitle(event);
    return [
      {
        dedupe: fullTimeDedupe(event, options?.clerkUserId),
        kind: "full_time",
        eventId: event.id,
        title: "Result",
        detail: `${title} - won by ${race.winner}`,
        createdAt: event.startTime,
        write: "upsert",
      },
    ];
  }

  const facts: EventHistoryFact[] = [];
  const name = `${event.homeTeam} v ${event.awayTeam}`;

  facts.push({
    dedupe: `ko:${event.id}`,
    kind: "kickoff",
    eventId: event.id,
    minute: 0,
    title: "Kick-off",
    detail: name,
    createdAt: event.startTime,
    write: "put",
  });

  const goals = tapeGoals(event.goals);
  let home = 0;
  let away = 0;
  goals.forEach((goal, i) => {
    if (goal.side === "home") home += 1;
    else away += 1;
    const flags = [
      i === 0 && !goal.og ? "1st goalscorer" : null,
      goal.og ? "own goal" : null,
    ].filter(Boolean);
    const copy = formatGoalHistoryCopy({
      side: goal.side,
      player: goal.player,
      og: goal.og,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    });
    facts.push({
      dedupe: `goal:${event.id}:${i}`,
      kind: "goal",
      eventId: event.id,
      minute: goal.minute,
      title: copy.title,
      detail: `${flags.length ? flags.join(" · ") + " - " : ""}${event.homeTeam} ${home}-${away} ${event.awayTeam}`,
      createdAt: occurredAt(event, goal.minute),
      write: "upsert",
    });
  });

  const scoreTotal = event.homeScore + event.awayScore;
  const knownGoals = Math.max(
    goals.length,
    namedTapeGoalCount(event.id, options?.existingDedupes ?? [])
  );
  if (knownGoals < scoreTotal && scoreTotal > 0) {
    const side = inferScoringSide({
      knownHome: home,
      knownAway: away,
      currentHome: event.homeScore,
      currentAway: event.awayScore,
      previousScore: previousScorelineFromDedupe(
        options?.existingDedupes ?? [],
        event.id,
        event.homeScore,
        event.awayScore
      ),
    });
    const copy = formatGoalHistoryCopy({
      side,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    });
    const minute = event.minute || 0;
    facts.push({
      dedupe: scoreTickDedupe(event.id, event.homeScore, event.awayScore),
      kind: "goal",
      eventId: event.id,
      minute,
      title: copy.title,
      detail: `${event.homeTeam} ${event.homeScore}-${event.awayScore} ${event.awayTeam}`,
      createdAt: occurredAt(event, minute),
      write: "upsert",
    });
  }

  if (event.homeLed2) {
    const minute = twoUpLeadMinute(event.goals, "home");
    facts.push({
      dedupe: `2up:${event.id}:home`,
      kind: "two_up",
      eventId: event.id,
      minute: minute ?? event.minute,
      title: "2UP triggered",
      detail: `${event.homeTeam} went 2 goals ahead`,
      createdAt:
        minute != null
          ? twoUpOccurredAt(event.startTime, minute)
          : occurredAt(event, event.minute || 0),
      write: "upsert",
    });
  }
  if (event.awayLed2) {
    const minute = twoUpLeadMinute(event.goals, "away");
    facts.push({
      dedupe: `2up:${event.id}:away`,
      kind: "two_up",
      eventId: event.id,
      minute: minute ?? event.minute,
      title: "2UP triggered",
      detail: `${event.awayTeam} went 2 goals ahead`,
      createdAt:
        minute != null
          ? twoUpOccurredAt(event.startTime, minute)
          : occurredAt(event, event.minute || 0),
      write: "upsert",
    });
  }

  if (event.status === "finished") {
    const ending = event.matchEnding;
    const titleSuffix = ending === "aet" ? " (AET)" : ending === "pen" ? " (Pens)" : "";
    const hasFtScore = event.ftHomeScore != null && event.ftAwayScore != null;
    let scoreDetail: string;
    if (ending === "aet" && hasFtScore) {
      scoreDetail = `${event.homeTeam} ${event.homeScore}-${event.awayScore} ${event.awayTeam} (FT: ${event.ftHomeScore}-${event.ftAwayScore})`;
    } else if (ending === "pen" && hasFtScore) {
      scoreDetail = `${event.homeTeam} ${event.ftHomeScore}-${event.ftAwayScore} ${event.awayTeam} (Pens)`;
    } else {
      scoreDetail = `${event.homeTeam} ${event.homeScore}-${event.awayScore} ${event.awayTeam}`;
    }
    const posted =
      eventResultPostedAt({ ...event, status: "finished" }) ??
      occurredAt(event, regulationEndMinute(event.matchEnding));
    facts.push({
      dedupe: fullTimeDedupe(event, options?.clerkUserId),
      kind: "full_time",
      eventId: event.id,
      minute: regulationEndMinute(event.matchEnding),
      title: `Full time${titleSuffix}`,
      detail: scoreDetail || formatEventTitle(event),
      createdAt: posted,
      write: "upsert",
    });
  }

  return facts;
}
