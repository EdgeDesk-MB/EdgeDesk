/**
 * Hosted boost diary on Neon. Mirrors src/lib/services/boosts.ts.
 * Settlement uses the same settleFromOutcome maths, then the Neon ledger.
 */
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { roundPence } from "@/lib/calc/money";
import { settleFromOutcome, type BetType, type Market } from "@/lib/calc/settlement";
import { getNeonDb } from "@/lib/db/neon";
import {
  getNeonDeskBet,
  neonDeskClerkUserId,
  patchNeonDeskBet,
} from "@/lib/db/neon-desk";
import { ledgerNeonBetSettlement, logNeonLedgerFailure } from "@/lib/db/neon-desk-ledger";
import {
  boostDiary as pgBoostDiary,
  type BoostDiaryRow as PgBoostDiaryRow,
} from "@/lib/db/schema.pg";
import type { BetRow, BoostDiaryRow } from "@/lib/db/schema";
import {
  boostDiaryStage,
  type BoostDiaryEntry,
  type BoostLinkedBet,
} from "@/lib/services/boosts-client";
import type { CreateBoostDiaryInput } from "@/lib/services/boosts";

export type { BoostDiaryEntry, BoostLinkedBet };

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function toSqliteBoostDiaryRow(row: PgBoostDiaryRow): BoostDiaryRow {
  return {
    id: row.id,
    label: row.label,
    bookmaker: row.bookmaker,
    kind: row.kind,
    boostedOdds: row.boostedOdds,
    fairOdds: row.fairOdds,
    stake: row.stake,
    evGbp: row.evGbp,
    basis: row.basis,
    betId: row.betId,
    layStake: row.layStake,
    layOdds: row.layOdds,
    commission: row.commission,
    exchangeId: row.exchangeId,
    exchangeBack: row.exchangeBack,
    outcome: row.outcome,
    actualProfit: row.actualProfit,
    createdAt: row.createdAt,
    settledAt: row.settledAt,
  };
}

function linkedBetSummary(bet: BetRow | null): BoostLinkedBet | null {
  if (!bet) return null;
  return {
    id: bet.id,
    status: bet.status,
    actualProfit: bet.actualProfit,
    expectedProfit: bet.expectedProfit,
    backStake: bet.backStake,
    backOdds: bet.backOdds,
    layStake: bet.layStake,
    layOdds: bet.layOdds,
    commission: bet.commission,
    bookmaker: bet.bookmaker,
    exchangeId: bet.exchangeId,
    label: bet.label,
  };
}

async function getOwnedDiary(
  id: number,
  clerkUserId: string
): Promise<PgBoostDiaryRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(pgBoostDiary)
    .where(and(eq(pgBoostDiary.id, id), eq(pgBoostDiary.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0] ?? null;
}

async function entryFromRow(
  row: PgBoostDiaryRow,
  clerkUserId: string
): Promise<BoostDiaryEntry> {
  const sqlite = toSqliteBoostDiaryRow(row);
  const bet =
    row.betId != null ? await getNeonDeskBet(row.betId) : null;
  if (row.betId != null && bet && bet.id !== row.betId) {
    // getNeonDeskBet already clerk-scopes; ignore foreign ids.
  }
  void clerkUserId;
  return {
    ...sqlite,
    stage: boostDiaryStage(sqlite),
    linkedBet: linkedBetSummary(bet),
  };
}

export async function createNeonBoostDiary(
  input: CreateBoostDiaryInput
): Promise<BoostDiaryRow> {
  const clerkUserId = requireClerk("save a boost");
  const rows = await getNeonDb()
    .insert(pgBoostDiary)
    .values({
      label: input.label.trim(),
      bookmaker: input.bookmaker?.trim() || null,
      kind: input.kind,
      boostedOdds: input.boostedOdds,
      fairOdds: input.fairOdds,
      stake: roundPence(input.stake),
      evGbp: roundPence(input.evGbp),
      basis: input.basis,
      layStake:
        input.layStake != null && Number.isFinite(input.layStake)
          ? roundPence(input.layStake)
          : null,
      layOdds:
        input.layOdds != null && Number.isFinite(input.layOdds) && input.layOdds > 1
          ? input.layOdds
          : null,
      commission:
        input.commission != null && Number.isFinite(input.commission)
          ? input.commission
          : null,
      exchangeId: input.exchangeId ?? null,
      exchangeBack:
        input.exchangeBack != null &&
        Number.isFinite(input.exchangeBack) &&
        input.exchangeBack > 1
          ? input.exchangeBack
          : null,
      createdAt: Date.now(),
      clerkUserId,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Neon did not return the saved boost.");
  return toSqliteBoostDiaryRow(row);
}

export async function listNeonBoostDiary(): Promise<BoostDiaryEntry[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgBoostDiary)
    .where(eq(pgBoostDiary.clerkUserId, clerkUserId))
    .orderBy(desc(pgBoostDiary.createdAt));
  const entries: BoostDiaryEntry[] = [];
  for (const row of rows) {
    entries.push(await entryFromRow(row, clerkUserId));
  }
  return entries;
}

export async function getNeonBoostDiary(id: number): Promise<BoostDiaryEntry | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const row = await getOwnedDiary(id, clerkUserId);
  if (!row) return null;
  return entryFromRow(row, clerkUserId);
}

export async function linkNeonBoostDiaryBet(
  diaryId: number,
  betId: number
): Promise<BoostDiaryRow | null> {
  const clerkUserId = requireClerk("link a boost");
  const existing = await getOwnedDiary(diaryId, clerkUserId);
  if (!existing) return null;
  const bet = await getNeonDeskBet(betId);
  if (!bet) return null;
  const rows = await getNeonDb()
    .update(pgBoostDiary)
    .set({ betId })
    .where(and(eq(pgBoostDiary.id, diaryId), eq(pgBoostDiary.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteBoostDiaryRow(rows[0]) : null;
}

export async function unlinkNeonBoostDiaryForBet(betId: number): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  await getNeonDb()
    .update(pgBoostDiary)
    .set({
      betId: null,
      outcome: null,
      actualProfit: null,
      settledAt: null,
    })
    .where(
      and(eq(pgBoostDiary.betId, betId), eq(pgBoostDiary.clerkUserId, clerkUserId))
    );
}

function diaryOutcomeFromBet(
  bet: BetRow
): { outcome: "won" | "lost" | "void"; actualProfit: number; settledAt: number } | null {
  if (bet.status === "open") return null;
  const outcome =
    bet.status === "won" || bet.status === "early_payout"
      ? ("won" as const)
      : bet.status === "lost"
        ? ("lost" as const)
        : bet.status === "void" || bet.status === "push"
          ? ("void" as const)
          : null;
  if (!outcome) return null;
  return {
    outcome,
    actualProfit: bet.actualProfit ?? 0,
    settledAt: bet.settledAt ?? Date.now(),
  };
}

export async function syncNeonBoostDiaryFromBet(bet: BetRow): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  const rows = await getNeonDb()
    .select()
    .from(pgBoostDiary)
    .where(and(eq(pgBoostDiary.betId, bet.id), eq(pgBoostDiary.clerkUserId, clerkUserId)))
    .limit(1);
  const row = rows[0];
  if (!row) return;
  if (bet.status === "open") {
    await getNeonDb()
      .update(pgBoostDiary)
      .set({ outcome: null, actualProfit: null, settledAt: null })
      .where(and(eq(pgBoostDiary.id, row.id), eq(pgBoostDiary.clerkUserId, clerkUserId)));
    return;
  }
  const mirrored = diaryOutcomeFromBet(bet);
  if (!mirrored) return;
  await getNeonDb()
    .update(pgBoostDiary)
    .set(mirrored)
    .where(and(eq(pgBoostDiary.id, row.id), eq(pgBoostDiary.clerkUserId, clerkUserId)));
}

export async function settleNeonBoostDiary(
  diaryId: number,
  outcome: "won" | "lost" | "void"
): Promise<{ entry: BoostDiaryEntry; bet: BetRow } | { error: string; status: number }> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return { error: "Sign in to settle a boost", status: 401 };
  const existing = await getOwnedDiary(diaryId, clerkUserId);
  if (!existing) return { error: "Not found", status: 404 };
  if (existing.betId == null) {
    return {
      error: "Place the bet first — settlement only applies to committed bets",
      status: 400,
    };
  }
  const bet = await getNeonDeskBet(existing.betId);
  if (!bet) return { error: "Linked bet not found", status: 404 };

  let status: BetRow["status"];
  let actualProfit: number;
  if (outcome === "void") {
    status = "void";
    actualProfit = 0;
  } else {
    const settled = settleFromOutcome(
      {
        market: bet.market as Market,
        selection: bet.selection,
        betType: (bet.betType === "boost" ? "boost" : bet.betType) as BetType,
        backStake: bet.backStake,
        backOdds: bet.backOdds,
        layStake: bet.layStake,
        layOdds: bet.layOdds,
        commission: bet.commission,
      },
      outcome === "won"
    );
    status = settled.status;
    actualProfit = roundPence(settled.profit);
  }

  const updated = await patchNeonDeskBet(bet.id, {
    status,
    actualProfit,
    settledAt: Date.now(),
  });
  if (!updated) return { error: "Linked bet not found", status: 404 };
  await ledgerNeonBetSettlement(updated).catch((error) => {
    logNeonLedgerFailure("settlement", updated.id, error);
  });
  await syncNeonBoostDiaryFromBet(updated);
  const entry = await getNeonBoostDiary(diaryId);
  if (!entry) return { error: "Not found", status: 404 };
  return { entry, bet: updated };
}

export async function deleteNeonBoostDiary(id: number): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const existing = await getOwnedDiary(id, clerkUserId);
  if (!existing) return false;
  await getNeonDb()
    .delete(pgBoostDiary)
    .where(and(eq(pgBoostDiary.id, id), eq(pgBoostDiary.clerkUserId, clerkUserId)));
  return true;
}

export async function countNeonBoostsNeedingAction(): Promise<number> {
  const entries = await listNeonBoostDiary();
  let n = 0;
  for (const row of entries) {
    if (row.betId == null) {
      n += 1;
      continue;
    }
    if (row.linkedBet?.status === "open") n += 1;
  }
  return n;
}
