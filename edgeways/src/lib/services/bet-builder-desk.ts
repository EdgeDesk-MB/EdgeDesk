/**
 * Bet Builder desk lifecycle. Desk orchestrates; tracker owns money.
 * Same-event selections + one kick-off; Combined lay or No lay only.
 */

import { and, eq } from "drizzle-orm";
import {
  db,
  betBuilderRuns,
  betBuilderSelections,
  bets,
  events,
  type BetBuilderRunRow,
  type BetBuilderSelectionRow,
  type BetRow,
  type EventRow,
} from "@/lib/db";
import {
  DEFAULT_LAY_LEAD_MINUTES,
  LAY_DUE_EXPIRY_MS,
  wholeComboLay,
} from "@/lib/calc/bet-builder-workflow";
import { roundPence } from "@/lib/calc/money";
import { recordAlerts } from "@/lib/services/alerts-inbox";
import { sendPush } from "@/lib/services/push";
import {
  ledgerBetPlacement,
  ledgerFromSettledBet,
  reledgerOpenBetPlacement,
} from "@/lib/services/balances";
import { betBuilderRunMoneyLocked } from "@/lib/bet-builder/bet-builder-run-edit";
import {
  deskBackBetLabel,
  isDeskFreeBetType,
  normaliseDeskBackBetType,
  type DeskBackBetType,
} from "@/lib/desk/desk-back-bet-type";
import {
  deriveDeskLegAutoResult,
  toBinaryDeskResult,
} from "@/lib/desk/leg-auto-result";

export { betBuilderRunMoneyLocked } from "@/lib/bet-builder/bet-builder-run-edit";

export { DEFAULT_LAY_LEAD_MINUTES, wholeComboLay };

export interface CreateBetBuilderSelectionInput {
  label: string;
  market?: string | null;
  selection?: string | null;
}

export interface CreateBetBuilderRunInput {
  label: string;
  method: "combined" | "no_lay";
  stake: number;
  backOdds: number;
  bookmaker?: string | null;
  commission?: number;
  offerId?: number | null;
  eventLabel?: string | null;
  eventId?: number | null;
  sport?: string | null;
  scheduledAt?: number | null;
  backBetType?: DeskBackBetType;
  selections: CreateBetBuilderSelectionInput[];
  /** Optional combined lay logged at create (typical when placed with the back). */
  wholeLay?: {
    layOdds: number;
    layStake: number;
    exchangeId?: number | null;
  } | null;
}

export function listBetBuilderRuns(): Array<{
  run: BetBuilderRunRow;
  selections: BetBuilderSelectionRow[];
  backBetType: string | null;
}> {
  const runs = db.select().from(betBuilderRuns).all();
  return runs.map((run) => {
    const selections = db
      .select()
      .from(betBuilderSelections)
      .where(eq(betBuilderSelections.runId, run.id))
      .all()
      .sort((a, b) => a.seq - b.seq);
    const back =
      run.backBetId != null
        ? db.select().from(bets).where(eq(bets.id, run.backBetId)).get()
        : undefined;
    return { run, selections, backBetType: back?.betType ?? null };
  });
}

export function createBetBuilderRun(
  input: CreateBetBuilderRunInput
): { run: BetBuilderRunRow; selections: BetBuilderSelectionRow[] } {
  const now = Date.now();
  const backBetType = normaliseDeskBackBetType(input.backBetType);
  const isFree = isDeskFreeBetType(backBetType);
  const isNoLay = input.method === "no_lay";
  // Same 4dp price on the bet row and the run so win settlement cannot drift.
  const backOdds = Number(input.backOdds.toFixed(4));
  const sport = input.sport?.trim() || null;
  const eventId = input.eventId ?? null;

  const backBet = db
    .insert(bets)
    .values({
      label: deskBackBetLabel("BB", input.label, backBetType),
      market: "other",
      selection: "",
      betType: backBetType,
      bookmaker: input.bookmaker ?? null,
      backStake: input.stake,
      backOdds,
      ...(isNoLay ? { layStake: 0, layOdds: 0 } : {}),
      commission: 0,
      offerId: input.offerId ?? null,
      eventId,
      sport,
      notes: isNoLay
        ? isFree
          ? "Bet Builder desk free-bet convert - no lay"
          : "Bet Builder desk - no lay"
        : isFree
          ? "Bet Builder desk free-bet convert - combined lay"
          : "Bet Builder desk - combined lay",
      createdAt: now,
    })
    .returning()
    .get();
  ledgerBetPlacement(backBet);

  let run = db
    .insert(betBuilderRuns)
    .values({
      offerId: input.offerId ?? null,
      label: input.label,
      method: input.method,
      stake: input.stake,
      bookmaker: input.bookmaker ?? null,
      commission: input.commission ?? 0,
      backOdds,
      backBetId: backBet.id,
      eventLabel: input.eventLabel ?? null,
      eventId,
      sport,
      scheduledAt: input.scheduledAt ?? null,
      createdAt: now,
    })
    .returning()
    .get();

  const selections = input.selections.map((s, i) =>
    db
      .insert(betBuilderSelections)
      .values({
        runId: run.id,
        seq: i + 1,
        label: s.label,
        market: s.market ?? null,
        selection: s.selection ?? null,
      })
      .returning()
      .get()
  );

  const lay = input.wholeLay;
  if (
    !isNoLay &&
    lay != null &&
    lay.layOdds > 1 &&
    lay.layStake > 0
  ) {
    const laid = logBetBuilderWholeLay(run.id, lay.layOdds, lay.layStake, lay.exchangeId);
    if (laid) run = laid;
  }

  return { run, selections };
}

export function logBetBuilderWholeLay(
  runId: number,
  layOdds: number,
  layStake: number,
  exchangeId?: number | null
): BetBuilderRunRow | null {
  const run = db.select().from(betBuilderRuns).where(eq(betBuilderRuns.id, runId)).get();
  if (!run || run.method !== "combined" || run.wholeLayBetId != null || run.status !== "active") {
    return null;
  }
  const layBet = db
    .insert(bets)
    .values({
      label: `BB lay · ${run.label}`,
      market: "other",
      selection: "",
      betType: "lay_only",
      exchangeId: exchangeId ?? null,
      offerId: run.offerId ?? null,
      bookmaker: run.bookmaker ?? null,
      layStake,
      layOdds,
      commission: run.commission,
      notes: `Bet Builder desk: combined lay for "${run.label}"`,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  ledgerBetPlacement(layBet);
  return db
    .update(betBuilderRuns)
    .set({ wholeLayBetId: layBet.id, wholeLayStake: layStake, wholeLayOdds: layOdds })
    .where(eq(betBuilderRuns.id, runId))
    .returning()
    .get();
}

export interface UpdateBetBuilderSelectionInput {
  id?: number;
  label: string;
  market?: string | null;
  selection?: string | null;
}

export interface UpdateBetBuilderRunInput {
  label: string;
  bookmaker?: string | null;
  stake?: number;
  backOdds?: number;
  commission?: number;
  eventLabel?: string | null;
  eventId?: number | null;
  sport?: string | null;
  scheduledAt?: number | null;
  backBetType?: DeskBackBetType;
  selections: UpdateBetBuilderSelectionInput[];
}

function bbBackBetLabel(label: string, betType: string | null | undefined): string {
  return deskBackBetLabel("BB", label, betType);
}

/**
 * Edit a bet builder after create. Always updates label/bookmaker/event/kick-off
 * and selection labels. Stake, odds, commission and selection structure only
 * when the run is still active with no lay and no selection results.
 */
export function updateBetBuilderRun(
  runId: number,
  input: UpdateBetBuilderRunInput
): {
  run: BetBuilderRunRow;
  selections: BetBuilderSelectionRow[];
  backBetType: string | null;
} | null {
  const run = db.select().from(betBuilderRuns).where(eq(betBuilderRuns.id, runId)).get();
  if (!run) return null;
  const existing = db
    .select()
    .from(betBuilderSelections)
    .where(eq(betBuilderSelections.runId, runId))
    .all()
    .sort((a, b) => a.seq - b.seq);
  const moneyLocked = betBuilderRunMoneyLocked(run, existing);

  const label = input.label.trim();
  if (!label) return null;
  const bookmaker =
    input.bookmaker === undefined ? run.bookmaker : input.bookmaker?.trim() || null;
  const eventLabel =
    input.eventLabel === undefined
      ? run.eventLabel
      : input.eventLabel?.trim() || null;
  const eventId =
    input.eventId === undefined ? run.eventId : input.eventId;
  const sport =
    input.sport === undefined ? run.sport : input.sport?.trim() || null;
  const scheduledAt =
    input.scheduledAt === undefined ? run.scheduledAt : input.scheduledAt;

  const cleaned = input.selections
    .map((s) => ({
      id: s.id,
      label: s.label.trim(),
      market: s.market ?? null,
      selection: s.selection ?? null,
    }))
    .filter((s) => s.label.length > 0);
  if (cleaned.length < 2) return null;

  if (moneyLocked) {
    if (cleaned.length !== existing.length) return null;
    for (let i = 0; i < existing.length; i++) {
      if (cleaned[i]!.id !== existing[i]!.id) return null;
    }
  } else {
    const byId = new Map(existing.map((s) => [s.id, s]));
    for (const sel of cleaned) {
      if (sel.id != null && !byId.has(sel.id)) return null;
    }
  }

  const stake = moneyLocked
    ? run.stake
    : input.stake != null && input.stake > 0
      ? input.stake
      : run.stake;
  const backOdds = moneyLocked
    ? run.backOdds
    : input.backOdds != null && input.backOdds > 1
      ? Number(input.backOdds.toFixed(4))
      : run.backOdds;
  const commission = moneyLocked
    ? run.commission
    : input.commission != null && input.commission >= 0
      ? input.commission
      : run.commission;

  const updatedRun = db
    .update(betBuilderRuns)
    .set({
      label,
      bookmaker,
      stake,
      backOdds,
      commission,
      eventLabel,
      eventId,
      sport,
      scheduledAt,
    })
    .where(eq(betBuilderRuns.id, runId))
    .returning()
    .get();
  if (!updatedRun) return null;

  if (!moneyLocked) {
    const keepIds = new Set(
      cleaned.map((s) => s.id).filter((id): id is number => id != null)
    );
    for (const prev of existing) {
      if (!keepIds.has(prev.id)) {
        db.delete(betBuilderSelections).where(eq(betBuilderSelections.id, prev.id)).run();
      }
    }
    cleaned.forEach((sel, i) => {
      const seq = i + 1;
      if (sel.id != null) {
        db.update(betBuilderSelections)
          .set({
            seq,
            label: sel.label,
            market: sel.market,
            selection: sel.selection,
          })
          .where(eq(betBuilderSelections.id, sel.id))
          .run();
      } else {
        db.insert(betBuilderSelections)
          .values({
            runId,
            seq,
            label: sel.label,
            market: sel.market,
            selection: sel.selection,
          })
          .run();
      }
    });
  } else {
    for (const sel of cleaned) {
      db.update(betBuilderSelections)
        .set({
          label: sel.label,
          market: sel.market,
          selection: sel.selection,
        })
        .where(eq(betBuilderSelections.id, sel.id!))
        .run();
    }
  }

  const selections = db
    .select()
    .from(betBuilderSelections)
    .where(eq(betBuilderSelections.runId, runId))
    .all()
    .sort((a, b) => a.seq - b.seq);

  if (updatedRun.backBetId != null) {
    const back = db.select().from(bets).where(eq(bets.id, updatedRun.backBetId)).get();
    if (back) {
      const nextBetType =
        !moneyLocked && input.backBetType != null
          ? normaliseDeskBackBetType(input.backBetType)
          : back.betType;
      const patch: Partial<BetRow> = {
        label: bbBackBetLabel(label, nextBetType),
        bookmaker,
        eventId,
        sport,
      };
      if (back.status === "open" && !moneyLocked) {
        patch.backStake = stake;
        patch.backOdds = backOdds;
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
            (back.backStake !== stake || back.backOdds !== backOdds)))
      ) {
        reledgerOpenBetPlacement(back, next);
      }
    }
  }
  if (updatedRun.wholeLayBetId != null) {
    db.update(bets)
      .set({
        label: `BB lay · ${label}`,
        bookmaker,
        ...(moneyLocked ? {} : { commission }),
      })
      .where(eq(bets.id, updatedRun.wholeLayBetId))
      .run();
  }

  const backBetType =
    updatedRun.backBetId != null
      ? (db.select().from(bets).where(eq(bets.id, updatedRun.backBetId)).get()?.betType ??
        null)
      : null;
  return { run: updatedRun, selections, backBetType };
}

/** Flip an active combined run to deliberate no lay (Add bet convention). */
export function markBetBuilderNoLay(runId: number): BetBuilderRunRow | null {
  const run = db.select().from(betBuilderRuns).where(eq(betBuilderRuns.id, runId)).get();
  if (
    !run ||
    run.status !== "active" ||
    run.method !== "combined" ||
    run.wholeLayBetId != null
  ) {
    return null;
  }
  if (run.backBetId != null) {
    db.update(bets)
      .set({ layStake: 0, layOdds: 0 })
      .where(and(eq(bets.id, run.backBetId), eq(bets.status, "open")))
      .run();
  }
  return db
    .update(betBuilderRuns)
    .set({ method: "no_lay" })
    .where(eq(betBuilderRuns.id, runId))
    .returning()
    .get();
}

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

function completeRun(
  run: BetBuilderRunRow,
  selections: BetBuilderSelectionRow[],
  anyLost: boolean
) {
  const allVoid = selections.every((s) => s.result === "void");
  const back =
    run.backBetId != null
      ? db.select().from(bets).where(eq(bets.id, run.backBetId)).get()
      : undefined;
  if (anyLost) {
    settleLinkedBet(run.backBetId, "lost", backLostProfit(back, run.stake));
  } else if (allVoid) {
    settleLinkedBet(run.backBetId, "void", 0);
  } else {
    settleLinkedBet(run.backBetId, "won", run.stake * (run.backOdds - 1));
  }
  if (run.wholeLayBetId != null && run.wholeLayStake != null && run.wholeLayOdds != null) {
    if (anyLost) {
      settleLinkedBet(run.wholeLayBetId, "won", run.wholeLayStake * (1 - run.commission));
    } else if (allVoid) {
      settleLinkedBet(run.wholeLayBetId, "void", 0);
    } else {
      settleLinkedBet(run.wholeLayBetId, "lost", -run.wholeLayStake * (run.wholeLayOdds - 1));
    }
  }
  db.update(betBuilderRuns)
    .set({ status: "completed", settledAt: Date.now() })
    .where(eq(betBuilderRuns.id, run.id))
    .run();
}

/**
 * Settle the whole builder as one ticket (all selections share the outcome).
 * Prefer this over per-selection results in the UI.
 */
export function settleBetBuilderRun(
  runId: number,
  result: "won" | "lost" | "void"
): BetBuilderRunRow | null {
  const run = db.select().from(betBuilderRuns).where(eq(betBuilderRuns.id, runId)).get();
  if (!run || run.status !== "active") return null;

  db.update(betBuilderSelections)
    .set({ result })
    .where(eq(betBuilderSelections.runId, runId))
    .run();

  const selections = db
    .select()
    .from(betBuilderSelections)
    .where(eq(betBuilderSelections.runId, runId))
    .all();

  completeRun(run, selections, result === "lost");
  return db.select().from(betBuilderRuns).where(eq(betBuilderRuns.id, runId)).get() ?? null;
}

/** @deprecated Prefer settleBetBuilderRun — kept for incremental selection PATCH. */
export function setBetBuilderSelectionResult(
  selectionId: number,
  result: "won" | "lost" | "void"
): { selection: BetBuilderSelectionRow; runCompleted: boolean } | null {
  const sel = db
    .select()
    .from(betBuilderSelections)
    .where(eq(betBuilderSelections.id, selectionId))
    .get();
  if (!sel || sel.result !== "pending") return null;
  const run = db.select().from(betBuilderRuns).where(eq(betBuilderRuns.id, sel.runId)).get();
  if (!run || run.status !== "active") return null;

  const updated = db
    .update(betBuilderSelections)
    .set({ result })
    .where(eq(betBuilderSelections.id, selectionId))
    .returning()
    .get();

  const selections = db
    .select()
    .from(betBuilderSelections)
    .where(eq(betBuilderSelections.runId, run.id))
    .all();
  const anyLost = selections.some((s) => s.result === "lost");
  const allResolved = selections.every((s) => s.result !== "pending");

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

  if (allResolved && run.status === "active") {
    completeRun(run, selections, anyLost);
    return { selection: updated, runCompleted: true };
  }
  return { selection: updated, runCompleted: false };
}

/** Combined runs awaiting a whole lay, within kick-off lead (or immediate if no time). */
export function betBuilderLayDue(
  nowMs = Date.now(),
  leadMinutes = DEFAULT_LAY_LEAD_MINUTES
): Array<{ runId: number; label: string; suggestedStake: number | null }> {
  const out: Array<{ runId: number; label: string; suggestedStake: number | null }> = [];
  for (const { run } of listBetBuilderRuns()) {
    if (run.status !== "active" || run.method !== "combined" || run.wholeLayBetId != null) {
      continue;
    }
    if (run.muteAlerts) continue;
    if (run.scheduledAt != null && run.scheduledAt - nowMs > leadMinutes * 60_000) continue;
    if (run.scheduledAt != null && run.scheduledAt < nowMs - LAY_DUE_EXPIRY_MS) continue;
    const suggestion =
      run.backOdds > 1
        ? wholeComboLay({
            stake: run.stake,
            combinedOdds: run.backOdds,
            layOdds: run.backOdds,
            commission: run.commission,
          })
        : null;
    out.push({
      runId: run.id,
      label: run.label,
      suggestedStake: suggestion?.layStake ?? null,
    });
  }
  return out;
}

export function maybeBetBuilderLayDueAlerts(
  nowMs = Date.now(),
  leadMinutes = DEFAULT_LAY_LEAD_MINUTES
): number {
  let raised = 0;
  for (const item of betBuilderLayDue(nowMs, leadMinutes)) {
    const alert = {
      key: `bet_builder_lay_due:${item.runId}`,
      kind: "bet_builder_lay_due",
      title:
        item.suggestedStake != null
          ? `Lay bet builder · ~£${item.suggestedStake.toFixed(2)}`
          : "Lay bet builder",
      body: `${item.label} · enter live exchange lay odds on Bet Builder Desk`,
      href: "/bet-builder",
    };
    if (recordAlerts([alert]) > 0) {
      void sendPush(alert).catch(() => {});
      raised += 1;
    }
  }
  return raised;
}

/**
 * Auto-result Bet Builder selections from the run's linked finished event.
 * Same-event ticket: every selection shares `run.eventId` + `run.sport`.
 */
export function autoResultBetBuilderSelections(nowMs = Date.now()): number {
  const active = db
    .select()
    .from(betBuilderRuns)
    .where(eq(betBuilderRuns.status, "active"))
    .all();
  if (active.length === 0) return 0;
  const allEvents = db.select().from(events).all();
  const eventById = new Map<number, EventRow>(allEvents.map((e) => [e.id, e]));
  let resolved = 0;
  for (const run of active) {
    if (run.eventId == null) continue;
    const event = eventById.get(run.eventId);
    if (!event) continue;
    const selections = db
      .select()
      .from(betBuilderSelections)
      .where(eq(betBuilderSelections.runId, run.id))
      .all();
    for (const sel of selections) {
      if (sel.result !== "pending") continue;
      const outcome = deriveDeskLegAutoResult(
        {
          market: sel.market,
          selection: sel.selection,
          sport: run.sport,
        },
        event
      );
      if (outcome == null) continue;
      if (setBetBuilderSelectionResult(sel.id, toBinaryDeskResult(outcome))) {
        resolved += 1;
      }
    }
  }
  if (resolved > 0) void nowMs;
  return resolved;
}

/** Active Bet Builder runs that still need a racing result sync. */
export function pendingBetBuilderRacingEventIds(): number[] {
  return db
    .select()
    .from(betBuilderRuns)
    .where(eq(betBuilderRuns.status, "active"))
    .all()
    .filter(
      (r) =>
        r.eventId != null &&
        (r.sport === "horse_racing" || r.sport === "greyhounds")
    )
    .map((r) => r.eventId!);
}
