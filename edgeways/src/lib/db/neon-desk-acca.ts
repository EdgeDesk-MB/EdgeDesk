/**
 * Hosted Acca Desk on Neon. Mirrors src/lib/services/acca-desk.ts.
 * Pure helpers stay in acca-desk / calc; money goes through the Neon ledger.
 */
import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { accaRunMoneyLocked } from "@/lib/acca/acca-run-edit";
import {
  applyAccaBoost,
  finalLegLockLay,
  nextSequentialLay,
  priorLayLiabilities,
} from "@/lib/calc/acca-workflow";
import { roundPence } from "@/lib/calc/money";
import { listNeonInboxDedupes, recordNeonAlerts } from "@/lib/db/neon-alerts-inbox";
import { getNeonDb } from "@/lib/db/neon";
import {
  deleteNeonDeskBet,
  getNeonDeskBet,
  insertNeonDeskBet,
  listNeonDeskBets,
  neonDeskClerkUserId,
  patchNeonDeskBet,
  type NeonDeskBetValues,
} from "@/lib/db/neon-desk";
import {
  ledgerNeonBetPlacement,
  ledgerNeonBetSettlement,
  logNeonLedgerFailure,
  purgeNeonDeskLedgerForBet,
  reledgerNeonOpenBetPlacement,
} from "@/lib/db/neon-desk-ledger";
import { getNeonEvent } from "@/lib/db/neon-events";
import {
  accaLegs as pgAccaLegs,
  accaRuns as pgAccaRuns,
  type AccaLegRow as PgAccaLegRow,
  type AccaRunRow as PgAccaRunRow,
} from "@/lib/db/schema.pg";
import type { AccaLegRow, AccaRunRow, BetRow, EventRow } from "@/lib/db/schema";
import {
  deriveDeskLegAutoResult,
  toBinaryDeskResult,
} from "@/lib/desk/leg-auto-result";
import {
  deskBackBetLabel,
  normaliseDeskBackBetType,
  primarySportFromLegs,
} from "@/lib/desk/desk-back-bet-type";
import { deskLegTitleParts } from "@/lib/desk/desk-leg-title";
import {
  combinedBackOdds,
  isWholeComboAccaMethod,
  legDueState,
  type AccaRunView,
  type CreateAccaRunInput,
  type UpdateAccaRunInput,
} from "@/lib/services/acca-desk";
import { sendPush } from "@/lib/services/push";
import type { AppState } from "@/lib/services/state.types";

export type { AccaRunView, CreateAccaRunInput, UpdateAccaRunInput };

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function toSqliteAccaRun(row: PgAccaRunRow): AccaRunRow {
  return {
    id: row.id,
    offerId: row.offerId,
    label: row.label,
    method: row.method,
    stake: row.stake,
    bookmaker: row.bookmaker,
    commission: row.commission,
    refundAmount: row.refundAmount,
    backBetId: row.backBetId,
    wholeLayBetId: row.wholeLayBetId,
    wholeLayStake: row.wholeLayStake,
    wholeLayOdds: row.wholeLayOdds,
    boostPct: row.boostPct,
    noLay: row.noLay,
    muteAlerts: row.muteAlerts,
    status: row.status,
    createdAt: row.createdAt,
    settledAt: row.settledAt,
  };
}

function toSqliteAccaLeg(row: PgAccaLegRow): AccaLegRow {
  return {
    id: row.id,
    runId: row.runId,
    seq: row.seq,
    label: row.label,
    eventId: row.eventId,
    sport: row.sport,
    market: row.market,
    selection: row.selection,
    backOdds: row.backOdds,
    layOdds: row.layOdds,
    layStake: row.layStake,
    layBetId: row.layBetId,
    result: row.result,
    scheduledAt: row.scheduledAt,
  };
}

function accaBackBetLabel(label: string, betType: string | null | undefined): string {
  return deskBackBetLabel("Acca", label, betType);
}

function backLostProfit(back: Pick<BetRow, "betType"> | undefined, stake: number): number {
  if (back?.betType === "free_snr" || back?.betType === "free_sr") return 0;
  return -stake;
}

function backBetNotes(input: CreateAccaRunInput, isFree: boolean): string {
  if (isFree) {
    return input.noLay && input.method === "combined"
      ? "Acca desk free-bet convert - no lay"
      : "Acca desk free-bet convert - hedged on the exchange";
  }
  return input.noLay && input.method === "combined"
    ? "Acca desk run - no lay"
    : "Acca desk run - hedged on the exchange";
}

async function getOwnedRun(
  id: number,
  clerkUserId: string
): Promise<PgAccaRunRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(pgAccaRuns)
    .where(and(eq(pgAccaRuns.id, id), eq(pgAccaRuns.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0] ?? null;
}

async function getOwnedLeg(
  id: number,
  clerkUserId: string
): Promise<PgAccaLegRow | null> {
  const rows = await getNeonDb()
    .select()
    .from(pgAccaLegs)
    .where(and(eq(pgAccaLegs.id, id), eq(pgAccaLegs.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0] ?? null;
}

async function listOwnedLegs(
  runId: number,
  clerkUserId: string
): Promise<AccaLegRow[]> {
  const rows = await getNeonDb()
    .select()
    .from(pgAccaLegs)
    .where(and(eq(pgAccaLegs.runId, runId), eq(pgAccaLegs.clerkUserId, clerkUserId)));
  return rows.map(toSqliteAccaLeg).sort((a, b) => a.seq - b.seq);
}

async function settleNeonLinkedBet(
  betId: number | null,
  status: "won" | "lost" | "void",
  profit: number
): Promise<void> {
  if (betId == null) return;
  const existing = await getNeonDeskBet(betId);
  if (!existing || existing.status !== "open") return;
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

async function placeNeonDeskBet(values: NeonDeskBetValues): Promise<BetRow> {
  const inserted = await insertNeonDeskBet(values);
  await ledgerNeonBetPlacement(inserted).catch((error) => {
    logNeonLedgerFailure("placement", inserted.id, error);
  });
  return inserted;
}

export async function listNeonAccaRuns(): Promise<AccaRunView[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const runs = await getNeonDb()
    .select()
    .from(pgAccaRuns)
    .where(eq(pgAccaRuns.clerkUserId, clerkUserId))
    .orderBy(desc(pgAccaRuns.createdAt));
  if (runs.length === 0) return [];
  const runIds = runs.map((r) => r.id);
  const legs = await getNeonDb()
    .select()
    .from(pgAccaLegs)
    .where(
      and(eq(pgAccaLegs.clerkUserId, clerkUserId), inArray(pgAccaLegs.runId, runIds))
    );
  const bets = await listNeonDeskBets();
  const betTypeById = new Map(bets.map((b) => [b.id, b.betType]));
  const legsByRun = new Map<number, AccaLegRow[]>();
  for (const row of legs) {
    const mapped = toSqliteAccaLeg(row);
    const list = legsByRun.get(mapped.runId) ?? [];
    list.push(mapped);
    legsByRun.set(mapped.runId, list);
  }
  return runs.map((row) => {
    const run = toSqliteAccaRun(row);
    const runLegs = (legsByRun.get(run.id) ?? []).sort((a, b) => a.seq - b.seq);
    return {
      run,
      legs: runLegs,
      backBetType: run.backBetId != null ? (betTypeById.get(run.backBetId) ?? null) : null,
    };
  });
}

export async function createNeonAccaRun(
  input: CreateAccaRunInput
): Promise<{ run: AccaRunRow; legs: AccaLegRow[] }> {
  const clerkUserId = requireClerk("save an acca");
  const now = Date.now();
  const combined = input.legs.reduce((a, l) => a * l.backOdds, 1);
  const boostedCombined = applyAccaBoost(combined, input.boostPct);
  const backBetType = normaliseDeskBackBetType(input.backBetType);
  const deskSport = primarySportFromLegs(input.legs);
  const isFree = backBetType === "free_snr" || backBetType === "free_sr";

  const backBet = await placeNeonDeskBet({
    label: deskBackBetLabel("Acca", input.label, backBetType),
    market: "other",
    selection: "",
    betType: backBetType,
    bookmaker: input.bookmaker ?? undefined,
    backStake: input.stake,
    backOdds: Number(boostedCombined.toFixed(4)),
    layStake: 0,
    layOdds: 0,
    commission: 0,
    earlyPayout: 0,
    offerId: input.offerId ?? null,
    sport: deskSport,
    notes: backBetNotes(input, isFree),
    createdAt: now,
  });

  try {
    const noLay = input.method === "combined" && input.noLay === true ? 1 : 0;
    const runRows = await getNeonDb()
      .insert(pgAccaRuns)
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
        clerkUserId,
      })
      .returning();
    const runRow = runRows[0];
    if (!runRow) throw new Error("Neon did not return the acca run.");

    const legs: AccaLegRow[] = [];
    for (let i = 0; i < input.legs.length; i++) {
      const leg = input.legs[i]!;
      const inserted = await getNeonDb()
        .insert(pgAccaLegs)
        .values({
          runId: runRow.id,
          seq: i + 1,
          label: leg.label,
          eventId: leg.eventId ?? null,
          sport: leg.sport?.trim() || null,
          market: leg.market ?? null,
          selection: leg.selection ?? null,
          backOdds: leg.backOdds,
          scheduledAt: leg.scheduledAt ?? null,
          clerkUserId,
        })
        .returning();
      if (!inserted[0]) throw new Error("Neon did not return the acca leg.");
      legs.push(toSqliteAccaLeg(inserted[0]));
    }

    return { run: toSqliteAccaRun(runRow), legs };
  } catch (error) {
    await purgeNeonDeskLedgerForBet(backBet.id).catch(() => {});
    await deleteNeonDeskBet(backBet.id).catch(() => {});
    throw error;
  }
}

export async function setNeonRunBoost(
  runId: number,
  boostPct: number | null
): Promise<AccaRunRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const run = await getOwnedRun(runId, clerkUserId);
  if (!run || run.status !== "active") return null;
  const legs = await listOwnedLegs(runId, clerkUserId);
  const boosted = applyAccaBoost(combinedBackOdds(legs), boostPct);

  if (run.backBetId != null) {
    const back = await getNeonDeskBet(run.backBetId);
    if (back?.status === "open") {
      await patchNeonDeskBet(back.id, { backOdds: Number(boosted.toFixed(4)) });
    }
  }

  const rows = await getNeonDb()
    .update(pgAccaRuns)
    .set({ boostPct })
    .where(and(eq(pgAccaRuns.id, runId), eq(pgAccaRuns.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteAccaRun(rows[0]) : null;
}

export async function updateNeonAccaRun(
  runId: number,
  input: UpdateAccaRunInput
): Promise<AccaRunView | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const run = await getOwnedRun(runId, clerkUserId);
  if (!run) return null;
  const existingLegs = await listOwnedLegs(runId, clerkUserId);
  const sqliteRun = toSqliteAccaRun(run);
  const moneyLocked = accaRunMoneyLocked(sqliteRun, existingLegs);

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
    if (cleanedLegs.length !== existingLegs.length) return null;
    for (let i = 0; i < existingLegs.length; i++) {
      const next = cleanedLegs[i]!;
      const prev = existingLegs[i]!;
      if (next.id !== prev.id) return null;
      if (next.backOdds !== prev.backOdds) return null;
    }
  } else {
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

  const updatedRows = await getNeonDb()
    .update(pgAccaRuns)
    .set({
      label,
      bookmaker,
      stake,
      commission,
      boostPct: boostPct ?? null,
      refundAmount,
    })
    .where(and(eq(pgAccaRuns.id, runId), eq(pgAccaRuns.clerkUserId, clerkUserId)))
    .returning();
  const updatedRunRow = updatedRows[0];
  if (!updatedRunRow) return null;
  const updatedRun = toSqliteAccaRun(updatedRunRow);

  if (!moneyLocked) {
    const keepIds = new Set(
      cleanedLegs.map((l) => l.id).filter((id): id is number => id != null)
    );
    for (const prev of existingLegs) {
      if (!keepIds.has(prev.id)) {
        await getNeonDb()
          .delete(pgAccaLegs)
          .where(and(eq(pgAccaLegs.id, prev.id), eq(pgAccaLegs.clerkUserId, clerkUserId)));
      }
    }
    for (let i = 0; i < cleanedLegs.length; i++) {
      const leg = cleanedLegs[i]!;
      const seq = i + 1;
      if (leg.id != null) {
        await getNeonDb()
          .update(pgAccaLegs)
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
          .where(and(eq(pgAccaLegs.id, leg.id), eq(pgAccaLegs.clerkUserId, clerkUserId)));
      } else {
        await getNeonDb()
          .insert(pgAccaLegs)
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
            clerkUserId,
          });
      }
    }
  } else {
    for (const leg of cleanedLegs) {
      await getNeonDb()
        .update(pgAccaLegs)
        .set({
          label: leg.label,
          eventId: leg.eventId,
          sport: leg.sport,
          market: leg.market,
          selection: leg.selection,
          scheduledAt: leg.scheduledAt,
        })
        .where(and(eq(pgAccaLegs.id, leg.id!), eq(pgAccaLegs.clerkUserId, clerkUserId)));
    }
  }

  const legs = await listOwnedLegs(runId, clerkUserId);

  if (updatedRun.backBetId != null) {
    const back = await getNeonDeskBet(updatedRun.backBetId);
    if (back) {
      const nextBetType =
        !moneyLocked && input.backBetType != null
          ? normaliseDeskBackBetType(input.backBetType)
          : back.betType;
      const deskSport = primarySportFromLegs(cleanedLegs);
      const patch: Parameters<typeof patchNeonDeskBet>[1] = {
        label: accaBackBetLabel(label, nextBetType),
        bookmaker,
        sport: deskSport,
      };
      if (back.status === "open" && !moneyLocked) {
        patch.backStake = stake;
        patch.backOdds = Number(boostedCombined.toFixed(4));
        patch.betType = nextBetType;
      }
      const next = await patchNeonDeskBet(back.id, patch);
      if (
        next &&
        back.status === "open" &&
        (back.bookmaker !== bookmaker ||
          back.betType !== next.betType ||
          (!moneyLocked && (back.backStake !== stake || back.backOdds !== next.backOdds)))
      ) {
        await reledgerNeonOpenBetPlacement(next).catch((error) => {
          logNeonLedgerFailure("reledger", next.id, error);
        });
      }
    }
  }
  if (updatedRun.wholeLayBetId != null) {
    await patchNeonDeskBet(updatedRun.wholeLayBetId, {
      label: `Acca lay · ${label}`,
      bookmaker,
      ...(moneyLocked ? {} : { commission }),
    });
  }
  for (const leg of legs) {
    if (leg.layBetId == null) continue;
    const linkedEvent = leg.eventId != null ? await getNeonEvent(leg.eventId) : null;
    const layTitle = deskLegTitleParts(leg, linkedEvent).primary;
    await patchNeonDeskBet(leg.layBetId, {
      label: `Acca lay · ${layTitle}`,
      bookmaker,
      ...(moneyLocked ? {} : { commission }),
    });
  }

  const back =
    updatedRun.backBetId != null ? await getNeonDeskBet(updatedRun.backBetId) : null;
  return {
    run: updatedRun,
    legs,
    backBetType: back?.betType ?? null,
  };
}

export async function logNeonLegLay(
  legId: number,
  layOdds: number,
  layStake: number,
  exchangeId?: number | null
): Promise<AccaLegRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const leg = await getOwnedLeg(legId, clerkUserId);
  if (!leg || leg.result !== "pending" || leg.layStake != null) return null;
  const run = await getOwnedRun(leg.runId, clerkUserId);
  if (!run) return null;
  if (!(layStake >= 0) || !Number.isFinite(layStake)) return null;

  if (layStake === 0) {
    const rows = await getNeonDb()
      .update(pgAccaLegs)
      .set({ layOdds: 0, layStake: 0, layBetId: null })
      .where(and(eq(pgAccaLegs.id, legId), eq(pgAccaLegs.clerkUserId, clerkUserId)))
      .returning();
    return rows[0] ? toSqliteAccaLeg(rows[0]) : null;
  }

  if (!(layOdds > 1)) return null;

  const linkedEvent = leg.eventId != null ? await getNeonEvent(leg.eventId) : null;
  const sqliteLeg = toSqliteAccaLeg(leg);
  const layTitle = deskLegTitleParts(sqliteLeg, linkedEvent).primary;

  const layBet = await placeNeonDeskBet({
    label: `Acca lay · ${layTitle}`,
    market: leg.market ?? "other",
    selection: leg.selection ?? "",
    betType: "lay_only",
    eventId: leg.eventId ?? null,
    exchangeId: exchangeId ?? undefined,
    offerId: run.offerId ?? null,
    bookmaker: run.bookmaker ?? undefined,
    backStake: 0,
    backOdds: 0,
    layStake,
    layOdds,
    commission: run.commission,
    earlyPayout: 0,
    notes: `Acca desk: leg ${leg.seq} of "${run.label}"`,
    createdAt: Date.now(),
  });

  const rows = await getNeonDb()
    .update(pgAccaLegs)
    .set({ layOdds, layStake, layBetId: layBet.id })
    .where(and(eq(pgAccaLegs.id, legId), eq(pgAccaLegs.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteAccaLeg(rows[0]) : null;
}

export async function logNeonWholeLay(
  runId: number,
  layOdds: number,
  layStake: number,
  exchangeId?: number | null
): Promise<AccaRunRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const run = await getOwnedRun(runId, clerkUserId);
  if (
    !run ||
    !isWholeComboAccaMethod(run.method) ||
    run.noLay === 1 ||
    run.wholeLayBetId != null
  ) {
    return null;
  }

  const layBet = await placeNeonDeskBet({
    label: `Acca lay (whole) · ${run.label}`,
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
    notes:
      run.method === "combined"
        ? `Acca desk: combined lay for "${run.label}"`
        : `Acca desk: whole-acca insurance lay for "${run.label}"`,
    createdAt: Date.now(),
  });

  const rows = await getNeonDb()
    .update(pgAccaRuns)
    .set({ wholeLayBetId: layBet.id, wholeLayStake: layStake, wholeLayOdds: layOdds })
    .where(and(eq(pgAccaRuns.id, runId), eq(pgAccaRuns.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteAccaRun(rows[0]) : null;
}

export async function markNeonAccaNoLay(runId: number): Promise<AccaRunRow | null> {
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
  const rows = await getNeonDb()
    .update(pgAccaRuns)
    .set({ noLay: 1 })
    .where(and(eq(pgAccaRuns.id, runId), eq(pgAccaRuns.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteAccaRun(rows[0]) : null;
}

async function maybeNeonAccaNextLayAlert(
  run: AccaRunRow,
  legs: AccaLegRow[]
): Promise<boolean> {
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
  if ((await recordNeonAlerts([alert])) <= 0) return false;
  void sendPush(alert).catch(() => {});
  return true;
}

async function completeNeonRun(
  run: AccaRunRow,
  legs: AccaLegRow[],
  anyLost: boolean,
  clerkUserId: string
): Promise<void> {
  const combined = applyAccaBoost(combinedBackOdds(legs), run.boostPct);
  const allVoid = legs.every((l) => l.result === "void");
  const back =
    run.backBetId != null ? (await getNeonDeskBet(run.backBetId)) ?? undefined : undefined;
  if (anyLost) {
    await settleNeonLinkedBet(run.backBetId, "lost", backLostProfit(back, run.stake));
  } else if (allVoid) {
    await settleNeonLinkedBet(run.backBetId, "void", 0);
  } else {
    await settleNeonLinkedBet(run.backBetId, "won", run.stake * (combined - 1));
  }
  if (run.wholeLayBetId != null && run.wholeLayStake != null && run.wholeLayOdds != null) {
    if (anyLost) {
      await settleNeonLinkedBet(
        run.wholeLayBetId,
        "won",
        run.wholeLayStake * (1 - run.commission)
      );
    } else if (allVoid) {
      await settleNeonLinkedBet(run.wholeLayBetId, "void", 0);
    } else {
      await settleNeonLinkedBet(
        run.wholeLayBetId,
        "lost",
        -run.wholeLayStake * (run.wholeLayOdds - 1)
      );
    }
  }

  await getNeonDb()
    .update(pgAccaRuns)
    .set({ status: "completed", settledAt: Date.now() })
    .where(and(eq(pgAccaRuns.id, run.id), eq(pgAccaRuns.clerkUserId, clerkUserId)));

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
    await recordNeonAlerts([alert]);
    void sendPush(alert).catch(() => {});
  }
}

export async function setNeonLegResult(
  legId: number,
  result: "won" | "lost" | "void"
): Promise<{ leg: AccaLegRow; runCompleted: boolean } | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const leg = await getOwnedLeg(legId, clerkUserId);
  if (!leg || leg.result !== "pending") return null;
  const runRow = await getOwnedRun(leg.runId, clerkUserId);
  if (!runRow) return null;
  const run = toSqliteAccaRun(runRow);

  const updatedRows = await getNeonDb()
    .update(pgAccaLegs)
    .set({ result })
    .where(and(eq(pgAccaLegs.id, legId), eq(pgAccaLegs.clerkUserId, clerkUserId)))
    .returning();
  const updated = updatedRows[0];
  if (!updated) return null;

  if (leg.layBetId != null && leg.layStake != null && leg.layOdds != null) {
    if (result === "lost") {
      await settleNeonLinkedBet(leg.layBetId, "won", leg.layStake * (1 - run.commission));
    } else if (result === "won") {
      await settleNeonLinkedBet(leg.layBetId, "lost", -leg.layStake * (leg.layOdds - 1));
    } else {
      await settleNeonLinkedBet(leg.layBetId, "void", 0);
    }
  }

  const legs = await listOwnedLegs(run.id, clerkUserId);
  const anyLost = legs.some((l) => l.result === "lost");
  const allResolved = legs.every((l) => l.result !== "pending");

  if (anyLost) {
    const back =
      run.backBetId != null ? (await getNeonDeskBet(run.backBetId)) ?? undefined : undefined;
    await settleNeonLinkedBet(run.backBetId, "lost", backLostProfit(back, run.stake));
    if (run.wholeLayBetId != null && run.wholeLayStake != null) {
      await settleNeonLinkedBet(
        run.wholeLayBetId,
        "won",
        run.wholeLayStake * (1 - run.commission)
      );
    }
  }

  const runDecided = run.method === "sequential" ? anyLost || allResolved : allResolved;
  if (runDecided && run.status === "active") {
    await completeNeonRun(run, legs, anyLost, clerkUserId);
  } else if (
    (result === "won" || result === "void") &&
    run.status === "active" &&
    !run.muteAlerts
  ) {
    await maybeNeonAccaNextLayAlert(run, legs);
  }
  return { leg: toSqliteAccaLeg(updated), runCompleted: runDecided };
}

export async function deleteNeonAccaRun(runId: number): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const run = await getOwnedRun(runId, clerkUserId);
  if (!run) return false;
  const legs = await listOwnedLegs(runId, clerkUserId);
  const linkedBetIds = [
    run.backBetId,
    run.wholeLayBetId,
    ...legs.map((l) => l.layBetId),
  ].filter((x): x is number => x != null);
  const now = Date.now();
  for (const betId of linkedBetIds) {
    const existing = await getNeonDeskBet(betId);
    if (!existing || existing.status !== "open") continue;
    const updated = await patchNeonDeskBet(betId, {
      status: "void",
      actualProfit: 0,
      settledAt: now,
    });
    if (!updated) continue;
    await ledgerNeonBetSettlement(updated).catch((error) => {
      logNeonLedgerFailure("settlement", updated.id, error);
    });
  }
  await getNeonDb()
    .delete(pgAccaLegs)
    .where(and(eq(pgAccaLegs.runId, runId), eq(pgAccaLegs.clerkUserId, clerkUserId)));
  await getNeonDb()
    .delete(pgAccaRuns)
    .where(and(eq(pgAccaRuns.id, runId), eq(pgAccaRuns.clerkUserId, clerkUserId)));
  return true;
}

export async function patchNeonAccaRunFlags(
  runId: number,
  patch: { muteAlerts?: boolean; status?: "abandoned" }
): Promise<AccaRunRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const existing = await getOwnedRun(runId, clerkUserId);
  if (!existing) return null;
  const rows = await getNeonDb()
    .update(pgAccaRuns)
    .set({
      ...(patch.muteAlerts !== undefined ? { muteAlerts: patch.muteAlerts ? 1 : 0 } : {}),
      ...(patch.status ? { status: patch.status } : {}),
    })
    .where(and(eq(pgAccaRuns.id, runId), eq(pgAccaRuns.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteAccaRun(rows[0]) : null;
}

export async function accaLayDueForState(
  nowMs = Date.now()
): Promise<AppState["accaLayDue"]> {
  const bundles = await listNeonAccaRuns();
  return bundles.flatMap(({ run, legs }) =>
    legs
      .map((leg) => ({ leg, due: legDueState(run, legs, leg, nowMs) }))
      .filter(({ due }) => due.due)
      .map(({ leg, due }) => ({
        legId: leg.id,
        runLabel: run.label,
        legLabel: leg.label,
        seq: leg.seq,
        scheduledAt: leg.scheduledAt,
        suggestedStake: due.suggestedStake,
      }))
  );
}

export async function autoResultNeonAccaLegs(events: EventRow[]): Promise<number> {
  const eventById = new Map(events.map((e) => [e.id, e]));
  let resolved = 0;
  for (const { run, legs } of await listNeonAccaRuns()) {
    if (run.status !== "active") continue;
    for (const leg of legs) {
      if (leg.result !== "pending" || leg.eventId == null) continue;
      const event = eventById.get(leg.eventId);
      if (!event) continue;
      const outcome = deriveDeskLegAutoResult(leg, event);
      if (outcome == null) continue;
      if (await setNeonLegResult(leg.id, toBinaryDeskResult(outcome))) resolved += 1;
    }
  }
  return resolved;
}

export async function raiseNeonAccaLayDueAlerts(nowMs = Date.now()): Promise<number> {
  const seen = new Set(await listNeonInboxDedupes());
  let raised = 0;
  for (const { run, legs } of await listNeonAccaRuns()) {
    if (run.status !== "active" || run.muteAlerts) continue;
    for (const leg of legs) {
      const state = legDueState(run, legs, leg, nowMs);
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
      if (seen.has(alert.key)) continue;
      await recordNeonAlerts([alert]);
      seen.add(alert.key);
      void sendPush(alert).catch(() => {});
      raised += 1;
    }
  }
  return raised;
}
