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
 * (match-odds selections v1); anything else settles by hand.
 */

import { and, eq } from "drizzle-orm";
import {
  db,
  accaLegs,
  accaRuns,
  bets,
  events,
  type AccaLegRow,
  type AccaRunRow,
  type EventRow,
} from "@/lib/db";
import {
  DEFAULT_LAY_LEAD_MINUTES,
  LAY_DUE_EXPIRY_MS,
  finalLegLockLay,
  nextSequentialLay,
  priorLayLiabilities,
} from "@/lib/calc/acca-workflow";
export { DEFAULT_LAY_LEAD_MINUTES } from "@/lib/calc/acca-workflow";
import { deriveOutcomes } from "@/lib/calc/settlement";
import { roundPence } from "@/lib/calc/money";
import { recordAlerts } from "@/lib/services/alerts-inbox";
import { sendPush } from "@/lib/services/push";

export interface CreateAccaLegInput {
  label: string;
  backOdds: number;
  eventId?: number | null;
  market?: string | null;
  selection?: string | null;
  scheduledAt?: number | null;
}

export interface CreateAccaRunInput {
  label: string;
  method: "sequential" | "insurance_legs" | "insurance_whole";
  stake: number;
  bookmaker?: string | null;
  commission?: number;
  offerId?: number | null;
  refundAmount?: number | null;
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

  // The acca back is a real bet - back-only (the desk manages the hedging).
  const backBet = db
    .insert(bets)
    .values({
      label: `Acca · ${input.label}`,
      market: "other",
      selection: "",
      betType: "qualifying",
      bookmaker: input.bookmaker ?? null,
      backStake: input.stake,
      backOdds: Number(combined.toFixed(4)),
      commission: 0,
      offerId: input.offerId ?? null,
      notes: "Acca desk run - hedged leg-by-leg on the exchange",
      createdAt: now,
    })
    .returning()
    .get();

  const run = db
    .insert(accaRuns)
    .values({
      offerId: input.offerId ?? null,
      label: input.label,
      method: input.method,
      stake: input.stake,
      bookmaker: input.bookmaker ?? null,
      commission: input.commission ?? 0,
      refundAmount: input.refundAmount ?? null,
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

export function listAccaRuns(): Array<{ run: AccaRunRow; legs: AccaLegRow[] }> {
  const runs = db.select().from(accaRuns).all().sort((a, b) => b.createdAt - a.createdAt);
  const allLegs = db.select().from(accaLegs).all();
  return runs.map((run) => ({
    run,
    legs: allLegs.filter((l) => l.runId === run.id).sort((a, b) => a.seq - b.seq),
  }));
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
  if (run.status !== "active" || run.method === "insurance_whole") return notDue;
  if (leg.result !== "pending" || leg.layBetId != null) return notDue;

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
      combinedBackOdds: combinedBackOdds(legs),
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

/** Log a placed lay for a leg - creates the REAL lay_only bet. */
export function logLegLay(legId: number, layOdds: number, layStake: number): AccaLegRow | null {
  const leg = db.select().from(accaLegs).where(eq(accaLegs.id, legId)).get();
  if (!leg || leg.result !== "pending" || leg.layBetId != null) return null;
  const run = db.select().from(accaRuns).where(eq(accaRuns.id, leg.runId)).get();
  if (!run) return null;

  const layBet = db
    .insert(bets)
    .values({
      label: `Acca lay · ${leg.label}`,
      market: leg.market ?? "other",
      selection: leg.selection ?? "",
      betType: "lay_only",
      eventId: leg.eventId ?? null,
      layStake,
      layOdds,
      commission: run.commission,
      notes: `Acca desk: leg ${leg.seq} of "${run.label}"`,
      createdAt: Date.now(),
    })
    .returning()
    .get();

  return db
    .update(accaLegs)
    .set({ layOdds, layStake, layBetId: layBet.id })
    .where(eq(accaLegs.id, legId))
    .returning()
    .get();
}

/** Log the single combined lay for an insurance_whole run. */
export function logWholeLay(runId: number, layOdds: number, layStake: number): AccaRunRow | null {
  const run = db.select().from(accaRuns).where(eq(accaRuns.id, runId)).get();
  if (!run || run.method !== "insurance_whole" || run.wholeLayBetId != null) return null;
  const layBet = db
    .insert(bets)
    .values({
      label: `Acca lay (whole) · ${run.label}`,
      market: "other",
      selection: "",
      betType: "lay_only",
      layStake,
      layOdds,
      commission: run.commission,
      notes: `Acca desk: whole-acca insurance lay for "${run.label}"`,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return db
    .update(accaRuns)
    .set({ wholeLayBetId: layBet.id, wholeLayStake: layStake, wholeLayOdds: layOdds })
    .where(eq(accaRuns.id, runId))
    .returning()
    .get();
}

function settleLinkedBet(betId: number | null, status: "won" | "lost" | "void", profit: number) {
  if (betId == null) return;
  db.update(bets)
    .set({ status, actualProfit: roundPence(profit), settledAt: Date.now() })
    .where(and(eq(bets.id, betId), eq(bets.status, "open")))
    .run();
}

/**
 * Record a leg result; settles the leg's lay bet immediately and completes
 * the run when it's decided (any loss, or every leg resolved).
 */
export function setLegResult(
  legId: number,
  result: "won" | "lost" | "void"
): { leg: AccaLegRow; runCompleted: boolean } | null {
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
    settleLinkedBet(run.backBetId, "lost", -run.stake);
    if (run.wholeLayBetId != null && run.wholeLayStake != null) {
      settleLinkedBet(run.wholeLayBetId, "won", run.wholeLayStake * (1 - run.commission));
    }
  }
  const runDecided = run.method === "sequential" ? anyLost || allResolved : allResolved;
  if (runDecided && run.status === "active") {
    completeRun(run, legs, anyLost);
  }
  return { leg: updated, runCompleted: runDecided };
}

function completeRun(run: AccaRunRow, legs: AccaLegRow[], anyLost: boolean) {
  const combined = combinedBackOdds(legs);
  const allVoid = legs.every((l) => l.result === "void");
  if (anyLost) {
    settleLinkedBet(run.backBetId, "lost", -run.stake);
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
      title: `Acca refund due · ${run.label}`,
      body: `Exactly one leg lost - claim the £${run.refundAmount!.toFixed(2)} free bet refund.`,
      href: "/acca",
    };
    recordAlerts([alert]);
    void sendPush(alert).catch(() => {});
  }
}

/** Auto-results (Sam): a linked finished event decides match-odds legs. */
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
      if (leg.market !== "match_odds") continue;
      if (leg.selection !== "home" && leg.selection !== "draw" && leg.selection !== "away") continue;
      const event = eventById.get(leg.eventId);
      if (!event || event.status !== "finished") continue;
      const outcome = deriveOutcomes({
        homeScore: event.homeScore,
        awayScore: event.awayScore,
        homeLed2: event.homeLed2 === 1,
        awayLed2: event.awayLed2 === 1,
      });
      const result = outcome.matchOdds === leg.selection ? "won" : "lost";
      if (setLegResult(leg.id, result)) resolved += 1;
    }
  }
  if (resolved > 0) void nowMs;
  return resolved;
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
        title: `Lay leg ${leg.seq} of ${run.label}`,
        body:
          state.suggestedStake != null
            ? `${leg.label} - lay ~£${state.suggestedStake.toFixed(2)} (check the live price on the desk).`
            : `${leg.label} is ready to lay.`,
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
