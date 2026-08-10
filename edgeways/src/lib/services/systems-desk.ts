/**
 * Systems desk lifecycle — full-cover tickets, no lay workflow.
 * Desk orchestrates; tracker owns money via a single back bet row.
 */

import { and, eq } from "drizzle-orm";
import {
  db,
  bets,
  events,
  systemLegs,
  systemRuns,
  type EventRow,
  type SystemLegRow,
  type SystemRunRow,
} from "@/lib/db";
import { roundPence } from "@/lib/calc/money";
import {
  previewSystemStructure,
  settleSystemReturns,
  systemRequiredLegs,
  systemStructureLabel,
  type SystemStructureType,
} from "@/lib/calc/systems-settle";
import {
  ledgerBetPlacement,
  ledgerFromSettledBet,
  reledgerOpenBetPlacement,
} from "@/lib/services/balances";
import {
  deskBackBetLabel,
  isDeskFreeBetType,
  normaliseDeskBackBetType,
  primarySportFromLegs,
  type DeskBackBetType,
} from "@/lib/desk/desk-back-bet-type";
import { deriveDeskLegAutoResult } from "@/lib/desk/leg-auto-result";
import type { BetRow } from "@/lib/db";

export type SystemClassification = "ev_play" | "mug_bet" | "qualifying";

export interface CreateSystemLegInput {
  label: string;
  oddsDecimal: number;
  eventId?: number | null;
  sport?: string | null;
  market?: string | null;
  selection?: string | null;
  scheduledAt?: number | null;
}

export interface CreateSystemRunInput {
  label: string;
  structure: SystemStructureType;
  unitStake: number;
  bookmaker?: string | null;
  eachWay?: boolean;
  /** Required when eachWay; e.g. 0.2 = 1/5, 0.25 = 1/4 */
  placeFraction?: number | null;
  classification?: SystemClassification;
  offerId?: number | null;
  backBetType?: DeskBackBetType;
  legs: CreateSystemLegInput[];
}

export function listSystemRuns(): Array<{
  run: SystemRunRow;
  legs: SystemLegRow[];
  backBetType: string | null;
  campaignProfit: number | null;
}> {
  const runs = db.select().from(systemRuns).all();
  return runs.map((run) => {
    const legs = db
      .select()
      .from(systemLegs)
      .where(eq(systemLegs.runId, run.id))
      .all()
      .sort((a, b) => a.seq - b.seq);
    const back =
      run.backBetId != null
        ? db.select().from(bets).where(eq(bets.id, run.backBetId)).get()
        : undefined;
    let campaignProfit: number | null = null;
    if (run.status === "completed" && back?.actualProfit != null) {
      campaignProfit = back.actualProfit;
    } else if (run.status === "active") {
      campaignProfit = 0;
    }
    return {
      run,
      legs,
      backBetType: back?.betType ?? null,
      campaignProfit,
    };
  });
}

export function createSystemRun(
  input: CreateSystemRunInput
): { run: SystemRunRow; legs: SystemLegRow[] } {
  const n = systemRequiredLegs(input.structure);
  if (input.legs.length !== n) {
    throw new Error(`Expected ${n} legs for ${input.structure}`);
  }
  if (!(input.unitStake > 0)) throw new Error("Unit stake required");
  for (const leg of input.legs) {
    if (!leg.label.trim()) throw new Error("Each leg needs a label");
    if (!(leg.oddsDecimal > 1)) throw new Error("Each leg needs odds above 1");
  }

  const preview = previewSystemStructure(input.structure, input.unitStake, input.legs);
  if (!preview) throw new Error("Could not build structure");

  const eachWay = Boolean(input.eachWay);
  const placeFraction =
    eachWay &&
    input.placeFraction != null &&
    input.placeFraction > 0 &&
    input.placeFraction < 1
      ? input.placeFraction
      : eachWay
        ? 0.2
        : null;
  if (eachWay && placeFraction == null) {
    throw new Error("Each-way requires a place fraction");
  }
  const totalStake = roundPence(preview.totalStake * (eachWay ? 2 : 1));
  const lines = preview.betCount;
  const classification: SystemClassification =
    input.classification === "mug_bet" || input.classification === "qualifying"
      ? input.classification
      : "ev_play";

  const now = Date.now();
  const structureLabel = systemStructureLabel(input.structure);
  const allWinPreview = settleSystemReturns(
    input.structure,
    input.unitStake,
    input.legs.map((l) => ({
      label: l.label,
      oddsDecimal: l.oddsDecimal,
      result: "won" as const,
    })),
    eachWay ? { eachWay: true, placeFraction: placeFraction! } : {}
  );
  const effectiveAllWinOdds =
    totalStake > 0 && allWinPreview != null
      ? allWinPreview.returns / totalStake
      : totalStake > 0
        ? preview.returnIfAllWin / preview.totalStake
        : 2;

  const backBetType = normaliseDeskBackBetType(input.backBetType);
  const deskSport = primarySportFromLegs(input.legs);
  const backBet = db
    .insert(bets)
    .values({
      label: deskBackBetLabel(structureLabel, input.label, backBetType),
      market: "other",
      selection: "",
      betType: backBetType,
      bookmaker: input.bookmaker ?? null,
      backStake: totalStake,
      backOdds: Number(effectiveAllWinOdds.toFixed(4)),
      layStake: 0,
      layOdds: 0,
      commission: 0,
      offerId: input.offerId ?? null,
      sport: deskSport,
      notes: isDeskFreeBetType(backBetType)
        ? `Systems desk free-bet · ${structureLabel}${eachWay ? " · each-way" : ""} · ${classification}`
        : `Systems desk · ${structureLabel}${eachWay ? " · each-way" : ""} · ${classification}`,
      createdAt: now,
    })
    .returning()
    .get();
  ledgerBetPlacement(backBet);

  const run = db
    .insert(systemRuns)
    .values({
      offerId: input.offerId ?? null,
      label: input.label.trim(),
      structure: input.structure,
      unitStake: input.unitStake,
      lines,
      totalStake,
      eachWay: eachWay ? 1 : 0,
      placeFraction,
      bookmaker: input.bookmaker ?? null,
      classification,
      backBetId: backBet.id,
      createdAt: now,
    })
    .returning()
    .get();

  const legs = input.legs.map((leg, i) =>
    db
      .insert(systemLegs)
      .values({
        runId: run.id,
        seq: i + 1,
        label: leg.label.trim(),
        eventId: leg.eventId ?? null,
        sport: leg.sport?.trim() || null,
        market: leg.market ?? null,
        selection: leg.selection ?? null,
        oddsDecimal: Number(leg.oddsDecimal.toFixed(4)),
        scheduledAt: leg.scheduledAt ?? null,
      })
      .returning()
      .get()
  );

  return { run, legs };
}

export interface UpdateSystemLegInput {
  id?: number;
  label: string;
  oddsDecimal: number;
  eventId?: number | null;
  sport?: string | null;
  market?: string | null;
  selection?: string | null;
  scheduledAt?: number | null;
}

export interface UpdateSystemRunInput {
  label: string;
  bookmaker?: string | null;
  unitStake?: number;
  eachWay?: boolean;
  placeFraction?: number | null;
  classification?: SystemClassification;
  backBetType?: DeskBackBetType;
  legs: UpdateSystemLegInput[];
}

/** True when any leg has a result or the run is no longer active. */
export function systemRunMoneyLocked(
  run: SystemRunRow,
  legs: SystemLegRow[]
): boolean {
  if (run.status !== "active") return true;
  return legs.some((l) => l.result !== "pending");
}

/**
 * Full edit for Systems desk. Structure is fixed at create.
 * Unit stake / odds / stake source only when no leg results yet.
 */
export function updateSystemRun(
  runId: number,
  input: UpdateSystemRunInput
): { run: SystemRunRow; legs: SystemLegRow[]; backBetType: string | null } | null {
  const run = db.select().from(systemRuns).where(eq(systemRuns.id, runId)).get();
  if (!run) return null;
  const existing = db
    .select()
    .from(systemLegs)
    .where(eq(systemLegs.runId, runId))
    .all()
    .sort((a, b) => a.seq - b.seq);
  const moneyLocked = systemRunMoneyLocked(run, existing);
  const n = systemRequiredLegs(run.structure);

  const label = input.label.trim();
  if (!label) return null;
  const bookmaker =
    input.bookmaker === undefined ? run.bookmaker : input.bookmaker?.trim() || null;

  const cleaned = input.legs
    .map((l) => ({
      id: l.id,
      label: l.label.trim(),
      oddsDecimal: l.oddsDecimal,
      eventId: l.eventId ?? null,
      sport: l.sport?.trim() || null,
      market: l.market ?? null,
      selection: l.selection ?? null,
      scheduledAt: l.scheduledAt ?? null,
    }))
    .filter((l) => l.label.length > 0 && l.oddsDecimal > 1);
  if (cleaned.length !== n) return null;

  if (moneyLocked) {
    if (cleaned.length !== existing.length) return null;
    for (let i = 0; i < existing.length; i++) {
      const next = cleaned[i]!;
      const prev = existing[i]!;
      if (next.id !== prev.id) return null;
      if (next.oddsDecimal !== prev.oddsDecimal) return null;
    }
  } else {
    const byId = new Map(existing.map((l) => [l.id, l]));
    for (const leg of cleaned) {
      if (leg.id != null && !byId.has(leg.id)) return null;
    }
  }

  const unitStake = moneyLocked
    ? run.unitStake
    : input.unitStake != null && input.unitStake > 0
      ? input.unitStake
      : run.unitStake;
  const eachWay = moneyLocked
    ? run.eachWay === 1
    : input.eachWay !== undefined
      ? Boolean(input.eachWay)
      : run.eachWay === 1;
  const placeFraction = moneyLocked
    ? run.placeFraction
    : eachWay
      ? input.placeFraction != null &&
        input.placeFraction > 0 &&
        input.placeFraction < 1
        ? input.placeFraction
        : (run.placeFraction ?? 0.2)
      : null;
  const classification =
    input.classification === "mug_bet" ||
    input.classification === "qualifying" ||
    input.classification === "ev_play"
      ? input.classification
      : (run.classification as SystemClassification);

  const preview = previewSystemStructure(run.structure, unitStake, cleaned);
  if (!preview) return null;
  const totalStake = roundPence(preview.totalStake * (eachWay ? 2 : 1));
  const allWinPreview = settleSystemReturns(
    run.structure,
    unitStake,
    cleaned.map((l) => ({
      label: l.label,
      oddsDecimal: l.oddsDecimal,
      result: "won" as const,
    })),
    eachWay ? { eachWay: true, placeFraction: placeFraction! } : {}
  );
  const effectiveAllWinOdds =
    totalStake > 0 && allWinPreview != null
      ? allWinPreview.returns / totalStake
      : totalStake > 0
        ? preview.returnIfAllWin / preview.totalStake
        : 2;

  const updatedRun = db
    .update(systemRuns)
    .set({
      label,
      bookmaker,
      unitStake,
      lines: preview.betCount,
      totalStake,
      eachWay: eachWay ? 1 : 0,
      placeFraction,
      classification,
    })
    .where(eq(systemRuns.id, runId))
    .returning()
    .get();
  if (!updatedRun) return null;

  if (!moneyLocked) {
    const keepIds = new Set(
      cleaned.map((l) => l.id).filter((id): id is number => id != null)
    );
    for (const prev of existing) {
      if (!keepIds.has(prev.id)) {
        db.delete(systemLegs).where(eq(systemLegs.id, prev.id)).run();
      }
    }
    cleaned.forEach((leg, i) => {
      const seq = i + 1;
      const odds = Number(leg.oddsDecimal.toFixed(4));
      if (leg.id != null) {
        db.update(systemLegs)
          .set({
            seq,
            label: leg.label,
            oddsDecimal: odds,
            eventId: leg.eventId,
            sport: leg.sport,
            market: leg.market,
            selection: leg.selection,
            scheduledAt: leg.scheduledAt,
          })
          .where(eq(systemLegs.id, leg.id))
          .run();
      } else {
        db.insert(systemLegs)
          .values({
            runId,
            seq,
            label: leg.label,
            oddsDecimal: odds,
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
    for (const leg of cleaned) {
      db.update(systemLegs)
        .set({
          label: leg.label,
          eventId: leg.eventId,
          sport: leg.sport,
          market: leg.market,
          selection: leg.selection,
          scheduledAt: leg.scheduledAt,
        })
        .where(eq(systemLegs.id, leg.id!))
        .run();
    }
  }

  const legs = db
    .select()
    .from(systemLegs)
    .where(eq(systemLegs.runId, runId))
    .all()
    .sort((a, b) => a.seq - b.seq);

  const structureLabel = systemStructureLabel(run.structure);
  const deskSport = primarySportFromLegs(cleaned);

  if (updatedRun.backBetId != null) {
    const back = db.select().from(bets).where(eq(bets.id, updatedRun.backBetId)).get();
    if (back) {
      const nextBetType =
        !moneyLocked && input.backBetType != null
          ? normaliseDeskBackBetType(input.backBetType)
          : back.betType;
      const patch: Partial<BetRow> = {
        label: deskBackBetLabel(structureLabel, label, nextBetType),
        bookmaker,
        sport: deskSport,
      };
      if (back.status === "open" && !moneyLocked) {
        patch.backStake = totalStake;
        patch.backOdds = Number(effectiveAllWinOdds.toFixed(4));
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
          (!moneyLocked &&
            (back.backStake !== totalStake || back.backOdds !== next.backOdds)))
      ) {
        reledgerOpenBetPlacement(back, next);
      }
    }
  }

  const backBetType =
    updatedRun.backBetId != null
      ? (db.select().from(bets).where(eq(bets.id, updatedRun.backBetId)).get()?.betType ??
        null)
      : null;

  return { run: updatedRun, legs, backBetType };
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

/** Set one leg result; when all legs resolved, settle the ticket. */
export function setSystemLegResult(
  legId: number,
  result: "won" | "placed" | "lost" | "void"
): { leg: SystemLegRow; runCompleted: boolean } | null {
  const leg = db.select().from(systemLegs).where(eq(systemLegs.id, legId)).get();
  if (!leg || leg.result !== "pending") return null;
  const run = db.select().from(systemRuns).where(eq(systemRuns.id, leg.runId)).get();
  if (!run || run.status !== "active") return null;

  const updated = db
    .update(systemLegs)
    .set({ result })
    .where(eq(systemLegs.id, legId))
    .returning()
    .get();

  const legs = db
    .select()
    .from(systemLegs)
    .where(eq(systemLegs.runId, run.id))
    .all()
    .sort((a, b) => a.seq - b.seq);

  if (legs.every((l) => l.result !== "pending")) {
    completeSystemRun(run, legs);
    return { leg: updated, runCompleted: true };
  }
  return { leg: updated, runCompleted: false };
}

function completeSystemRun(run: SystemRunRow, legs: SystemLegRow[]) {
  const allVoid = legs.every((l) => l.result === "void");
  if (allVoid) {
    settleLinkedBet(run.backBetId, "void", 0);
  } else {
    const eachWay = run.eachWay === 1;
    const placeFraction = run.placeFraction ?? (eachWay ? 0.2 : undefined);
    const settled = settleSystemReturns(
      run.structure,
      run.unitStake,
      legs.map((l) => ({
        label: l.label,
        oddsDecimal: l.oddsDecimal,
        result: l.result,
      })),
      eachWay ? { eachWay: true, placeFraction } : {}
    );
    if (!settled) {
      settleLinkedBet(run.backBetId, "void", 0);
    } else {
      const status: "won" | "lost" = settled.returns > 0 ? "won" : "lost";
      const back =
        run.backBetId != null
          ? db.select().from(bets).where(eq(bets.id, run.backBetId)).get()
          : undefined;
      let profit = settled.profit;
      // Free stake: loss is £0; SNR win matches cash profit; SR win includes stake back.
      if (isDeskFreeBetType(back?.betType)) {
        if (status === "lost") profit = 0;
        else if (back?.betType === "free_sr") profit = settled.returns;
      }
      settleLinkedBet(run.backBetId, status, profit);
    }
  }
  db.update(systemRuns)
    .set({ status: "completed", settledAt: Date.now() })
    .where(eq(systemRuns.id, run.id))
    .run();
}

export function deleteSystemRun(runId: number): boolean {
  const run = db.select().from(systemRuns).where(eq(systemRuns.id, runId)).get();
  if (!run) return false;
  if (run.backBetId != null) {
    db.update(bets)
      .set({ status: "void", actualProfit: 0, settledAt: Date.now() })
      .where(and(eq(bets.id, run.backBetId), eq(bets.status, "open")))
      .run();
  }
  db.delete(systemLegs).where(eq(systemLegs.runId, runId)).run();
  db.delete(systemRuns).where(eq(systemRuns.id, runId)).run();
  return true;
}

export function patchSystemRun(
  runId: number,
  patch: { classification?: SystemClassification }
): SystemRunRow | null {
  const run = db.select().from(systemRuns).where(eq(systemRuns.id, runId)).get();
  if (!run) return null;
  if (patch.classification == null) return run;
  return (
    db
      .update(systemRuns)
      .set({ classification: patch.classification })
      .where(eq(systemRuns.id, runId))
      .returning()
      .get() ?? null
  );
}

/** Open-position £ for tracker (always 0 while active — stake already ledgered). */
export function systemsOpenExposure(): number {
  return 0;
}

/** Auto-result pending system legs from linked finished events. */
export function autoResultLinkedSystemLegs(nowMs = Date.now()): number {
  const active = db.select().from(systemRuns).where(eq(systemRuns.status, "active")).all();
  if (active.length === 0) return 0;
  const allEvents = db.select().from(events).all();
  const eventById = new Map<number, EventRow>(allEvents.map((e) => [e.id, e]));
  let resolved = 0;
  for (const run of active) {
    const legs = db.select().from(systemLegs).where(eq(systemLegs.runId, run.id)).all();
    for (const leg of legs) {
      if (leg.result !== "pending" || leg.eventId == null) continue;
      const event = eventById.get(leg.eventId);
      if (!event) continue;
      const outcome = deriveDeskLegAutoResult(leg, event);
      if (outcome == null) continue;
      if (setSystemLegResult(leg.id, outcome)) resolved += 1;
    }
  }
  if (resolved > 0) void nowMs;
  return resolved;
}

/** Pending Systems legs that still need a racing result sync. */
export function pendingSystemRacingEventIds(): number[] {
  const active = db.select().from(systemRuns).where(eq(systemRuns.status, "active")).all();
  if (active.length === 0) return [];
  const ids = new Set<number>();
  for (const run of active) {
    const legs = db.select().from(systemLegs).where(eq(systemLegs.runId, run.id)).all();
    for (const leg of legs) {
      if (leg.result !== "pending" || leg.eventId == null) continue;
      if (leg.sport === "horse_racing" || leg.sport === "greyhounds") {
        ids.add(leg.eventId);
      }
    }
  }
  return [...ids];
}
