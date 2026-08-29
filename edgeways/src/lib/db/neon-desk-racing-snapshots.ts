/**
 * Shared Racing Desk SP / steamer snapshots. Prices are feed-level, not
 * per-desk, so these rows are not clerk-scoped.
 */
import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { racingOddsSnapshots as pgSnapshots } from "@/lib/db/schema.pg";
import {
  priceMovementFromHistory,
  type SnapshotInput,
  type SnapshotKind,
} from "@/lib/services/racing-odds-snapshots";
import type { PriceMovement } from "@/lib/racing-desk/types";

const MIN_CHANGE = 0.02;

export async function recordNeonOddsSnapshots(inputs: SnapshotInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();
  const db = getNeonDb();
  for (const row of inputs) {
    if (row.spDecimal == null || !(row.spDecimal > 1)) continue;
    const kind: SnapshotKind = row.kind ?? "bookie";
    const existing = await db
      .select()
      .from(pgSnapshots)
      .where(
        and(
          eq(pgSnapshots.raceId, row.raceId),
          eq(pgSnapshots.horseId, row.horseId),
          eq(pgSnapshots.kind, kind)
        )
      )
      .orderBy(asc(pgSnapshots.capturedAt));
    const last = existing.at(-1);
    if (last && Math.abs(last.spDecimal - row.spDecimal) < MIN_CHANGE) continue;
    await db.insert(pgSnapshots).values({
      raceId: row.raceId,
      horseId: row.horseId,
      horse: row.horse,
      spDecimal: row.spDecimal,
      kind,
      capturedAt: now,
    });
  }
}

export async function neonPriceMovementsForRaces(
  raceIds: string[]
): Promise<Map<string, Map<SnapshotKind, Map<string, PriceMovement>>>> {
  const byRace = new Map<string, Map<SnapshotKind, Map<string, PriceMovement>>>();
  if (raceIds.length === 0) return byRace;
  const rows = await getNeonDb()
    .select()
    .from(pgSnapshots)
    .where(inArray(pgSnapshots.raceId, raceIds))
    .orderBy(asc(pgSnapshots.capturedAt));
  const series = new Map<string, number[]>();
  for (const row of rows) {
    const kind = (row.kind || "bookie") as SnapshotKind;
    const key = `${row.raceId}\0${row.horseId}\0${kind}`;
    const list = series.get(key) ?? [];
    if (row.spDecimal > 1) list.push(row.spDecimal);
    series.set(key, list);
  }
  for (const [key, history] of series) {
    const [raceId, horseId, kind] = key.split("\0") as [string, string, SnapshotKind];
    const kinds = byRace.get(raceId) ?? new Map();
    const horses = kinds.get(kind) ?? new Map();
    horses.set(horseId, priceMovementFromHistory(history));
    kinds.set(kind, horses);
    byRace.set(raceId, kinds);
  }
  return byRace;
}
