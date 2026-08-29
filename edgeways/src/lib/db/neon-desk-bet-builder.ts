/**
 * Hosted Bet Builder Desk on Neon. Mirrors src/lib/services/bet-builder-desk.ts.
 * Desk orchestrates; tracker owns money via insertNeonDeskBet + the Neon ledger.
 */
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { betBuilderRunMoneyLocked } from "@/lib/bet-builder/bet-builder-run-edit";
import {
  DEFAULT_LAY_LEAD_MINUTES,
  LAY_DUE_EXPIRY_MS,
  wholeComboLay,
} from "@/lib/calc/bet-builder-workflow";
import { roundPence } from "@/lib/calc/money";
import { getNeonDb } from "@/lib/db/neon";
import {
  deleteNeonDeskBet,
  getNeonDeskBet,
  insertNeonDeskBet,
  listNeonDeskBets,
  neonDeskClerkUserId,
  patchNeonDeskBet,
} from "@/lib/db/neon-desk";
import {
  ledgerNeonBetPlacement,
  ledgerNeonBetSettlement,
  logNeonLedgerFailure,
  purgeNeonDeskLedgerForBet,
  reledgerNeonOpenBetPlacement,
} from "@/lib/db/neon-desk-ledger";
import {
  betBuilderRuns as pgBetBuilderRuns,
  betBuilderSelections as pgBetBuilderSelections,
  type BetBuilderRunRow as PgBetBuilderRunRow,
  type BetBuilderSelectionRow as PgBetBuilderSelectionRow,
} from "@/lib/db/schema.pg";
import { listNeonInboxDedupes, recordNeonAlerts } from "@/lib/db/neon-alerts-inbox";
import type {
  BetBuilderRunRow,
  BetBuilderSelectionRow,
  BetRow,
  EventRow,
} from "@/lib/db/schema";
import {
  deriveDeskLegAutoResult,
  toBinaryDeskResult,
} from "@/lib/desk/leg-auto-result";
import { sendPush } from "@/lib/services/push";
import {
  deskBackBetLabel,
  isDeskFreeBetType,
  normaliseDeskBackBetType,
} from "@/lib/desk/desk-back-bet-type";
import type {
  CreateBetBuilderRunInput,
  UpdateBetBuilderRunInput,
} from "@/lib/services/bet-builder-desk";
import type { AppState } from "@/lib/services/state.types";

export type NeonBetBuilderBundle = {
  run: BetBuilderRunRow;
  selections: BetBuilderSelectionRow[];
  backBetType: string | null;
};

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function toSqliteRun(row: PgBetBuilderRunRow): BetBuilderRunRow {
  return {
    id: row.id,
    offerId: row.offerId,
    label: row.label,
    method: row.method,
    stake: row.stake,
    bookmaker: row.bookmaker,
    commission: row.commission,
    backOdds: row.backOdds,
    backBetId: row.backBetId,
    wholeLayBetId: row.wholeLayBetId,
    wholeLayStake: row.wholeLayStake,
    wholeLayOdds: row.wholeLayOdds,
    eventLabel: row.eventLabel,
    eventId: row.eventId,
    sport: row.sport,
    scheduledAt: row.scheduledAt,
    muteAlerts: row.muteAlerts,
    status: row.status,
    createdAt: row.createdAt,
    settledAt: row.settledAt,
  };
}

function toSqliteSelection(row: PgBetBuilderSelectionRow): BetBuilderSelectionRow {
  return {
    id: row.id,
    runId: row.runId,
    seq: row.seq,
    label: row.label,
    market: row.market,
    selection: row.selection,
    result: row.result,
  };
}

async function getOwnedRun(
  id: number,
  clerkUserId: string
): Promise<PgBetBuilderRunRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(pgBetBuilderRuns)
    .where(and(eq(pgBetBuilderRuns.id, id), eq(pgBetBuilderRuns.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0] ?? null;
}

async function listOwnedSelections(
  runId: number,
  clerkUserId: string
): Promise<BetBuilderSelectionRow[]> {
  const rows = await getNeonDb()
    .select()
    .from(pgBetBuilderSelections)
    .where(
      and(
        eq(pgBetBuilderSelections.runId, runId),
        eq(pgBetBuilderSelections.clerkUserId, clerkUserId)
      )
    );
  return rows.map(toSqliteSelection).sort((a, b) => a.seq - b.seq);
}

async function bundleFromRun(
  row: PgBetBuilderRunRow,
  clerkUserId: string,
  betById?: Map<number, BetRow>
): Promise<NeonBetBuilderBundle> {
  const selections = await listOwnedSelections(row.id, clerkUserId);
  const back =
    row.backBetId != null
      ? (betById?.get(row.backBetId) ?? (await getNeonDeskBet(row.backBetId)))
      : null;
  return {
    run: toSqliteRun(row),
    selections,
    backBetType: back?.betType ?? null,
  };
}

function bbNotes(isNoLay: boolean, isFree: boolean): string {
  if (isNoLay) {
    return isFree
      ? "Bet Builder desk free-bet convert - no lay"
      : "Bet Builder desk - no lay";
  }
  return isFree
    ? "Bet Builder desk free-bet convert - combined lay"
    : "Bet Builder desk - combined lay";
}

function backLostProfit(back: Pick<BetRow, "betType"> | undefined, stake: number): number {
  if (back?.betType === "free_snr" || back?.betType === "free_sr") return 0;
  return -stake;
}

async function settleLinkedNeonBet(
  betId: number | null,
  status: "won" | "lost" | "void",
  profit: number
): Promise<void> {
  if (betId == null) return;
  const bet = await getNeonDeskBet(betId);
  if (!bet || bet.status !== "open") return;
  const updated = await patchNeonDeskBet(betId, {
    status,
    actualProfit: roundPence(profit),
    settledAt: Date.now(),
  });
  if (!updated) return;
  await ledgerNeonBetSettlement(updated).catch((error) => {
    logNeonLedgerFailure("settlement", updated.id, error);
  });
}

async function completeNeonRun(
  run: BetBuilderRunRow,
  selections: BetBuilderSelectionRow[],
  anyLost: boolean,
  clerkUserId: string
): Promise<void> {
  const allVoid = selections.every((s) => s.result === "void");
  const back =
    run.backBetId != null ? await getNeonDeskBet(run.backBetId) : undefined;
  if (anyLost) {
    await settleLinkedNeonBet(run.backBetId, "lost", backLostProfit(back ?? undefined, run.stake));
  } else if (allVoid) {
    await settleLinkedNeonBet(run.backBetId, "void", 0);
  } else {
    await settleLinkedNeonBet(run.backBetId, "won", run.stake * (run.backOdds - 1));
  }
  if (run.wholeLayBetId != null && run.wholeLayStake != null && run.wholeLayOdds != null) {
    if (anyLost) {
      await settleLinkedNeonBet(
        run.wholeLayBetId,
        "won",
        run.wholeLayStake * (1 - run.commission)
      );
    } else if (allVoid) {
      await settleLinkedNeonBet(run.wholeLayBetId, "void", 0);
    } else {
      await settleLinkedNeonBet(
        run.wholeLayBetId,
        "lost",
        -run.wholeLayStake * (run.wholeLayOdds - 1)
      );
    }
  }
  await getNeonDb()
    .update(pgBetBuilderRuns)
    .set({ status: "completed", settledAt: Date.now() })
    .where(
      and(eq(pgBetBuilderRuns.id, run.id), eq(pgBetBuilderRuns.clerkUserId, clerkUserId))
    );
}

export async function listNeonBetBuilderRuns(): Promise<NeonBetBuilderBundle[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgBetBuilderRuns)
    .where(eq(pgBetBuilderRuns.clerkUserId, clerkUserId))
    .orderBy(desc(pgBetBuilderRuns.createdAt));
  if (rows.length === 0) return [];
  const bets = await listNeonDeskBets(clerkUserId);
  const betById = new Map(bets.map((b) => [b.id, b]));
  const bundles: NeonBetBuilderBundle[] = [];
  for (const row of rows) {
    bundles.push(await bundleFromRun(row, clerkUserId, betById));
  }
  return bundles;
}

export async function createNeonBetBuilderRun(
  input: CreateBetBuilderRunInput
): Promise<{ run: BetBuilderRunRow; selections: BetBuilderSelectionRow[] }> {
  const clerkUserId = requireClerk("save a bet builder");
  const now = Date.now();
  const backBetType = normaliseDeskBackBetType(input.backBetType);
  const isFree = isDeskFreeBetType(backBetType);
  const isNoLay = input.method === "no_lay";
  const backOdds = Number(input.backOdds.toFixed(4));
  const sport = input.sport?.trim() || null;
  const eventId = input.eventId ?? null;

  const backBet = await insertNeonDeskBet({
    label: deskBackBetLabel("BB", input.label, backBetType),
    market: "other",
    selection: "",
    betType: backBetType,
    bookmaker: input.bookmaker ?? undefined,
    backStake: input.stake,
    backOdds,
    layStake: 0,
    layOdds: 0,
    commission: 0,
    earlyPayout: 0,
    offerId: input.offerId ?? null,
    eventId,
    sport,
    notes: bbNotes(isNoLay, isFree),
    createdAt: now,
  });
  await ledgerNeonBetPlacement(backBet).catch((error) => {
    logNeonLedgerFailure("placement", backBet.id, error);
  });

  let run: PgBetBuilderRunRow;
  const selections: BetBuilderSelectionRow[] = [];
  try {
    const inserted = await getNeonDb()
      .insert(pgBetBuilderRuns)
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
        clerkUserId,
      })
      .returning();
    if (!inserted[0]) throw new Error("Neon did not return the bet builder.");
    run = inserted[0];

    for (let i = 0; i < input.selections.length; i++) {
      const s = input.selections[i]!;
      const selRows = await getNeonDb()
        .insert(pgBetBuilderSelections)
        .values({
          runId: run.id,
          seq: i + 1,
          label: s.label,
          market: s.market ?? null,
          selection: s.selection ?? null,
          clerkUserId,
        })
        .returning();
      if (selRows[0]) selections.push(toSqliteSelection(selRows[0]));
    }
  } catch (error) {
    await purgeNeonDeskLedgerForBet(backBet.id).catch(() => {});
    await deleteNeonDeskBet(backBet.id).catch(() => {});
    throw error;
  }

  const lay = input.wholeLay;
  if (!isNoLay && lay != null && lay.layOdds > 1 && lay.layStake > 0) {
    const laid = await logNeonBetBuilderWholeLay(
      run.id,
      lay.layOdds,
      lay.layStake,
      lay.exchangeId
    );
    if (laid) return { run: laid, selections };
  }

  return { run: toSqliteRun(run), selections };
}

export async function logNeonBetBuilderWholeLay(
  runId: number,
  layOdds: number,
  layStake: number,
  exchangeId?: number | null
): Promise<BetBuilderRunRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const run = await getOwnedRun(runId, clerkUserId);
  if (!run || run.method !== "combined" || run.wholeLayBetId != null || run.status !== "active") {
    return null;
  }
  const layBet = await insertNeonDeskBet({
    label: `BB lay · ${run.label}`,
    market: "other",
    selection: "",
    betType: "lay_only",
    exchangeId: exchangeId ?? undefined,
    offerId: run.offerId ?? null,
    bookmaker: run.bookmaker ?? undefined,
    backStake: 0,
    backOdds: 0,
    layStake,
    layOdds,
    commission: run.commission,
    earlyPayout: 0,
    notes: `Bet Builder desk: combined lay for "${run.label}"`,
    createdAt: Date.now(),
  });
  await ledgerNeonBetPlacement(layBet).catch((error) => {
    logNeonLedgerFailure("placement", layBet.id, error);
  });
  const rows = await getNeonDb()
    .update(pgBetBuilderRuns)
    .set({ wholeLayBetId: layBet.id, wholeLayStake: layStake, wholeLayOdds: layOdds })
    .where(and(eq(pgBetBuilderRuns.id, runId), eq(pgBetBuilderRuns.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteRun(rows[0]) : null;
}

export async function markNeonBetBuilderNoLay(
  runId: number
): Promise<BetBuilderRunRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const run = await getOwnedRun(runId, clerkUserId);
  if (
    !run ||
    run.status !== "active" ||
    run.method !== "combined" ||
    run.wholeLayBetId != null
  ) {
    return null;
  }
  if (run.backBetId != null) {
    const back = await getNeonDeskBet(run.backBetId);
    if (back?.status === "open") {
      await patchNeonDeskBet(back.id, { layStake: 0, layOdds: 0 });
    }
  }
  const rows = await getNeonDb()
    .update(pgBetBuilderRuns)
    .set({ method: "no_lay" })
    .where(and(eq(pgBetBuilderRuns.id, runId), eq(pgBetBuilderRuns.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteRun(rows[0]) : null;
}

export async function updateNeonBetBuilderRun(
  runId: number,
  input: UpdateBetBuilderRunInput
): Promise<NeonBetBuilderBundle | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const run = await getOwnedRun(runId, clerkUserId);
  if (!run) return null;
  const existing = await listOwnedSelections(runId, clerkUserId);
  const sqliteRun = toSqliteRun(run);
  const moneyLocked = betBuilderRunMoneyLocked(sqliteRun, existing);

  const label = input.label.trim();
  if (!label) return null;
  const bookmaker =
    input.bookmaker === undefined ? run.bookmaker : input.bookmaker?.trim() || null;
  const eventLabel =
    input.eventLabel === undefined ? run.eventLabel : input.eventLabel?.trim() || null;
  const eventId = input.eventId === undefined ? run.eventId : input.eventId;
  const sport = input.sport === undefined ? run.sport : input.sport?.trim() || null;
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

  const updatedRows = await getNeonDb()
    .update(pgBetBuilderRuns)
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
    .where(and(eq(pgBetBuilderRuns.id, runId), eq(pgBetBuilderRuns.clerkUserId, clerkUserId)))
    .returning();
  const updatedRun = updatedRows[0];
  if (!updatedRun) return null;

  if (!moneyLocked) {
    const keepIds = new Set(
      cleaned.map((s) => s.id).filter((id): id is number => id != null)
    );
    for (const prev of existing) {
      if (!keepIds.has(prev.id)) {
        await getNeonDb()
          .delete(pgBetBuilderSelections)
          .where(
            and(
              eq(pgBetBuilderSelections.id, prev.id),
              eq(pgBetBuilderSelections.clerkUserId, clerkUserId)
            )
          );
      }
    }
    for (let i = 0; i < cleaned.length; i++) {
      const sel = cleaned[i]!;
      const seq = i + 1;
      if (sel.id != null) {
        await getNeonDb()
          .update(pgBetBuilderSelections)
          .set({
            seq,
            label: sel.label,
            market: sel.market,
            selection: sel.selection,
          })
          .where(
            and(
              eq(pgBetBuilderSelections.id, sel.id),
              eq(pgBetBuilderSelections.clerkUserId, clerkUserId)
            )
          );
      } else {
        await getNeonDb()
          .insert(pgBetBuilderSelections)
          .values({
            runId,
            seq,
            label: sel.label,
            market: sel.market,
            selection: sel.selection,
            clerkUserId,
          });
      }
    }
  } else {
    for (const sel of cleaned) {
      await getNeonDb()
        .update(pgBetBuilderSelections)
        .set({
          label: sel.label,
          market: sel.market,
          selection: sel.selection,
        })
        .where(
          and(
            eq(pgBetBuilderSelections.id, sel.id!),
            eq(pgBetBuilderSelections.clerkUserId, clerkUserId)
          )
        );
    }
  }

  const selections = await listOwnedSelections(runId, clerkUserId);

  if (updatedRun.backBetId != null) {
    const back = await getNeonDeskBet(updatedRun.backBetId);
    if (back) {
      const nextBetType =
        !moneyLocked && input.backBetType != null
          ? normaliseDeskBackBetType(input.backBetType)
          : back.betType;
      const patch: Parameters<typeof patchNeonDeskBet>[1] = {
        label: deskBackBetLabel("BB", label, nextBetType),
        bookmaker,
        eventId,
        sport,
      };
      if (back.status === "open" && !moneyLocked) {
        patch.backStake = stake;
        patch.backOdds = backOdds;
        patch.betType = nextBetType;
      }
      const next = await patchNeonDeskBet(back.id, patch);
      if (
        next &&
        back.status === "open" &&
        (back.bookmaker !== bookmaker ||
          back.betType !== next.betType ||
          (!moneyLocked &&
            (back.backStake !== stake || back.backOdds !== backOdds)))
      ) {
        await reledgerNeonOpenBetPlacement(next);
      }
    }
  }
  if (updatedRun.wholeLayBetId != null) {
    await patchNeonDeskBet(updatedRun.wholeLayBetId, {
      label: `BB lay · ${label}`,
      bookmaker,
      ...(moneyLocked ? {} : { commission }),
    });
  }

  return bundleFromRun(updatedRun, clerkUserId);
}

export async function settleNeonBetBuilderRun(
  runId: number,
  result: "won" | "lost" | "void"
): Promise<BetBuilderRunRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const run = await getOwnedRun(runId, clerkUserId);
  if (!run || run.status !== "active") return null;

  await getNeonDb()
    .update(pgBetBuilderSelections)
    .set({ result })
    .where(
      and(
        eq(pgBetBuilderSelections.runId, runId),
        eq(pgBetBuilderSelections.clerkUserId, clerkUserId)
      )
    );

  const selections = await listOwnedSelections(runId, clerkUserId);
  await completeNeonRun(toSqliteRun(run), selections, result === "lost", clerkUserId);
  const done = await getOwnedRun(runId, clerkUserId);
  return done ? toSqliteRun(done) : null;
}

export async function setNeonBetBuilderSelectionResult(
  selectionId: number,
  result: "won" | "lost" | "void"
): Promise<{ selection: BetBuilderSelectionRow; runCompleted: boolean } | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const selRows = await getNeonDb()
    .select()
    .from(pgBetBuilderSelections)
    .where(
      and(
        eq(pgBetBuilderSelections.id, selectionId),
        eq(pgBetBuilderSelections.clerkUserId, clerkUserId)
      )
    )
    .limit(1);
  const sel = selRows[0];
  if (!sel || sel.result !== "pending") return null;
  const run = await getOwnedRun(sel.runId, clerkUserId);
  if (!run || run.status !== "active") return null;

  const updatedRows = await getNeonDb()
    .update(pgBetBuilderSelections)
    .set({ result })
    .where(
      and(
        eq(pgBetBuilderSelections.id, selectionId),
        eq(pgBetBuilderSelections.clerkUserId, clerkUserId)
      )
    )
    .returning();
  const updated = updatedRows[0];
  if (!updated) return null;

  const selections = await listOwnedSelections(run.id, clerkUserId);
  const anyLost = selections.some((s) => s.result === "lost");
  const allResolved = selections.every((s) => s.result !== "pending");

  if (anyLost) {
    const back =
      run.backBetId != null ? await getNeonDeskBet(run.backBetId) : undefined;
    await settleLinkedNeonBet(
      run.backBetId,
      "lost",
      backLostProfit(back ?? undefined, run.stake)
    );
    if (run.wholeLayBetId != null && run.wholeLayStake != null) {
      await settleLinkedNeonBet(
        run.wholeLayBetId,
        "won",
        run.wholeLayStake * (1 - run.commission)
      );
    }
  }

  if (allResolved && run.status === "active") {
    await completeNeonRun(toSqliteRun(run), selections, anyLost, clerkUserId);
    return { selection: toSqliteSelection(updated), runCompleted: true };
  }
  return { selection: toSqliteSelection(updated), runCompleted: false };
}

export async function patchNeonBetBuilderRunFlags(
  runId: number,
  patch: { muteAlerts?: boolean; status?: "abandoned" }
): Promise<BetBuilderRunRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const existing = await getOwnedRun(runId, clerkUserId);
  if (!existing) return null;
  const rows = await getNeonDb()
    .update(pgBetBuilderRuns)
    .set({
      ...(patch.muteAlerts !== undefined ? { muteAlerts: patch.muteAlerts ? 1 : 0 } : {}),
      ...(patch.status ? { status: patch.status } : {}),
    })
    .where(and(eq(pgBetBuilderRuns.id, runId), eq(pgBetBuilderRuns.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteRun(rows[0]) : null;
}

export async function deleteNeonBetBuilderRun(runId: number): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const run = await getOwnedRun(runId, clerkUserId);
  if (!run) return false;
  const linkedBetIds = [run.backBetId, run.wholeLayBetId].filter(
    (x): x is number => x != null
  );
  for (const betId of linkedBetIds) {
    await settleLinkedNeonBet(betId, "void", 0);
  }
  await getNeonDb()
    .delete(pgBetBuilderSelections)
    .where(
      and(
        eq(pgBetBuilderSelections.runId, runId),
        eq(pgBetBuilderSelections.clerkUserId, clerkUserId)
      )
    );
  await getNeonDb()
    .delete(pgBetBuilderRuns)
    .where(and(eq(pgBetBuilderRuns.id, runId), eq(pgBetBuilderRuns.clerkUserId, clerkUserId)));
  return true;
}

/** Combined runs awaiting a whole lay, same shape as AppState.betBuilderLayDue. */
export async function betBuilderLayDueForState(
  nowMs = Date.now(),
  leadMinutes = DEFAULT_LAY_LEAD_MINUTES
): Promise<AppState["betBuilderLayDue"]> {
  const out: AppState["betBuilderLayDue"] = [];
  for (const { run } of await listNeonBetBuilderRuns()) {
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

export async function autoResultNeonBetBuilderSelections(
  events: EventRow[]
): Promise<number> {
  const eventById = new Map(events.map((e) => [e.id, e]));
  let resolved = 0;
  for (const { run, selections } of await listNeonBetBuilderRuns()) {
    if (run.status !== "active" || run.eventId == null) continue;
    const event = eventById.get(run.eventId);
    if (!event) continue;
    for (const sel of selections) {
      if (sel.result !== "pending") continue;
      const outcome = deriveDeskLegAutoResult(
        { market: sel.market, selection: sel.selection, sport: run.sport },
        event
      );
      if (outcome == null) continue;
      if (await setNeonBetBuilderSelectionResult(sel.id, toBinaryDeskResult(outcome))) {
        resolved += 1;
      }
    }
  }
  return resolved;
}

export async function raiseNeonBetBuilderLayDueAlerts(
  nowMs = Date.now()
): Promise<number> {
  const seen = new Set(await listNeonInboxDedupes());
  let raised = 0;
  for (const item of await betBuilderLayDueForState(nowMs)) {
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
    if (seen.has(alert.key)) continue;
    await recordNeonAlerts([alert]);
    seen.add(alert.key);
    void sendPush(alert).catch(() => {});
    raised += 1;
  }
  return raised;
}
