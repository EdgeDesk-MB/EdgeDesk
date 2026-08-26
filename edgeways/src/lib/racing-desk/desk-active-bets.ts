/**
 * Racing Desk Active bets + racecard Backed marks for Acca / Bet Builder /
 * Systems. Desk backs and lays stay out of the per-bet strip (lays render as
 * £0.00 @ 0). One campaign card per run that still has a horse-racing leg.
 */

import { isAccaDeskBack, isAccaDeskLay } from "@/lib/bets/acca-desk-bets";
import { isBetBuilderDeskBack, isBetBuilderDeskLay } from "@/lib/bets/bet-builder-desk-bets";
import { isSystemsDeskBack } from "@/lib/bets/systems-desk-bets";
import { accaSquareProvisional } from "@/lib/calc/acca-workflow";
import {
  progressFromAcca,
  progressFromBetBuilder,
  progressFromSystems,
} from "@/lib/offers/offer-desk-progress";
import type { RacingDeskActiveBet } from "@/lib/racing-desk/types";

export type RacingDeskBetKind = "acca" | "bet_builder" | "systems";

export type RacingDeskEventRef = {
  id: number;
  sport?: string | null;
  competition?: string | null;
  startTime?: number;
  externalId?: string | null;
};

export type RacingDeskAcca = {
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
  bookmaker: string | null;
  backStake: number;
  backOdds: number;
  legs: Array<{
    seq: number;
    label: string;
    selection: string | null;
    result: "pending" | "won" | "lost" | "void";
    layStake: number | null;
    layOdds: number | null;
    backOdds: number;
    eventId: number | null;
  }>;
};

export type RacingDeskBetBuilder = {
  id: number;
  label: string;
  status: string;
  method: "combined" | "no_lay";
  offerId: number | null;
  wholeLayStake: number | null;
  backBetId: number | null;
  bookmaker: string | null;
  backStake: number;
  backOdds: number;
  eventId: number | null;
  selectionCount: number;
  selections: Array<{ label: string; selection: string | null }>;
};

export type RacingDeskSystem = {
  id: number;
  label: string;
  status: string;
  offerId: number | null;
  backBetId: number | null;
  bookmaker: string | null;
  backStake: number;
  backOdds: number;
  legs: Array<{
    seq: number;
    label: string;
    selection: string | null;
    result: "pending" | "won" | "placed" | "lost" | "void";
    eventId: number | null;
  }>;
};

export type DeskRunnerMark = {
  selection: string;
  status: "open" | "won";
};

function progressOfferId(offerId: number | null): number {
  return offerId ?? 0;
}

function isHorseRacing(event: RacingDeskEventRef | undefined): boolean {
  return event?.sport === "horse_racing";
}

function horseName(leg: { selection: string | null; label: string }): string {
  return (leg.selection?.trim() || leg.label).trim();
}

function deskLockId(kind: RacingDeskBetKind, runId: number, backBetId: number | null): number {
  if (backBetId != null) return backBetId;
  const base = kind === "acca" ? 1_000_000 : kind === "bet_builder" ? 2_000_000 : 3_000_000;
  return -(base + runId);
}

export function isRacingDeskHiddenBet(
  bet: Pick<{ label: string; notes: string | null; betType: string }, "label" | "notes" | "betType">
): boolean {
  return (
    isAccaDeskLay(bet) ||
    isAccaDeskBack(bet) ||
    isBetBuilderDeskLay(bet) ||
    isBetBuilderDeskBack(bet) ||
    isSystemsDeskBack(bet)
  );
}

function firstRacingFocus<T extends { seq: number; result: string; eventId: number | null }>(
  legs: T[],
  eventsById: ReadonlyMap<number, RacingDeskEventRef>
): T | null {
  const racing = [...legs]
    .sort((a, b) => a.seq - b.seq)
    .filter((leg) => {
      if (leg.eventId == null) return false;
      return isHorseRacing(eventsById.get(leg.eventId));
    });
  return racing.find((leg) => leg.result === "pending") ?? racing[0] ?? null;
}

function campaignBase(input: {
  kind: RacingDeskBetKind;
  href: "/acca" | "/bet-builder" | "/systems";
  betId: number;
  event: RacingDeskEventRef;
  label: string;
  selection: string;
  bookmaker: string | null;
  backStake: number;
  backOdds: number;
  expectedProfit: number | null;
  outcomeKind: RacingDeskActiveBet["outcomeKind"];
  triggerNote: string | null;
  progressCaption: string | null;
}): RacingDeskActiveBet {
  return {
    betId: input.betId,
    eventId: input.event.id,
    raceExternalId: input.event.externalId ?? null,
    kind: input.kind,
    href: input.href,
    label: input.label,
    selection: input.selection,
    market: input.kind,
    bookmaker: input.bookmaker,
    backStake: input.backStake,
    backOdds: input.backOdds,
    expectedProfit: input.expectedProfit,
    outcomeKind: input.outcomeKind,
    course: input.event.competition ?? null,
    offTime: null,
    startTime: input.event.startTime ?? null,
    triggerNote: input.triggerNote,
    progressCaption: input.progressCaption,
  };
}

export function accaRacingDeskBet(
  run: RacingDeskAcca,
  eventsById: ReadonlyMap<number, RacingDeskEventRef>
): RacingDeskActiveBet | null {
  if (run.status !== "active") return null;
  const focus = firstRacingFocus(run.legs, eventsById);
  if (!focus || focus.eventId == null) return null;
  const event = eventsById.get(focus.eventId);
  if (!event || !isHorseRacing(event)) return null;

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

  return campaignBase({
    kind: "acca",
    href: "/acca",
    betId: deskLockId("acca", run.id, run.backBetId),
    event,
    label: run.label,
    selection: horseName(focus),
    bookmaker: run.bookmaker,
    backStake: run.backStake > 0 ? run.backStake : run.stake,
    backOdds: run.backOdds > 1 ? run.backOdds : run.legs.reduce((a, l) => a * l.backOdds, 1),
    expectedProfit: square?.value ?? null,
    outcomeKind: square?.kind === "locked" ? "locked" : square ? "worst" : "estimate",
    triggerNote: progress?.needsAction ? progress.actionTitle : null,
    progressCaption: progress?.progressCaption ?? null,
  });
}

export function betBuilderRacingDeskBet(
  run: RacingDeskBetBuilder,
  eventsById: ReadonlyMap<number, RacingDeskEventRef>
): RacingDeskActiveBet | null {
  if (run.status !== "active" || run.eventId == null) return null;
  const event = eventsById.get(run.eventId);
  if (!event || !isHorseRacing(event)) return null;
  const progress = progressFromBetBuilder({
    id: run.id,
    offerId: progressOfferId(run.offerId),
    status: run.status,
    method: run.method,
    wholeLayStake: run.wholeLayStake,
    selectionCount: run.selectionCount,
  });
  return campaignBase({
    kind: "bet_builder",
    href: "/bet-builder",
    betId: deskLockId("bet_builder", run.id, run.backBetId),
    event,
    label: run.label,
    selection: run.selections[0] ? horseName(run.selections[0]) : run.label,
    bookmaker: run.bookmaker,
    backStake: run.backStake,
    backOdds: run.backOdds,
    expectedProfit: null,
    outcomeKind: "estimate",
    triggerNote: progress?.needsAction ? progress.actionTitle : null,
    progressCaption: progress?.progressCaption ?? null,
  });
}

export function systemRacingDeskBet(
  run: RacingDeskSystem,
  eventsById: ReadonlyMap<number, RacingDeskEventRef>
): RacingDeskActiveBet | null {
  if (run.status !== "active") return null;
  const focus = firstRacingFocus(run.legs, eventsById);
  if (!focus || focus.eventId == null) return null;
  const event = eventsById.get(focus.eventId);
  if (!event || !isHorseRacing(event)) return null;
  const progress = progressFromSystems({
    id: run.id,
    offerId: progressOfferId(run.offerId),
    status: run.status,
    legs: run.legs.map((l) => ({
      seq: l.seq,
      label: l.label,
      result: l.result === "placed" ? "won" : l.result,
    })),
  });
  return campaignBase({
    kind: "systems",
    href: "/systems",
    betId: deskLockId("systems", run.id, run.backBetId),
    event,
    label: run.label,
    selection: horseName(focus),
    bookmaker: run.bookmaker,
    backStake: run.backStake,
    backOdds: run.backOdds,
    expectedProfit: null,
    outcomeKind: "estimate",
    triggerNote: progress?.needsAction ? progress.actionTitle : null,
    progressCaption: progress?.progressCaption ?? null,
  });
}

export function buildRacingDeskCampaignBets(input: {
  eventsById: ReadonlyMap<number, RacingDeskEventRef>;
  acca?: RacingDeskAcca[];
  betBuilder?: RacingDeskBetBuilder[];
  systems?: RacingDeskSystem[];
}): RacingDeskActiveBet[] {
  const rows: RacingDeskActiveBet[] = [];
  for (const run of input.acca ?? []) {
    const row = accaRacingDeskBet(run, input.eventsById);
    if (row) rows.push(row);
  }
  for (const run of input.betBuilder ?? []) {
    const row = betBuilderRacingDeskBet(run, input.eventsById);
    if (row) rows.push(row);
  }
  for (const run of input.systems ?? []) {
    const row = systemRacingDeskBet(run, input.eventsById);
    if (row) rows.push(row);
  }
  return rows;
}

/** Horse names to mark Backed on a racecard, including unlaid desk legs. */
export function deskRunnerMarksForEvent(
  eventId: number,
  input: {
    acca?: RacingDeskAcca[];
    betBuilder?: RacingDeskBetBuilder[];
    systems?: RacingDeskSystem[];
  }
): DeskRunnerMark[] {
  const marks: DeskRunnerMark[] = [];

  for (const run of input.acca ?? []) {
    if (run.status !== "active") continue;
    for (const leg of run.legs) {
      if (leg.eventId !== eventId) continue;
      const name = horseName(leg);
      if (!name) continue;
      marks.push({
        selection: name,
        status: leg.result === "pending" ? "open" : "won",
      });
    }
  }

  for (const run of input.betBuilder ?? []) {
    if (run.status !== "active" || run.eventId !== eventId) continue;
    for (const sel of run.selections) {
      const name = horseName(sel);
      if (!name) continue;
      marks.push({ selection: name, status: "open" });
    }
  }

  for (const run of input.systems ?? []) {
    if (run.status !== "active") continue;
    for (const leg of run.legs) {
      if (leg.eventId !== eventId) continue;
      const name = horseName(leg);
      if (!name) continue;
      marks.push({
        selection: name,
        status: leg.result === "pending" ? "open" : "won",
      });
    }
  }

  return marks;
}
