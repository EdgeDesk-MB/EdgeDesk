/**
 * Acca desk lifecycle (J7). The desk ORCHESTRATES; the tracker owns money:
 * the acca back and every placed lay are real bets rows, settled by this
 * service the moment leg results land (the desk knows the results first).
 *
 * Sam's design (2026-07-16): a leg is LAY DUE once every earlier leg has a
 * result AND kick-off is within the lead window (E1-tunable, default 30
 * min; legs with no scheduled time are due as soon as the previous result
 * lands). Lay-due alerts are ON by default with a per-run mute. Legs
 * linked to a tracked event auto-result when the event finishes
 * (football score markets + horse racing win/place/EW via
 * `deriveDeskLegAutoResult`); anything else settles by hand.
 */

import { and, eq } from "drizzle-orm";
import {
  db,
  accaLegs,
  accaRuns,
  bets,
  events,
  offers,
  type AccaLegRow,
  type AccaRunRow,
  type EventRow,
} from "@/lib/db";
import {
  DEFAULT_LAY_LEAD_MINUTES,
  LAY_DUE_EXPIRY_MS,
  applyAccaBoost,
  finalLegLockLay,
  nextSequentialLay,
  priorLayLiabilities,
} from "@/lib/calc/acca-workflow";
export { DEFAULT_LAY_LEAD_MINUTES } from "@/lib/calc/acca-workflow";
import { roundPence } from "@/lib/calc/money";
import {
  deskLegTitleParts,
  isEventAutoLabel,
  selectionDisplayLabel,
} from "@/lib/desk/desk-leg-title";
import {
  deriveDeskLegAutoResult,
  toBinaryDeskResult,
} from "@/lib/desk/leg-auto-result";
import { accaCampaignCompleteAlert } from "@/lib/alerts/acca-complete";
import { plainAlertBody } from "@/lib/alerts/plain-body";
import { recordAlerts } from "@/lib/services/alerts-inbox";
import { sendPush } from "@/lib/services/push";
import {
  ledgerBetPlacement,
  ledgerFromSettledBet,
  reledgerOpenBetPlacement,
} from "@/lib/services/balances";
import { accaRunMoneyLocked } from "@/lib/acca/acca-run-edit";
import type { BetRow } from "@/lib/db";
import {
  deskBackBetLabel,
  normaliseDeskBackBetType,
  primarySportFromLegs,
  type DeskBackBetType,
} from "@/lib/desk/desk-back-bet-type";

export { accaRunMoneyLocked } from "@/lib/acca/acca-run-edit";

export interface CreateAccaLegInput {
  label: string;
  backOdds: number;
  eventId?: number | null;
  sport?: string | null;
  market?: string | null;
  selection?: string | null;
  scheduledAt?: number | null;
}

export type AccaDeskMethod =
  | "sequential"
  | "insurance_legs"
  | "insurance_whole"
  | "combined";

export function isWholeComboAccaMethod(
  method: AccaDeskMethod | AccaRunRow["method"]
): boolean {
  return method === "insurance_whole" || method === "combined";
}

export interface CreateAccaRunInput {
  label: string;
  method: AccaDeskMethod;
  stake: number;
  bookmaker?: string | null;
  commission?: number;
  offerId?: number | null;
  refundAmount?: number | null;
  /** Bookmaker acca boost %, winnings-only convention - see applyAccaBoost */
  boostPct?: number | null;
  /** Cash or free-bet stake source — drives betType on the back bet. */
  backBetType?: DeskBackBetType;
  /** Combined method: deliberate back-only (no exchange lay). */
  noLay?: boolean;
  legs: CreateAccaLegInput[];
}

export function combinedBackOdds(legs: Array<Pick<AccaLegRow, "backOdds" | "result">>): number {
  return legs
    .filter((l) => l.result !== "void")
    .reduce((a, l) => a * l.backOdds, 1);
}

export function createAccaRun(input: CreateAccaRunInput): { run: AccaRunRow; legs: AccaLegRow[] } {
  const now = Date.now();
  const combined = input.legs.reduce((a, l) => a * l.backOdds, 1);
  const boostedCombined = applyAccaBoost(combined, input.boostPct);

  // The acca back is a real bet - back-only (the desk manages the hedging).
  // backOdds stores the BOOSTED price (what the bookmaker actually pays) so
  // it stays consistent with completeRun()'s settlement and every other
  // surface that reads this bet's odds (Profit Tracker, reports, ...).
  // Free bets use free_snr / free_sr so wallet lots / retention stay correct.
  const backBetType = normaliseDeskBackBetType(input.backBetType);
  const deskSport = primarySportFromLegs(input.legs);
  const isFree = backBetType === "free_snr" || backBetType === "free_sr";
  const backBet = db
    .insert(bets)
    .values({
      label: deskBackBetLabel("Acca", input.label, backBetType),
      market: "other",
      selection: "",
      betType: backBetType,
      bookmaker: input.bookmaker ?? null,
      backStake: input.stake,
      backOdds: Number(boostedCombined.toFixed(4)),
      commission: 0,
      offerId: input.offerId ?? null,
      sport: deskSport,
      notes: isFree
        ? input.noLay && input.method === "combined"
          ? "Acca desk free-bet convert - no lay"
          : "Acca desk free-bet convert - hedged on the exchange"
        : input.noLay && input.method === "combined"
          ? "Acca desk run - no lay"
          : "Acca desk run - hedged on the exchange",
      createdAt: now,
    })
    .returning()
    .get();
  // Same money path as Add bet: cash stake or free-bet lot debit.
  ledgerBetPlacement(backBet);

  const noLay = input.method === "combined" && input.noLay === true ? 1 : 0;
  const run = db
    .insert(accaRuns)
    .values({
      offerId: input.offerId ?? null,
      label: input.label,
      method: input.method,
      stake: input.stake,
      bookmaker: input.bookmaker ?? null,
      commission: input.commission ?? 0,
      refundAmount:
        input.method === "combined" || input.method === "sequential"
          ? null
          : (input.refundAmount ?? null),
      boostPct: input.boostPct ?? null,
      noLay,
      backBetId: backBet.id,
      createdAt: now,
    })
    .returning()
    .get();

  const legs = input.legs.map((leg, i) =>
    db
      .insert(accaLegs)
      .values({
        runId: run.id,
        seq: i + 1,
        label: leg.label,
        eventId: leg.eventId ?? null,
        sport: leg.sport?.trim() || null,
        market: leg.market ?? null,
        selection: leg.selection ?? null,
        backOdds: leg.backOdds,
        scheduledAt: leg.scheduledAt ?? null,
      })
      .returning()
      .get()
  );

  return { run, legs };
}

export type AccaRunView = {
  run: AccaRunRow;
  legs: AccaLegRow[];
  /** Linked back bet type (qualifying / free_snr / …) for campaign P&L mirroring */
  backBetType: string | null;
};

export function toAccaDeskStateRun(view: AccaRunView) {
  const { run, legs, backBetType } = view;
  return {
    id: run.id,
    label: run.label,
    status: run.status,
    settledAt: run.settledAt,
    method: run.method,
    bookmaker: run.bookmaker,
    offerId: run.offerId,
    stake: run.stake,
    commission: run.commission,
    boostPct: run.boostPct,
    backBetType,
    refundAmount: run.refundAmount,
    noLay: run.noLay,
    wholeLayStake: run.wholeLayStake,
    wholeLayOdds: run.wholeLayOdds,
    legs: legs.map((l) => ({
      seq: l.seq,
      label: l.label,
      result: l.result,
      backOdds: l.backOdds,
      layStake: l.layStake,
      layOdds: l.layOdds,
    })),
  };
}

export function listAccaRuns(): AccaRunView[] {
  const runs = db.select().from(accaRuns).all().sort((a, b) => b.createdAt - a.createdAt);
  const allLegs = db.select().from(accaLegs).all();
  const allBets = db.select().from(bets).all();
  const allEvents = db.select().from(events).all();
  const eventById = new Map(allEvents.map((e) => [e.id, e]));
  const betTypeById = new Map(allBets.map((b) => [b.id, b.betType]));
  // Repair older lays that were created before offerId was propagated, so
  // Profit Tracker keeps the campaign + legs together.
  for (const run of runs) {
    if (run.offerId == null) continue;
    const legBetIds = allLegs
      .filter((l) => l.runId === run.id && l.layBetId != null)
      .map((l) => l.layBetId!);
    const wholeId = run.wholeLayBetId;
    for (const betId of [...legBetIds, ...(wholeId != null ? [wholeId] : [])]) {
      const row = allBets.find((b) => b.id === betId);
      if (row && row.offerId == null) {
        db.update(bets).set({ offerId: run.offerId }).where(eq(bets.id, betId)).run();
        row.offerId = run.offerId;
      }
    }
  }
  // Repair legs whose label was auto-filled with the race/fixture title
  // instead of the backed selection (horse / team).
  for (const leg of allLegs) {
    const ev = leg.eventId != null ? eventById.get(leg.eventId) ?? null : null;
    const display = selectionDisplayLabel(leg.selection, ev);
    if (!display || leg.label.trim() === display) continue;
    if (!isEventAutoLabel(leg.label, ev)) continue;
    db.update(accaLegs).set({ label: display }).where(eq(accaLegs.id, leg.id)).run();
    leg.label = display;
  }
  return runs.map((run) => ({
    run,
    legs: allLegs.filter((l) => l.runId === run.id).sort((a, b) => a.seq - b.seq),
    backBetType: run.backBetId != null ? (betTypeById.get(run.backBetId) ?? null) : null,
  }));
}

/**
 * Set (or clear) a run's boost % after creation. Keeps the linked back
 * bet's stored backOdds in sync with the boosted price. Refuses once the
 * run isn't active any more - a completed run's back bet has already
 * settled at whatever price applied at the time, and letting boostPct
 * drift after that would desync the stored run field from the real,
 * already-settled ledger it's supposed to describe.
 */
export function setRunBoost(runId: number, boostPct: number | null): AccaRunRow | null {
  const run = db.select().from(accaRuns).where(eq(accaRuns.id, runId)).get();
  if (!run || run.status !== "active") return null;
  const legs = db.select().from(accaLegs).where(eq(accaLegs.runId, runId)).all();
  const boosted = applyAccaBoost(combinedBackOdds(legs), boostPct);

  if (run.backBetId != null) {
    db.update(bets)
      .set({ backOdds: Number(boosted.toFixed(4)) })
      .where(and(eq(bets.id, run.backBetId), eq(bets.status, "open")))
      .run();
  }

  return db
    .update(accaRuns)
    .set({ boostPct })
    .where(eq(accaRuns.id, runId))
    .returning()
    .get();
}

export interface UpdateAccaLegInput {
  /** Existing leg id; omit for a newly added leg (only when money fields unlocked). */
  id?: number;
  label: string;
  backOdds: number;
  eventId?: number | null;
  sport?: string | null;
  market?: string | null;
  selection?: string | null;
  scheduledAt?: number | null;
}

export interface UpdateAccaRunInput {
  label: string;
  bookmaker?: string | null;
  stake?: number;
  commission?: number;
  refundAmount?: number | null;
  boostPct?: number | null;
  /** Only applied when money is not locked. */
  backBetType?: DeskBackBetType;
  legs: UpdateAccaLegInput[];
}

function accaBackBetLabel(label: string, betType: string | null | undefined): string {
  return deskBackBetLabel("Acca", label, betType);
}

/**
 * Edit an acca run after create. Always updates label/bookmaker (and syncs
 * linked bets). Stake, commission, boost, refund and leg odds/structure only
 * when the run is still active with no lays or results.
 */
export function updateAccaRun(
  runId: number,
  input: UpdateAccaRunInput
): AccaRunView | null {
  const run = db.select().from(accaRuns).where(eq(accaRuns.id, runId)).get();
  if (!run) return null;
  const existingLegs = db
    .select()
    .from(accaLegs)
    .where(eq(accaLegs.runId, runId))
    .all()
    .sort((a, b) => a.seq - b.seq);
  const moneyLocked = accaRunMoneyLocked(run, existingLegs);

  const label = input.label.trim();
  if (!label) return null;
  const bookmaker =
    input.bookmaker === undefined ? run.bookmaker : input.bookmaker?.trim() || null;

  const cleanedLegs = input.legs
    .map((l) => ({
      id: l.id,
      label: l.label.trim(),
      backOdds: l.backOdds,
      eventId: l.eventId ?? null,
      sport: l.sport?.trim() || null,
      market: l.market ?? null,
      selection: l.selection ?? null,
      scheduledAt: l.scheduledAt ?? null,
    }))
    .filter((l) => l.label.length > 0 && l.backOdds > 1);
  if (cleanedLegs.length < 2) return null;

  if (moneyLocked) {
    // Structure must match existing legs 1:1 (same ids, same count).
    if (cleanedLegs.length !== existingLegs.length) return null;
    for (let i = 0; i < existingLegs.length; i++) {
      const next = cleanedLegs[i]!;
      const prev = existingLegs[i]!;
      if (next.id !== prev.id) return null;
      if (next.backOdds !== prev.backOdds) return null;
    }
  } else {
    // Keep any referenced id that still belongs to this run.
    const byId = new Map(existingLegs.map((l) => [l.id, l]));
    for (const leg of cleanedLegs) {
      if (leg.id != null && !byId.has(leg.id)) return null;
    }
  }

  const stake = moneyLocked
    ? run.stake
    : input.stake != null && input.stake > 0
      ? input.stake
      : run.stake;
  const commission = moneyLocked
    ? run.commission
    : input.commission != null && input.commission >= 0
      ? input.commission
      : run.commission;
  const boostPct = moneyLocked
    ? run.boostPct
    : input.boostPct !== undefined
      ? input.boostPct
      : run.boostPct;
  const refundAmount = moneyLocked
    ? run.refundAmount
    : run.method === "combined" || run.method === "sequential"
      ? null
      : input.refundAmount !== undefined
        ? input.refundAmount
        : run.refundAmount;

  const boostedCombined = applyAccaBoost(
    cleanedLegs.reduce((a, l) => a * l.backOdds, 1),
    boostPct
  );

  const updatedRun = db
    .update(accaRuns)
    .set({
      label,
      bookmaker,
      stake,
      commission,
      boostPct: boostPct ?? null,
      refundAmount,
    })
    .where(eq(accaRuns.id, runId))
    .returning()
    .get();
  if (!updatedRun) return null;

  if (!moneyLocked) {
    const keepIds = new Set(
      cleanedLegs.map((l) => l.id).filter((id): id is number => id != null)
    );
    for (const prev of existingLegs) {
      if (!keepIds.has(prev.id)) {
        db.delete(accaLegs).where(eq(accaLegs.id, prev.id)).run();
      }
    }
    cleanedLegs.forEach((leg, i) => {
      const seq = i + 1;
      if (leg.id != null) {
        db.update(accaLegs)
          .set({
            seq,
            label: leg.label,
            backOdds: leg.backOdds,
            eventId: leg.eventId,
            sport: leg.sport,
            market: leg.market,
            selection: leg.selection,
            scheduledAt: leg.scheduledAt,
          })
          .where(eq(accaLegs.id, leg.id))
          .run();
      } else {
        db.insert(accaLegs)
          .values({
            runId,
            seq,
            label: leg.label,
            backOdds: leg.backOdds,
            eventId: leg.eventId,
            sport: leg.sport,
            market: leg.market,
            selection: leg.selection,
            scheduledAt: leg.scheduledAt,
          })
          .run();
      }
    });
  } else {
    for (const leg of cleanedLegs) {
      db.update(accaLegs)
        .set({
          label: leg.label,
          eventId: leg.eventId,
          sport: leg.sport,
          market: leg.market,
          selection: leg.selection,
          scheduledAt: leg.scheduledAt,
        })
        .where(eq(accaLegs.id, leg.id!))
        .run();
    }
  }

  const legs = db
    .select()
    .from(accaLegs)
    .where(eq(accaLegs.runId, runId))
    .all()
    .sort((a, b) => a.seq - b.seq);

  // Sync linked tracker bets (labels, bookmaker, open back stake/odds, sport, stake source).
  if (updatedRun.backBetId != null) {
    const back = db.select().from(bets).where(eq(bets.id, updatedRun.backBetId)).get();
    if (back) {
      const nextBetType =
        !moneyLocked && input.backBetType != null
          ? normaliseDeskBackBetType(input.backBetType)
          : back.betType;
      const deskSport = primarySportFromLegs(cleanedLegs);
      const patch: Partial<BetRow> = {
        label: accaBackBetLabel(label, nextBetType),
        bookmaker,
        sport: deskSport,
      };
      if (back.status === "open" && !moneyLocked) {
        patch.backStake = stake;
        patch.backOdds = Number(boostedCombined.toFixed(4));
        patch.betType = nextBetType;
      }
      const next = db
        .update(bets)
        .set(patch)
        .where(eq(bets.id, back.id))
        .returning()
        .get();
      if (
        next &&
        back.status === "open" &&
        (back.bookmaker !== bookmaker ||
          back.betType !== next.betType ||
          (!moneyLocked && (back.backStake !== stake || back.backOdds !== next.backOdds)))
      ) {
        reledgerOpenBetPlacement(back, next);
      }
    }
  }
  if (updatedRun.wholeLayBetId != null) {
    db.update(bets)
      .set({
        label: `Acca lay · ${label}`,
        bookmaker,
        ...(moneyLocked ? {} : { commission }),
      })
      .where(eq(bets.id, updatedRun.wholeLayBetId))
      .run();
  }
  for (const leg of legs) {
    if (leg.layBetId == null) continue;
    const linkedEvent =
      leg.eventId != null
        ? db.select().from(events).where(eq(events.id, leg.eventId)).get()
        : null;
    const layTitle = deskLegTitleParts(leg, linkedEvent).primary;
    db.update(bets)
      .set({
        label: `Acca lay · ${layTitle}`,
        bookmaker,
        ...(moneyLocked ? {} : { commission }),
      })
      .where(eq(bets.id, leg.layBetId))
      .run();
  }

  const backBetType =
    updatedRun.backBetId != null
      ? (db.select().from(bets).where(eq(bets.id, updatedRun.backBetId)).get()?.betType ?? null)
      : null;
  return { run: updatedRun, legs, backBetType };
}

export interface LegDueState {
  due: boolean;
  /** Suggested cover (or final-lock) stake at the leg's current lay odds */
  suggestedStake: number | null;
  /** True when this is the run's final pending leg (sequential lock point) */
  isFinal: boolean;
}

/** Lay-due rule + suggested stake for one leg of an ACTIVE run. */
export function legDueState(
  run: AccaRunRow,
  legs: AccaLegRow[],
  leg: AccaLegRow,
  nowMs: number,
  leadMinutes = DEFAULT_LAY_LEAD_MINUTES,
  /** Odds to size against; defaults to the leg's bookie odds as a proxy */
  layOdds?: number
): LegDueState {
  const notDue: LegDueState = { due: false, suggestedStake: null, isFinal: false };
  if (run.status !== "active" || isWholeComboAccaMethod(run.method) || run.noLay === 1) {
    return notDue;
  }
  if (leg.result !== "pending" || leg.layStake != null) return notDue;

  // A dead acca is never laid further - pure exchange exposure otherwise.
  if (legs.some((l) => l.result === "lost")) return notDue;
  const earlier = legs.filter((l) => l.seq < leg.seq);
  if (earlier.some((l) => l.result === "pending")) return notDue;
  if (leg.scheduledAt != null && leg.scheduledAt - nowMs > leadMinutes * 60_000) return notDue;
  if (leg.scheduledAt != null && leg.scheduledAt < nowMs - LAY_DUE_EXPIRY_MS) return notDue;

  const prior = priorLayLiabilities(legs);
  const pendingAfter = legs.filter((l) => l.seq > leg.seq && l.result === "pending").length;
  const isFinal = pendingAfter === 0;
  const q = layOdds ?? leg.backOdds;

  if (run.method === "sequential" && isFinal) {
    const lock = finalLegLockLay({
      accaStake: run.stake,
      combinedBackOdds: applyAccaBoost(combinedBackOdds(legs), run.boostPct),
      priorLiabilities: prior,
      legLayOdds: q,
      commission: run.commission,
    });
    return { due: true, suggestedStake: lock?.layStake ?? null, isFinal };
  }
  const cover = nextSequentialLay({
    accaStake: run.stake,
    priorLiabilities: prior,
    commission: run.commission,
  });
  return { due: true, suggestedStake: cover, isFinal };
}

/**
 * Log a placed lay for a leg. Stake > 0 creates the REAL lay_only bet;
 * stake === 0 records a deliberate no-lay (no exchange bet) so the desk
 * can move on to the result.
 */
export function logLegLay(
  legId: number,
  layOdds: number,
  layStake: number,
  exchangeId?: number | null
): AccaLegRow | null {
  const leg = db.select().from(accaLegs).where(eq(accaLegs.id, legId)).get();
  if (!leg || leg.result !== "pending" || leg.layStake != null) return null;
  const run = db.select().from(accaRuns).where(eq(accaRuns.id, leg.runId)).get();
  if (!run) return null;
  if (!(layStake >= 0) || !Number.isFinite(layStake)) return null;

  // Deliberate no lay: mark the decision without a tracker bet.
  if (layStake === 0) {
    return db
      .update(accaLegs)
      .set({ layOdds: 0, layStake: 0, layBetId: null })
      .where(eq(accaLegs.id, legId))
      .returning()
      .get();
  }

  if (!(layOdds > 1)) return null;

  const linkedEvent =
    leg.eventId != null
      ? db.select().from(events).where(eq(events.id, leg.eventId)).get()
      : null;
  const layTitle = deskLegTitleParts(leg, linkedEvent).primary;

  const layBet = db
    .insert(bets)
    .values({
      label: `Acca lay · ${layTitle}`,
      market: leg.market ?? "other",
      selection: leg.selection ?? "",
      betType: "lay_only",
      eventId: leg.eventId ?? null,
      exchangeId: exchangeId ?? null,
      offerId: run.offerId ?? null,
      bookmaker: run.bookmaker ?? null,
      layStake,
      layOdds,
      commission: run.commission,
      notes: `Acca desk: leg ${leg.seq} of "${run.label}"`,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  ledgerBetPlacement(layBet);

  return db
    .update(accaLegs)
    .set({ layOdds, layStake, layBetId: layBet.id })
    .where(eq(accaLegs.id, legId))
    .returning()
    .get();
}

/** Log the single combined lay for insurance_whole or combined runs. */
export function logWholeLay(
  runId: number,
  layOdds: number,
  layStake: number,
  exchangeId?: number | null
): AccaRunRow | null {
  const run = db.select().from(accaRuns).where(eq(accaRuns.id, runId)).get();
  if (
    !run ||
    !isWholeComboAccaMethod(run.method) ||
    run.noLay === 1 ||
    run.wholeLayBetId != null
  ) {
    return null;
  }
  const layBet = db
    .insert(bets)
    .values({
      label: `Acca lay (whole) · ${run.label}`,
      market: "other",
      selection: "",
      betType: "lay_only",
      exchangeId: exchangeId ?? null,
      offerId: run.offerId ?? null,
      bookmaker: run.bookmaker ?? null,
      layStake,
      layOdds,
      commission: run.commission,
      notes:
        run.method === "combined"
          ? `Acca desk: combined lay for "${run.label}"`
          : `Acca desk: whole-acca insurance lay for "${run.label}"`,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  ledgerBetPlacement(layBet);
  return db
    .update(accaRuns)
    .set({ wholeLayBetId: layBet.id, wholeLayStake: layStake, wholeLayOdds: layOdds })
    .where(eq(accaRuns.id, runId))
    .returning()
    .get();
}

/** Mark a combined run as deliberate no lay (Add bet convention). */
export function markAccaNoLay(runId: number): AccaRunRow | null {
  const run = db.select().from(accaRuns).where(eq(accaRuns.id, runId)).get();
  if (
    !run ||
    run.status !== "active" ||
    run.method !== "combined" ||
    run.wholeLayBetId != null
  ) {
    return null;
  }
  return db
    .update(accaRuns)
    .set({ noLay: 1 })
    .where(eq(accaRuns.id, runId))
    .returning()
    .get();
}

/** Free-bet convert lose → £0 P&L (stake was free); cash qualify lose → −stake. */
function backLostProfit(back: Pick<BetRow, "betType"> | undefined, stake: number): number {
  if (back?.betType === "free_snr" || back?.betType === "free_sr") return 0;
  return -stake;
}

function settleLinkedBet(betId: number | null, status: "won" | "lost" | "void", profit: number) {
  if (betId == null) return;
  const updated = db
    .update(bets)
    .set({ status, actualProfit: roundPence(profit), settledAt: Date.now() })
    .where(and(eq(bets.id, betId), eq(bets.status, "open")))
    .returning()
    .get();
  if (updated) ledgerFromSettledBet(updated);
}

/**
 * Record a leg result; settles the leg's lay bet immediately and completes
 * the run when it's decided (any loss, or every leg resolved).
 */
export function setLegResult(
  legId: number,
  result: "won" | "lost" | "void"
): { leg: AccaLegRow; runCompleted: boolean; runId: number } | null {
  const leg = db.select().from(accaLegs).where(eq(accaLegs.id, legId)).get();
  if (!leg || leg.result !== "pending") return null;
  const run = db.select().from(accaRuns).where(eq(accaRuns.id, leg.runId)).get();
  if (!run) return null;

  const updated = db
    .update(accaLegs)
    .set({ result })
    .where(eq(accaLegs.id, legId))
    .returning()
    .get();

  // The leg's lay settles the moment the leg does: leg lost → lay won.
  if (leg.layBetId != null && leg.layStake != null && leg.layOdds != null) {
    if (result === "lost") {
      settleLinkedBet(leg.layBetId, "won", leg.layStake * (1 - run.commission));
    } else if (result === "won") {
      settleLinkedBet(leg.layBetId, "lost", -leg.layStake * (leg.layOdds - 1));
    } else {
      settleLinkedBet(leg.layBetId, "void", 0);
    }
  }

  const legs = db.select().from(accaLegs).where(eq(accaLegs.runId, run.id)).all();
  const anyLost = legs.some((l) => l.result === "lost");
  const allResolved = legs.every((l) => l.result !== "pending");

  // Money settles as soon as it is determinable (idempotent - only open
  // bets update). The RUN completes on first loss for sequential (nothing
  // further is ever laid), but insurance stays ACTIVE until every leg has
  // a result - the refund pays only if all OTHER legs win (auditor F1).
  if (anyLost) {
    const back =
      run.backBetId != null
        ? db.select().from(bets).where(eq(bets.id, run.backBetId)).get()
        : undefined;
    settleLinkedBet(run.backBetId, "lost", backLostProfit(back, run.stake));
    if (run.wholeLayBetId != null && run.wholeLayStake != null) {
      settleLinkedBet(run.wholeLayBetId, "won", run.wholeLayStake * (1 - run.commission));
    }
  }
  // Sequential completes on first loss; insurance + combined wait for every leg
  // (combined needs all results even when no-lay).
  const runDecided = run.method === "sequential" ? anyLost || allResolved : allResolved;
  if (runDecided && run.status === "active") {
    completeRun(run, legs, anyLost);
  } else if (
    (result === "won" || result === "void") &&
    run.status === "active" &&
    !run.muteAlerts
  ) {
    // Mid-run: actionable push is the next cover stake, not the settled lay liability.
    maybeAccaNextLayAlert(run, legs);
  }
  return { leg: updated, runCompleted: runDecided, runId: run.id };
}

/**
 * After a leg settles won/void and the run continues, push the next cover
 * (or final-lock proxy) stake immediately - not gated on the 30-minute
 * kick-off window used by `acca_lay_due`.
 */
export function maybeAccaNextLayAlert(run: AccaRunRow, legs: AccaLegRow[]): boolean {
  if (run.muteAlerts || isWholeComboAccaMethod(run.method) || run.noLay === 1) return false;
  if (legs.some((l) => l.result === "lost")) return false;

  const next = legs
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .find((leg) => {
      if (leg.result !== "pending" || leg.layStake != null) return false;
      return !legs.some((earlier) => earlier.seq < leg.seq && earlier.result === "pending");
    });
  if (!next) return false;

  const prior = priorLayLiabilities(legs);
  const pendingAfter = legs.filter((l) => l.seq > next.seq && l.result === "pending").length;
  const isFinal = pendingAfter === 0;
  let suggestedStake: number | null = null;
  if (run.method === "sequential" && isFinal) {
    suggestedStake =
      finalLegLockLay({
        accaStake: run.stake,
        combinedBackOdds: applyAccaBoost(combinedBackOdds(legs), run.boostPct),
        priorLiabilities: prior,
        legLayOdds: next.backOdds,
        commission: run.commission,
      })?.layStake ?? null;
  } else {
    suggestedStake = nextSequentialLay({
      accaStake: run.stake,
      priorLiabilities: prior,
      commission: run.commission,
    });
  }

  const alert = {
    key: `acca_next_lay:${next.id}`,
    kind: "acca_next_lay",
    title:
      suggestedStake != null
        ? `Next lay · ~£${suggestedStake.toFixed(2)}`
        : `Next lay · leg ${next.seq}`,
    body: `${run.label} · ${next.label} · enter live exchange lay odds and stake on Acca Desk`,
    href: "/acca",
  };
  if (recordAlerts([alert]) <= 0) return false;
  void sendPush(alert).catch(() => {});
  return true;
}

function completeRun(run: AccaRunRow, legs: AccaLegRow[], anyLost: boolean) {
  const combined = applyAccaBoost(combinedBackOdds(legs), run.boostPct);
  const allVoid = legs.every((l) => l.result === "void");
  const back =
    run.backBetId != null
      ? db.select().from(bets).where(eq(bets.id, run.backBetId)).get()
      : undefined;
  if (anyLost) {
    settleLinkedBet(run.backBetId, "lost", backLostProfit(back, run.stake));
  } else if (allVoid) {
    settleLinkedBet(run.backBetId, "void", 0);
  } else {
    settleLinkedBet(run.backBetId, "won", run.stake * (combined - 1));
  }
  // insurance_whole: the combined lay settles opposite the acca.
  if (run.wholeLayBetId != null && run.wholeLayStake != null && run.wholeLayOdds != null) {
    if (anyLost) {
      settleLinkedBet(run.wholeLayBetId, "won", run.wholeLayStake * (1 - run.commission));
    } else if (allVoid) {
      settleLinkedBet(run.wholeLayBetId, "void", 0);
    } else {
      settleLinkedBet(run.wholeLayBetId, "lost", -run.wholeLayStake * (run.wholeLayOdds - 1));
    }
  }

  db.update(accaRuns)
    .set({ status: "completed", settledAt: Date.now() })
    .where(eq(accaRuns.id, run.id))
    .run();

  // Insurance refund: exactly one leg lost triggers the free bet.
  const lostCount = legs.filter((l) => l.result === "lost").length;
  if (
    (run.method === "insurance_legs" || run.method === "insurance_whole") &&
    lostCount === 1 &&
    (run.refundAmount ?? 0) > 0
  ) {
    const alert = {
      key: `acca_refund:${run.id}`,
      kind: "acca_refund",
      title: `£${run.refundAmount!.toFixed(2)} acca refund due`,
      body: `${run.label} · one leg lost, claim the free bet`,
      href: "/acca",
    };
    recordAlerts([alert]);
    void sendPush(alert).catch(() => {});
  }

  notifyAccaComplete(run, legs, back?.betType ?? null);
}

function notifyAccaComplete(
  run: AccaRunRow,
  legs: AccaLegRow[],
  backBetType: string | null
) {
  let offerTitle: string | null = null;
  if (run.offerId != null) {
    offerTitle =
      db
        .select({ title: offers.title })
        .from(offers)
        .where(eq(offers.id, run.offerId))
        .get()?.title ?? null;
  }
  const alert = accaCampaignCompleteAlert({
    id: run.id,
    label: run.label,
    method: run.method,
    bookmaker: run.bookmaker,
    offerTitle,
    stake: run.stake,
    commission: run.commission,
    boostPct: run.boostPct,
    backBetType,
    refundAmount: run.refundAmount,
    noLay: run.noLay,
    wholeLayStake: run.wholeLayStake,
    wholeLayOdds: run.wholeLayOdds,
    legs: legs.map((l) => ({
      seq: l.seq,
      label: l.label,
      result: l.result,
      backOdds: l.backOdds,
      layStake: l.layStake,
      layOdds: l.layOdds,
    })),
  });
  recordAlerts([
    {
      key: alert.key,
      kind: alert.kind,
      title: alert.title,
      body: plainAlertBody(alert),
      href: alert.href,
    },
  ]);
  void sendPush(alert).catch(() => {});
}

/** Auto-results: linked finished events decide football + racing desk legs. */
export function autoResultLinkedLegs(nowMs = Date.now()): number {
  const active = db.select().from(accaRuns).where(eq(accaRuns.status, "active")).all();
  if (active.length === 0) return 0;
  const allEvents = db.select().from(events).all();
  const eventById = new Map<number, EventRow>(allEvents.map((e) => [e.id, e]));
  let resolved = 0;
  for (const run of active) {
    const legs = db.select().from(accaLegs).where(eq(accaLegs.runId, run.id)).all();
    for (const leg of legs) {
      if (leg.result !== "pending" || leg.eventId == null) continue;
      const event = eventById.get(leg.eventId);
      if (!event) continue;
      const outcome = deriveDeskLegAutoResult(leg, event);
      if (outcome == null) continue;
      if (setLegResult(leg.id, toBinaryDeskResult(outcome))) resolved += 1;
    }
  }
  if (resolved > 0) void nowMs;
  return resolved;
}

/** Pending Acca legs that still need a racing result sync. */
export function pendingAccaRacingEventIds(): number[] {
  const active = db.select().from(accaRuns).where(eq(accaRuns.status, "active")).all();
  if (active.length === 0) return [];
  const ids = new Set<number>();
  for (const run of active) {
    const legs = db.select().from(accaLegs).where(eq(accaLegs.runId, run.id)).all();
    for (const leg of legs) {
      if (leg.result !== "pending" || leg.eventId == null) continue;
      if (leg.sport === "horse_racing" || leg.sport === "greyhounds") {
        ids.add(leg.eventId);
      }
    }
  }
  return [...ids];
}

/** Compute-on-poll: raise lay-due alerts (default ON, per-run mute). */
export function maybeAccaLayDueAlerts(nowMs = Date.now(), leadMinutes = DEFAULT_LAY_LEAD_MINUTES): number {
  let raised = 0;
  for (const { run, legs } of listAccaRuns()) {
    if (run.status !== "active" || run.muteAlerts) continue;
    for (const leg of legs) {
      const state = legDueState(run, legs, leg, nowMs, leadMinutes);
      if (!state.due) continue;
      const alert = {
        key: `acca_lay_due:${leg.id}`,
        kind: "acca_lay_due",
        title:
          state.suggestedStake != null
            ? `Lay leg ${leg.seq} · ~£${state.suggestedStake.toFixed(2)}`
            : `Lay leg ${leg.seq}`,
        body: `${run.label} · ${leg.label} · enter live exchange lay odds and stake on Acca Desk`,
        href: "/acca",
      };
      if (recordAlerts([alert]) > 0) {
        void sendPush(alert).catch(() => {});
        raised += 1;
      }
    }
  }
  return raised;
}
