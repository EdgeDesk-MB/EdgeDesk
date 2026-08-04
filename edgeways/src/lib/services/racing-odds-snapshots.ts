/**
 * Record SP snapshots from racecard polls - powers steamer/drifter indicators on Racing Desk.
 * Full price history from The Racing API `/v1/odds/{race_id}/{horse_id}` is a premium add-on.
 *
 * kind=bookie → bookie/back movement (default steamer column)
 * kind=exchange → live exchange lay movement (separate series)
 */
import { db } from "@/lib/db";
import { racingOddsSnapshots } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import type { PriceMovement } from "@/lib/racing-desk/types";

export type SnapshotKind = "bookie" | "exchange";

export interface SnapshotInput {
  raceId: string;
  horseId: string;
  horse: string;
  spDecimal?: number | null;
  kind?: SnapshotKind;
}

const MIN_CHANGE = 0.02;

export function recordOddsSnapshots(inputs: SnapshotInput[]): void {
  const now = Date.now();
  for (const row of inputs) {
    if (row.spDecimal == null || !(row.spDecimal > 1)) continue;
    const kind: SnapshotKind = row.kind ?? "bookie";

    const last = db
      .select()
      .from(racingOddsSnapshots)
      .where(
        and(
          eq(racingOddsSnapshots.raceId, row.raceId),
          eq(racingOddsSnapshots.horseId, row.horseId),
          eq(racingOddsSnapshots.kind, kind)
        )
      )
      .orderBy(asc(racingOddsSnapshots.capturedAt))
      .all()
      .at(-1);

    if (last && Math.abs(last.spDecimal - row.spDecimal) < MIN_CHANGE) continue;

    db.insert(racingOddsSnapshots)
      .values({
        raceId: row.raceId,
        horseId: row.horseId,
        horse: row.horse,
        spDecimal: row.spDecimal,
        kind,
        capturedAt: now,
      })
      .run();
  }
}

export function priceMovementFor(
  raceId: string,
  horseId: string,
  kind: SnapshotKind = "bookie"
): PriceMovement {
  const rows = db
    .select()
    .from(racingOddsSnapshots)
    .where(
      and(
        eq(racingOddsSnapshots.raceId, raceId),
        eq(racingOddsSnapshots.horseId, horseId),
        eq(racingOddsSnapshots.kind, kind)
      )
    )
    .orderBy(asc(racingOddsSnapshots.capturedAt))
    .all();

  // Legacy rows (pre-kind column) were bookie-only; also include null/empty kind for bookie
  const history = rows.map((r) => r.spDecimal).filter((v) => v > 1);

  // If kind=bookie and no typed rows, fall back to untyped legacy snapshots
  if (history.length === 0 && kind === "bookie") {
    const legacy = db
      .select()
      .from(racingOddsSnapshots)
      .where(
        and(eq(racingOddsSnapshots.raceId, raceId), eq(racingOddsSnapshots.horseId, horseId))
      )
      .orderBy(asc(racingOddsSnapshots.capturedAt))
      .all()
      .filter((r) => !r.kind || r.kind === "bookie")
      .map((r) => r.spDecimal)
      .filter((v) => v > 1);

    return movementFromHistory(legacy);
  }

  return movementFromHistory(history);
}

function movementFromHistory(history: number[]): PriceMovement {
  if (history.length === 0) {
    return {
      open: null,
      current: null,
      change: null,
      changePct: null,
      history: [],
      snapshotCount: 0,
    };
  }

  const open = history[0]!;
  const current = history[history.length - 1]!;
  const change = current - open;
  const changePct = open > 0 ? (change / open) * 100 : null;

  return {
    open,
    current,
    change,
    changePct,
    history: history.slice(-12),
    snapshotCount: history.length,
  };
}

/** Seed demo movement for showcase when no snapshots exist yet. */
export function demoMovement(spDecimal: number, seed: number): PriceMovement {
  const drift = ((seed % 5) - 2) * 0.15;
  const open = Math.max(1.5, spDecimal + drift);
  const current = spDecimal;
  const change = current - open;
  return {
    open,
    current,
    change,
    changePct: open > 0 ? (change / open) * 100 : null,
    history: [open, open - drift * 0.3, open - drift * 0.6, current],
    snapshotCount: 4,
  };
}
