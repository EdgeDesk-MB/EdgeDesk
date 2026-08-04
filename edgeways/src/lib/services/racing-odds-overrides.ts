/**
 * Manual bookie/exchange odds overrides for Racing Desk.
 * Lets Free-tier users paste real prices over proxy estimates - £0 API cost.
 */
import { and, eq } from "drizzle-orm";
import { db, racingOddsOverrides } from "@/lib/db";

export interface RacingOddsOverride {
  raceId: string;
  horseId: string;
  bookieDecimal: number | null;
  exchangeDecimal: number | null;
  updatedAt: number;
}

export function listOverridesForRace(raceId: string): Map<string, RacingOddsOverride> {
  const rows = db
    .select()
    .from(racingOddsOverrides)
    .where(eq(racingOddsOverrides.raceId, raceId))
    .all();
  const map = new Map<string, RacingOddsOverride>();
  for (const row of rows) {
    map.set(row.horseId, {
      raceId: row.raceId,
      horseId: row.horseId,
      bookieDecimal: row.bookieDecimal,
      exchangeDecimal: row.exchangeDecimal,
      updatedAt: row.updatedAt,
    });
  }
  return map;
}

export function listOverridesForRaces(
  raceIds: string[]
): Map<string, Map<string, RacingOddsOverride>> {
  const byRace = new Map<string, Map<string, RacingOddsOverride>>();
  if (raceIds.length === 0) return byRace;
  for (const raceId of raceIds) {
    byRace.set(raceId, listOverridesForRace(raceId));
  }
  return byRace;
}

export function upsertOddsOverride(input: {
  raceId: string;
  horseId: string;
  bookieDecimal?: number | null;
  exchangeDecimal?: number | null;
}): RacingOddsOverride {
  const now = Date.now();
  const existing = db
    .select()
    .from(racingOddsOverrides)
    .where(
      and(
        eq(racingOddsOverrides.raceId, input.raceId),
        eq(racingOddsOverrides.horseId, input.horseId)
      )
    )
    .get();

  const bookie =
    input.bookieDecimal !== undefined
      ? input.bookieDecimal
      : (existing?.bookieDecimal ?? null);
  const exchange =
    input.exchangeDecimal !== undefined
      ? input.exchangeDecimal
      : (existing?.exchangeDecimal ?? null);

  if (bookie == null && exchange == null) {
    if (existing) {
      db.delete(racingOddsOverrides)
        .where(
          and(
            eq(racingOddsOverrides.raceId, input.raceId),
            eq(racingOddsOverrides.horseId, input.horseId)
          )
        )
        .run();
    }
    return {
      raceId: input.raceId,
      horseId: input.horseId,
      bookieDecimal: null,
      exchangeDecimal: null,
      updatedAt: now,
    };
  }

  if (existing) {
    db.update(racingOddsOverrides)
      .set({
        bookieDecimal: bookie,
        exchangeDecimal: exchange,
        updatedAt: now,
      })
      .where(
        and(
          eq(racingOddsOverrides.raceId, input.raceId),
          eq(racingOddsOverrides.horseId, input.horseId)
        )
      )
      .run();
  } else {
    db.insert(racingOddsOverrides)
      .values({
        raceId: input.raceId,
        horseId: input.horseId,
        bookieDecimal: bookie,
        exchangeDecimal: exchange,
        updatedAt: now,
      })
      .run();
  }

  return {
    raceId: input.raceId,
    horseId: input.horseId,
    bookieDecimal: bookie,
    exchangeDecimal: exchange,
    updatedAt: now,
  };
}

export function clearOddsOverride(raceId: string, horseId: string): void {
  db.delete(racingOddsOverrides)
    .where(
      and(eq(racingOddsOverrides.raceId, raceId), eq(racingOddsOverrides.horseId, horseId))
    )
    .run();
}
