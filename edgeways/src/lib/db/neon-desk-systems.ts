/**
 * Hosted Systems Desk on Neon. Mirrors src/lib/services/systems-desk.ts.
 * Desk orchestrates; the tracker owns money via one back bet row.
 */
import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { roundPence } from "@/lib/calc/money";
import {
  previewSystemStructure,
  settleSystemReturns,
  systemRequiredLegs,
  systemStructureLabel,
} from "@/lib/calc/systems-settle";
import { getNeonDb } from "@/lib/db/neon";
import {
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
  reledgerNeonOpenBetPlacement,
} from "@/lib/db/neon-desk-ledger";
import {
  systemLegs as pgSystemLegs,
  systemRuns as pgSystemRuns,
  type SystemLegRow as PgSystemLegRow,
  type SystemRunRow as PgSystemRunRow,
} from "@/lib/db/schema.pg";
import type { EventRow, SystemLegRow, SystemRunRow } from "@/lib/db/schema";
import { deriveDeskLegAutoResult } from "@/lib/desk/leg-auto-result";
import {
  deskBackBetLabel,
  isDeskFreeBetType,
  normaliseDeskBackBetType,
  primarySportFromLegs,
} from "@/lib/desk/desk-back-bet-type";
import {
  systemRunMoneyLocked,
  type CreateSystemRunInput,
  type SystemClassification,
  type UpdateSystemRunInput,
} from "@/lib/services/systems-desk";

export { systemRunMoneyLocked };
export type { CreateSystemRunInput, SystemClassification, UpdateSystemRunInput };

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function toSqliteRun(row: PgSystemRunRow): SystemRunRow {
  return {
    id: row.id,
    offerId: row.offerId,
    label: row.label,
    structure: row.structure,
    unitStake: row.unitStake,
    lines: row.lines,
    totalStake: row.totalStake,
    eachWay: row.eachWay,
    placeFraction: row.placeFraction,
    bookmaker: row.bookmaker,
    classification: row.classification,
    backBetId: row.backBetId,
    status: row.status,
    createdAt: row.createdAt,
    settledAt: row.settledAt,
  };
}

function toSqliteLeg(row: PgSystemLegRow): SystemLegRow {
  return {
    id: row.id,
    runId: row.runId,
    seq: row.seq,
    label: row.label,
    eventId: row.eventId,
    sport: row.sport,
    market: row.market,
    selection: row.selection,
    oddsDecimal: row.oddsDecimal,
    result: row.result,
    scheduledAt: row.scheduledAt,
  };
}

async function getOwnedRun(
  id: number,
  clerkUserId: string
): Promise<PgSystemRunRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(pgSystemRuns)
    .where(and(eq(pgSystemRuns.id, id), eq(pgSystemRuns.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0] ?? null;
}

async function getOwnedLeg(
  id: number,
  clerkUserId: string
): Promise<PgSystemLegRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(pgSystemLegs)
    .where(and(eq(pgSystemLegs.id, id), eq(pgSystemLegs.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0] ?? null;
}

async function listOwnedLegs(
  runId: number,
  clerkUserId: string
): Promise<SystemLegRow[]> {
  const rows = await getNeonDb()
    .select()
    .from(pgSystemLegs)
    .where(
      and(eq(pgSystemLegs.runId, runId), eq(pgSystemLegs.clerkUserId, clerkUserId))
    );
  return rows.map(toSqliteLeg).sort((a, b) => a.seq - b.seq);
}

function classify(
  value: string | undefined,
  fallback: SystemClassification = "ev_play"
): SystemClassification {
  return value === "mug_bet" || value === "qualifying" || value === "ev_play"
    ? value
    : fallback;
}

/**
 * Linked-back settlement from settleSystemReturns. Cash profit is the helper
 * profit. Free-bet profit is derived from that helper's line counts.
 */
export function hostedSystemLinkedSettlement(
  run: Pick<SystemRunRow, "structure" | "unitStake" | "eachWay" | "placeFraction">,
  legs: Array<{
    label: string;
    oddsDecimal: number;
    result: SystemLegRow["result"];
  }>,
  backBetType?: string | null
): { status: "won" | "lost" | "void"; profit: number } {
  if (legs.every((l) => l.result === "void")) {
    return { status: "void", profit: 0 };
  }
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
  if (!settled) return { status: "void", profit: 0 };
  const status: "won" | "lost" = settled.returns > 0 ? "won" : "lost";
  let profit = settled.profit;
  if (isDeskFreeBetType(backBetType)) {
    const refunds = roundPence(
      run.unitStake * settled.refundedLines * (eachWay ? 2 : 1)
    );
    const stakeReturnedWinnings = roundPence(settled.returns - refunds);
    profit =
      backBetType === "free_sr"
        ? stakeReturnedWinnings
        : roundPence(
            stakeReturnedWinnings -
              roundPence(
                run.unitStake * (settled.winPayingLines + settled.placePayingLines)
              )
          );
  }
  return { status, profit: roundPence(profit) };
}

async function settleLinkedBet(
  betId: number | null,
  status: "won" | "lost" | "void",
  profit: number
): Promise<void> {
  if (betId == null) return;
  const bet = await getNeonDeskBet(betId);
  if (!bet || bet.status !== "open") return;
  const updated = await patchNeonDeskBet(bet.id, {
    status,
    actualProfit: roundPence(profit),
    settledAt: Date.now(),
  });
  if (!updated) return;
  await ledgerNeonBetSettlement(updated).catch((error) => {
    logNeonLedgerFailure("settlement", updated.id, error);
  });
}

async function completeSystemRun(
  run: SystemRunRow,
  legs: SystemLegRow[]
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  const back =
    run.backBetId != null ? await getNeonDeskBet(run.backBetId) : null;
  const settled = hostedSystemLinkedSettlement(run, legs, back?.betType);
  await settleLinkedBet(run.backBetId, settled.status, settled.profit);
  await getNeonDb()
    .update(pgSystemRuns)
    .set({ status: "completed", settledAt: Date.now() })
    .where(
      and(eq(pgSystemRuns.id, run.id), eq(pgSystemRuns.clerkUserId, clerkUserId))
    );
}

export async function listNeonSystemRuns(): Promise<
  Array<{
    run: SystemRunRow;
    legs: SystemLegRow[];
    backBetType: string | null;
    campaignProfit: number | null;
  }>
> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const runs = await getNeonDb()
    .select()
    .from(pgSystemRuns)
    .where(eq(pgSystemRuns.clerkUserId, clerkUserId))
    .orderBy(desc(pgSystemRuns.createdAt));
  if (runs.length === 0) return [];
  const runIds = runs.map((r) => r.id);
  const [legRows, bets] = await Promise.all([
    getNeonDb()
      .select()
      .from(pgSystemLegs)
      .where(
        and(
          eq(pgSystemLegs.clerkUserId, clerkUserId),
          inArray(pgSystemLegs.runId, runIds)
        )
      ),
    listNeonDeskBets(clerkUserId),
  ]);
  const legsByRun = new Map<number, SystemLegRow[]>();
  for (const row of legRows) {
    const list = legsByRun.get(row.runId) ?? [];
    list.push(toSqliteLeg(row));
    legsByRun.set(row.runId, list);
  }
  const betById = new Map(bets.map((b) => [b.id, b]));
  return runs.map((row) => {
    const run = toSqliteRun(row);
    const legs = (legsByRun.get(run.id) ?? []).sort((a, b) => a.seq - b.seq);
    const back = run.backBetId != null ? betById.get(run.backBetId) : undefined;
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

export async function createNeonSystemRun(
  input: CreateSystemRunInput
): Promise<{ run: SystemRunRow; legs: SystemLegRow[] }> {
  const clerkUserId = requireClerk("save a system");
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
  const classification = classify(input.classification);

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
  const backBet = await insertNeonDeskBet({
    label: deskBackBetLabel(structureLabel, input.label, backBetType),
    market: "other",
    selection: "",
    betType: backBetType,
    bookmaker: input.bookmaker ?? undefined,
    backStake: totalStake,
    backOdds: Number(effectiveAllWinOdds.toFixed(4)),
    layStake: 0,
    layOdds: 0,
    commission: 0,
    earlyPayout: 0,
    offerId: input.offerId ?? null,
    sport: deskSport,
    notes: isDeskFreeBetType(backBetType)
      ? `Systems desk free-bet · ${structureLabel}${eachWay ? " · each-way" : ""} · ${classification}`
      : `Systems desk · ${structureLabel}${eachWay ? " · each-way" : ""} · ${classification}`,
    createdAt: now,
  });
  await ledgerNeonBetPlacement(backBet).catch((error) => {
    logNeonLedgerFailure("placement", backBet.id, error);
  });

  const runRows = await getNeonDb()
    .insert(pgSystemRuns)
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
      clerkUserId,
    })
    .returning();
  const runRow = runRows[0];
  if (!runRow) throw new Error("Neon did not return the system run.");

  const legs: SystemLegRow[] = [];
  for (let i = 0; i < input.legs.length; i++) {
    const leg = input.legs[i]!;
    const inserted = await getNeonDb()
      .insert(pgSystemLegs)
      .values({
        runId: runRow.id,
        seq: i + 1,
        label: leg.label.trim(),
        eventId: leg.eventId ?? null,
        sport: leg.sport?.trim() || null,
        market: leg.market ?? null,
        selection: leg.selection ?? null,
        oddsDecimal: Number(leg.oddsDecimal.toFixed(4)),
        scheduledAt: leg.scheduledAt ?? null,
        clerkUserId,
      })
      .returning();
    if (!inserted[0]) throw new Error("Neon did not return a system leg.");
    legs.push(toSqliteLeg(inserted[0]));
  }

  return { run: toSqliteRun(runRow), legs };
}

export async function updateNeonSystemRun(
  runId: number,
  input: UpdateSystemRunInput
): Promise<{
  run: SystemRunRow;
  legs: SystemLegRow[];
  backBetType: string | null;
} | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const existingRun = await getOwnedRun(runId, clerkUserId);
  if (!existingRun) return null;
  const run = toSqliteRun(existingRun);
  const existing = await listOwnedLegs(runId, clerkUserId);
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
  const classification = classify(input.classification, run.classification as SystemClassification);

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

  const updatedRows = await getNeonDb()
    .update(pgSystemRuns)
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
    .where(
      and(eq(pgSystemRuns.id, runId), eq(pgSystemRuns.clerkUserId, clerkUserId))
    )
    .returning();
  const updatedRunRow = updatedRows[0];
  if (!updatedRunRow) return null;
  const updatedRun = toSqliteRun(updatedRunRow);

  if (!moneyLocked) {
    const keepIds = new Set(
      cleaned.map((l) => l.id).filter((id): id is number => id != null)
    );
    for (const prev of existing) {
      if (!keepIds.has(prev.id)) {
        await getNeonDb()
          .delete(pgSystemLegs)
          .where(
            and(
              eq(pgSystemLegs.id, prev.id),
              eq(pgSystemLegs.clerkUserId, clerkUserId)
            )
          );
      }
    }
    for (let i = 0; i < cleaned.length; i++) {
      const leg = cleaned[i]!;
      const seq = i + 1;
      const odds = Number(leg.oddsDecimal.toFixed(4));
      if (leg.id != null) {
        await getNeonDb()
          .update(pgSystemLegs)
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
          .where(
            and(
              eq(pgSystemLegs.id, leg.id),
              eq(pgSystemLegs.clerkUserId, clerkUserId)
            )
          );
      } else {
        await getNeonDb()
          .insert(pgSystemLegs)
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
            clerkUserId,
          });
      }
    }
  } else {
    for (const leg of cleaned) {
      await getNeonDb()
        .update(pgSystemLegs)
        .set({
          label: leg.label,
          eventId: leg.eventId,
          sport: leg.sport,
          market: leg.market,
          selection: leg.selection,
          scheduledAt: leg.scheduledAt,
        })
        .where(
          and(
            eq(pgSystemLegs.id, leg.id!),
            eq(pgSystemLegs.clerkUserId, clerkUserId)
          )
        );
    }
  }

  const legs = await listOwnedLegs(runId, clerkUserId);
  const structureLabel = systemStructureLabel(run.structure);
  const deskSport = primarySportFromLegs(cleaned);

  let backBetType: string | null = null;
  if (updatedRun.backBetId != null) {
    const back = await getNeonDeskBet(updatedRun.backBetId);
    if (back) {
      const nextBetType =
        !moneyLocked && input.backBetType != null
          ? normaliseDeskBackBetType(input.backBetType)
          : back.betType;
      const patch: Parameters<typeof patchNeonDeskBet>[1] = {
        label: deskBackBetLabel(structureLabel, label, nextBetType),
        bookmaker,
        sport: deskSport,
      };
      if (back.status === "open" && !moneyLocked) {
        patch.backStake = totalStake;
        patch.backOdds = Number(effectiveAllWinOdds.toFixed(4));
        patch.betType = nextBetType;
      }
      const next = await patchNeonDeskBet(back.id, patch);
      if (
        next &&
        back.status === "open" &&
        (back.bookmaker !== bookmaker ||
          back.betType !== next.betType ||
          (!moneyLocked &&
            (back.backStake !== totalStake || back.backOdds !== next.backOdds)))
      ) {
        await reledgerNeonOpenBetPlacement(next).catch((error) => {
          logNeonLedgerFailure("reledger", next.id, error);
        });
      }
      backBetType = next?.betType ?? back.betType;
    }
  }

  return { run: updatedRun, legs, backBetType };
}

export async function setNeonSystemLegResult(
  legId: number,
  result: "won" | "placed" | "lost" | "void"
): Promise<{ leg: SystemLegRow; runCompleted: boolean } | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const existing = await getOwnedLeg(legId, clerkUserId);
  if (!existing || existing.result !== "pending") return null;
  const runRow = await getOwnedRun(existing.runId, clerkUserId);
  if (!runRow || runRow.status !== "active") return null;

  const updatedRows = await getNeonDb()
    .update(pgSystemLegs)
    .set({ result })
    .where(
      and(eq(pgSystemLegs.id, legId), eq(pgSystemLegs.clerkUserId, clerkUserId))
    )
    .returning();
  const updatedRow = updatedRows[0];
  if (!updatedRow) return null;
  const updated = toSqliteLeg(updatedRow);

  const legs = await listOwnedLegs(runRow.id, clerkUserId);
  if (legs.every((l) => l.result !== "pending")) {
    await completeSystemRun(toSqliteRun(runRow), legs);
    return { leg: updated, runCompleted: true };
  }
  return { leg: updated, runCompleted: false };
}

export async function deleteNeonSystemRun(runId: number): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const run = await getOwnedRun(runId, clerkUserId);
  if (!run) return false;
  if (run.backBetId != null) {
    await settleLinkedBet(run.backBetId, "void", 0);
  }
  await getNeonDb()
    .delete(pgSystemLegs)
    .where(
      and(
        eq(pgSystemLegs.runId, runId),
        eq(pgSystemLegs.clerkUserId, clerkUserId)
      )
    );
  await getNeonDb()
    .delete(pgSystemRuns)
    .where(
      and(eq(pgSystemRuns.id, runId), eq(pgSystemRuns.clerkUserId, clerkUserId))
    );
  return true;
}

export async function patchNeonSystemRun(
  runId: number,
  patch: { classification?: SystemClassification }
): Promise<SystemRunRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const existing = await getOwnedRun(runId, clerkUserId);
  if (!existing) return null;
  if (patch.classification == null) return toSqliteRun(existing);
  const rows = await getNeonDb()
    .update(pgSystemRuns)
    .set({ classification: patch.classification })
    .where(
      and(eq(pgSystemRuns.id, runId), eq(pgSystemRuns.clerkUserId, clerkUserId))
    )
    .returning();
  return rows[0] ? toSqliteRun(rows[0]) : null;
}

export async function autoResultNeonSystemLegs(events: EventRow[]): Promise<number> {
  const eventById = new Map(events.map((e) => [e.id, e]));
  let resolved = 0;
  for (const { run, legs } of await listNeonSystemRuns()) {
    if (run.status !== "active") continue;
    for (const leg of legs) {
      if (leg.result !== "pending" || leg.eventId == null) continue;
      const event = eventById.get(leg.eventId);
      if (!event) continue;
      const outcome = deriveDeskLegAutoResult(leg, event);
      if (outcome == null) continue;
      if (await setNeonSystemLegResult(leg.id, outcome)) resolved += 1;
    }
  }
  return resolved;
}
