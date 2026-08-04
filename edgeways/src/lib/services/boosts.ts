import { desc, eq } from "drizzle-orm";
import { db, bets, boostDiary, type BetRow, type BoostDiaryRow } from "@/lib/db";
import { roundPence } from "@/lib/calc/money";
import { settleFromOutcome, type BetType, type Market } from "@/lib/calc/settlement";
import { ledgerFromSettledBet } from "@/lib/services/balances";
import {
  boostDiaryStage,
  type BoostDiaryEntry,
  type BoostLinkedBet,
} from "@/lib/services/boosts-client";

export type { BoostDiaryEntry, BoostLinkedBet };

export type CreateBoostDiaryInput = {
  label: string;
  bookmaker?: string | null;
  kind: "boost" | "builder";
  boostedOdds: number;
  fairOdds: number;
  stake: number;
  evGbp: number;
  basis: "estimated" | "heuristic";
  layStake?: number | null;
  layOdds?: number | null;
  commission?: number | null;
  exchangeId?: number | null;
  exchangeBack?: number | null;
};

export function createBoostDiary(input: CreateBoostDiaryInput): BoostDiaryRow {
  return db
    .insert(boostDiary)
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
        input.exchangeBack != null && Number.isFinite(input.exchangeBack) && input.exchangeBack > 1
          ? input.exchangeBack
          : null,
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

function linkedBetSummary(betId: number | null): BoostLinkedBet | null {
  if (betId == null) return null;
  const bet = db.select().from(bets).where(eq(bets.id, betId)).get();
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

export function listBoostDiary(): BoostDiaryEntry[] {
  return db
    .select()
    .from(boostDiary)
    .orderBy(desc(boostDiary.createdAt))
    .all()
    .map((row) => ({
      ...row,
      stage: boostDiaryStage(row),
      linkedBet: linkedBetSummary(row.betId),
    }));
}

export function getBoostDiary(id: number): BoostDiaryEntry | null {
  const row = db.select().from(boostDiary).where(eq(boostDiary.id, id)).get();
  if (!row) return null;
  return {
    ...row,
    stage: boostDiaryStage(row),
    linkedBet: linkedBetSummary(row.betId),
  };
}

/** Link a diary row to a newly created bet (Place bet → Add bet confirm). */
export function linkBoostDiaryBet(diaryId: number, betId: number): BoostDiaryRow | null {
  const existing = db.select().from(boostDiary).where(eq(boostDiary.id, diaryId)).get();
  if (!existing) return null;
  const bet = db.select().from(bets).where(eq(bets.id, betId)).get();
  if (!bet) return null;
  return db
    .update(boostDiary)
    .set({ betId })
    .where(eq(boostDiary.id, diaryId))
    .returning()
    .get();
}

/** When a bet is deleted, leave the diary as Logged again. */
export function unlinkBoostDiaryForBet(betId: number): void {
  db.update(boostDiary)
    .set({
      betId: null,
      outcome: null,
      actualProfit: null,
      settledAt: null,
    })
    .where(eq(boostDiary.betId, betId))
    .run();
}

/** Mirror bet settlement onto the diary row for Boosts-page display. */
export function syncBoostDiaryFromBet(bet: BetRow): void {
  const row = db.select().from(boostDiary).where(eq(boostDiary.betId, bet.id)).get();
  if (!row) return;
  if (bet.status === "open") {
    db.update(boostDiary)
      .set({ outcome: null, actualProfit: null, settledAt: null })
      .where(eq(boostDiary.id, row.id))
      .run();
    return;
  }
  const outcome =
    bet.status === "won" || bet.status === "early_payout"
      ? ("won" as const)
      : bet.status === "lost"
        ? ("lost" as const)
        : bet.status === "void" || bet.status === "push"
          ? ("void" as const)
          : null;
  if (!outcome) return;
  db.update(boostDiary)
    .set({
      outcome,
      actualProfit: bet.actualProfit ?? 0,
      settledAt: bet.settledAt ?? Date.now(),
    })
    .where(eq(boostDiary.id, row.id))
    .run();
}

/**
 * Settle the linked bet from the Boosts page. Logged-only rows cannot settle
 * (no paper-trading — J2b).
 */
export function settleBoostDiary(
  diaryId: number,
  outcome: "won" | "lost" | "void"
): { entry: BoostDiaryEntry; bet: BetRow } | { error: string; status: number } {
  const existing = db.select().from(boostDiary).where(eq(boostDiary.id, diaryId)).get();
  if (!existing) return { error: "Not found", status: 404 };
  if (existing.betId == null) {
    return {
      error: "Place the bet first — settlement only applies to committed bets",
      status: 400,
    };
  }
  const bet = db.select().from(bets).where(eq(bets.id, existing.betId)).get();
  if (!bet) {
    return { error: "Linked bet not found", status: 404 };
  }

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

  const updated = db
    .update(bets)
    .set({
      status,
      actualProfit,
      settledAt: Date.now(),
    })
    .where(eq(bets.id, bet.id))
    .returning()
    .get();

  ledgerFromSettledBet(updated);
  syncBoostDiaryFromBet(updated);
  const entry = getBoostDiary(diaryId);
  if (!entry) return { error: "Not found", status: 404 };
  return { entry, bet: updated };
}

export function deleteBoostDiary(id: number): boolean {
  const existing = db.select().from(boostDiary).where(eq(boostDiary.id, id)).get();
  if (!existing) return false;
  // Diary delete does not delete the linked bet (Tracker still owns money).
  db.delete(boostDiary).where(eq(boostDiary.id, id)).run();
  return true;
}

/** Open Logged rows, or Placed rows whose linked bet is still open. */
export function countBoostsNeedingAction(): number {
  const rows = db.select().from(boostDiary).all();
  let n = 0;
  for (const row of rows) {
    if (row.betId == null) {
      n += 1;
      continue;
    }
    const bet = db.select().from(bets).where(eq(bets.id, row.betId)).get();
    if (bet?.status === "open") n += 1;
  }
  return n;
}
