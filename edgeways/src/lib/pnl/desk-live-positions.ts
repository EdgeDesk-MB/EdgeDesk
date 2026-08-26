/**
 * Home Live → Positions rows for in-play Acca / Bet Builder / Systems runs.
 * Acca desk backs and lays stay out of the per-bet live loop (they would
 * double-count). This emits one campaign row per run whose current pending
 * leg is live or off.
 */

import { accaSquareProvisional } from "@/lib/calc/acca-workflow";
import { effectiveEventStatus, formatEventTitle } from "@/lib/events";
import {
  progressFromAcca,
  progressFromBetBuilder,
  progressFromSystems,
} from "@/lib/offers/offer-desk-progress";
import { racingEventStatusDetail } from "@/lib/racing";
import type { LivePosition } from "@/lib/services/state.types";

export type DeskLiveKind = "acca" | "bet_builder" | "systems";

export type DeskLiveEvent = {
  id: number;
  sport?: string | null;
  status: string;
  source?: string | null;
  startTime?: number;
  homeTeam: string;
  awayTeam: string;
  competition?: string | null;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  goals?: string | null;
};

export type DeskLiveAcca = {
  id: number;
  label: string;
  status: string;
  method: string;
  offerId: number | null;
  noLay?: number | null;
  stake: number;
  commission: number;
  boostPct?: number | null;
  wholeLayStake: number | null;
  wholeLayOdds: number | null;
  backBetId: number | null;
  backBetType: string | null;
  legs: Array<{
    seq: number;
    label: string;
    result: "pending" | "won" | "lost" | "void";
    layStake: number | null;
    layOdds: number | null;
    backOdds: number;
    eventId: number | null;
    scheduledAt: number | null;
  }>;
};

export type DeskLiveBetBuilder = {
  id: number;
  label: string;
  status: string;
  method: "combined" | "no_lay";
  offerId: number | null;
  wholeLayStake: number | null;
  backBetId: number | null;
  eventId: number | null;
  scheduledAt: number | null;
  selectionCount: number;
};

export type DeskLiveSystem = {
  id: number;
  label: string;
  status: string;
  offerId: number | null;
  backBetId: number | null;
  legs: Array<{
    seq: number;
    label: string;
    result: "pending" | "won" | "placed" | "lost" | "void";
    eventId: number | null;
    scheduledAt: number | null;
  }>;
};

function progressOfferId(offerId: number | null): number {
  return offerId ?? 0;
}

function systemProgressResult(
  result: DeskLiveSystem["legs"][number]["result"]
): "pending" | "won" | "lost" | "void" {
  if (result === "placed") return "won";
  return result;
}

export function isDeskCampaignPosition(
  position: Pick<LivePosition, "kind">
): boolean {
  return position.kind === "acca" || position.kind === "bet_builder" || position.kind === "systems";
}

export function deskKindShortLabel(kind: DeskLiveKind): string {
  if (kind === "acca") return "Acca";
  if (kind === "bet_builder") return "Bet builder";
  return "Systems";
}

function deskLockId(kind: DeskLiveKind, runId: number, backBetId: number | null): number {
  if (backBetId != null) return backBetId;
  const base = kind === "acca" ? 1_000_000 : kind === "bet_builder" ? 2_000_000 : 3_000_000;
  return -(base + runId);
}

function isFocusLive(
  focus: { eventId: number | null; scheduledAt: number | null },
  eventsById: ReadonlyMap<number, DeskLiveEvent>,
  now: number
): boolean {
  if (focus.eventId != null) {
    const event = eventsById.get(focus.eventId);
    if (event) {
      const status = effectiveEventStatus(event, now);
      if (status === "live") return true;
      if (status === "finished") return false;
    }
  }
  if (focus.scheduledAt != null && focus.scheduledAt <= now) {
    const event = focus.eventId != null ? eventsById.get(focus.eventId) : undefined;
    return !event || event.status !== "finished";
  }
  return false;
}

function eventLine(
  event: DeskLiveEvent | undefined,
  fallback: string
): Pick<LivePosition, "eventName" | "eventSport" | "eventStatusLabel" | "minute" | "score"> {
  if (!event) {
    return {
      eventName: fallback,
      eventSport: undefined,
      eventStatusLabel: "In play",
      minute: 0,
      score: "In play",
    };
  }
  const racing = event.sport === "horse_racing";
  const eventStatusLabel = racing
    ? racingEventStatusDetail(event.goals)
    : `${event.homeScore ?? 0}-${event.awayScore ?? 0}`;
  return {
    eventName: formatEventTitle({
      sport: event.sport ?? undefined,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      competition: event.competition,
      startTime: event.startTime,
    }),
    eventSport: event.sport ?? undefined,
    eventStatusLabel,
    minute: event.minute ?? 0,
    score: eventStatusLabel,
  };
}

function positionBase(input: {
  kind: DeskLiveKind;
  href: LivePosition["href"];
  betId: number;
  eventId?: number;
  label: string;
  event: DeskLiveEvent | undefined;
  fallbackEventName: string;
  extraEventDetail?: string | null;
  triggerNote: string | null;
  provisional: number | null;
}): LivePosition {
  const line = eventLine(input.event, input.fallbackEventName);
  return {
    betId: input.betId,
    eventId: input.eventId,
    kind: input.kind,
    href: input.href,
    label: input.label,
    eventName: input.extraEventDetail
      ? `${line.eventName} · ${input.extraEventDetail}`
      : line.eventName,
    eventSport: line.eventSport,
    eventStatusLabel: line.eventStatusLabel,
    minute: line.minute,
    score: line.score,
    provisional: input.provisional,
    snapshotProvisional: input.provisional,
    valuationMode: "snapshot",
    expected: input.provisional,
    triggerNote: input.triggerNote,
  };
}

export function accaDeskLivePosition(
  run: DeskLiveAcca,
  eventsById: ReadonlyMap<number, DeskLiveEvent>,
  now: number
): LivePosition | null {
  if (run.status !== "active") return null;
  const focus = [...run.legs]
    .filter((l) => l.result === "pending")
    .sort((a, b) => a.seq - b.seq)[0];
  if (!focus || !isFocusLive(focus, eventsById, now)) return null;

  const progress = progressFromAcca({
    id: run.id,
    offerId: progressOfferId(run.offerId),
    status: run.status,
    method: run.method,
    noLay: run.noLay,
    wholeLayStake: run.wholeLayStake,
    legs: run.legs.map((l) => ({
      seq: l.seq,
      label: l.label,
      result: l.result,
      layStake: l.layStake,
    })),
  });
  const square = accaSquareProvisional(
    {
      stake: run.stake,
      commission: run.commission,
      method: run.method as "sequential" | "insurance_legs" | "insurance_whole" | "combined",
      wholeLayStake: run.wholeLayStake,
      wholeLayOdds: run.wholeLayOdds,
      boostPct: run.boostPct,
      backBetType: run.backBetType,
    },
    run.legs.map((l) => ({
      seq: l.seq,
      backOdds: l.backOdds,
      result: l.result,
      layStake: l.layStake,
      layOdds: l.layOdds,
    }))
  );

  const event = focus.eventId != null ? eventsById.get(focus.eventId) : undefined;
  return positionBase({
    kind: "acca",
    href: "/acca",
    betId: deskLockId("acca", run.id, run.backBetId),
    eventId: focus.eventId ?? undefined,
    label: `Acca · ${run.label}`,
    event,
    fallbackEventName: focus.label,
    extraEventDetail: progress?.progressCaption ?? null,
    triggerNote: progress?.needsAction ? progress.actionTitle : null,
    provisional: square?.value ?? null,
  });
}

export function betBuilderDeskLivePosition(
  run: DeskLiveBetBuilder,
  eventsById: ReadonlyMap<number, DeskLiveEvent>,
  now: number
): LivePosition | null {
  if (run.status !== "active") return null;
  if (!isFocusLive({ eventId: run.eventId, scheduledAt: run.scheduledAt }, eventsById, now)) {
    return null;
  }
  const progress = progressFromBetBuilder({
    id: run.id,
    offerId: progressOfferId(run.offerId),
    status: run.status,
    method: run.method,
    wholeLayStake: run.wholeLayStake,
    selectionCount: run.selectionCount,
  });
  const event = run.eventId != null ? eventsById.get(run.eventId) : undefined;
  return positionBase({
    kind: "bet_builder",
    href: "/bet-builder",
    betId: deskLockId("bet_builder", run.id, run.backBetId),
    eventId: run.eventId ?? undefined,
    label: `Bet builder · ${run.label}`,
    event,
    fallbackEventName: run.label,
    extraEventDetail: progress?.progressCaption ?? null,
    triggerNote: progress?.needsAction ? progress.actionTitle : null,
    provisional: null,
  });
}

export function systemDeskLivePosition(
  run: DeskLiveSystem,
  eventsById: ReadonlyMap<number, DeskLiveEvent>,
  now: number
): LivePosition | null {
  if (run.status !== "active") return null;
  const focus = [...run.legs]
    .filter((l) => l.result === "pending")
    .sort((a, b) => a.seq - b.seq)[0];
  if (!focus || !isFocusLive(focus, eventsById, now)) return null;
  const progress = progressFromSystems({
    id: run.id,
    offerId: progressOfferId(run.offerId),
    status: run.status,
    legs: run.legs.map((l) => ({
      seq: l.seq,
      label: l.label,
      result: systemProgressResult(l.result),
    })),
  });
  const event = focus.eventId != null ? eventsById.get(focus.eventId) : undefined;
  return positionBase({
    kind: "systems",
    href: "/systems",
    betId: deskLockId("systems", run.id, run.backBetId),
    eventId: focus.eventId ?? undefined,
    label: `Systems · ${run.label}`,
    event,
    fallbackEventName: focus.label,
    extraEventDetail: progress?.progressCaption ?? null,
    triggerNote: progress?.needsAction ? progress.actionTitle : null,
    provisional: null,
  });
}

export function buildDeskLivePositions(input: {
  now: number;
  eventsById: ReadonlyMap<number, DeskLiveEvent>;
  acca?: DeskLiveAcca[];
  betBuilder?: DeskLiveBetBuilder[];
  systems?: DeskLiveSystem[];
}): LivePosition[] {
  const rows: LivePosition[] = [];
  for (const run of input.acca ?? []) {
    const row = accaDeskLivePosition(run, input.eventsById, input.now);
    if (row) rows.push(row);
  }
  for (const run of input.betBuilder ?? []) {
    const row = betBuilderDeskLivePosition(run, input.eventsById, input.now);
    if (row) rows.push(row);
  }
  for (const run of input.systems ?? []) {
    const row = systemDeskLivePosition(run, input.eventsById, input.now);
    if (row) rows.push(row);
  }
  return rows;
}

/** Caption for Home Live → Events when a desk run is on that fixture. */
export function deskNotesForEvent(
  positions: Array<Pick<LivePosition, "eventId" | "kind" | "href" | "label" | "triggerNote">>,
  eventId: number
): { text: string; needsAction: boolean; href: string }[] {
  const notes: { text: string; needsAction: boolean; href: string }[] = [];
  for (const position of positions) {
    if (position.eventId !== eventId || !isDeskCampaignPosition(position)) continue;
    const kind = position.kind;
    if (kind !== "acca" && kind !== "bet_builder" && kind !== "systems") continue;
    const short = deskKindShortLabel(kind);
    notes.push({
      text: position.triggerNote ? `${short} · ${position.triggerNote}` : `${short} · In play`,
      needsAction: Boolean(position.triggerNote),
      href: position.href ?? `/${kind === "bet_builder" ? "bet-builder" : kind}`,
    });
  }
  return notes;
}

export function deskLiveEventIds(
  positions: Array<Pick<LivePosition, "eventId" | "kind">>
): Set<number> {
  const ids = new Set<number>();
  for (const position of positions) {
    if (!isDeskCampaignPosition(position) || position.eventId == null) continue;
    ids.add(position.eventId);
  }
  return ids;
}
