/**
 * Hosted Racing Desk pasted odds. Clerk-scoped so two customers can paste
 * different prices on the same runner.
 */
import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { racingOddsOverrides as pgOverrides } from "@/lib/db/schema.pg";
import type { RacingOddsOverride } from "@/lib/services/racing-odds-overrides";

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function toOverride(row: {
  raceId: string;
  horseId: string;
  bookieDecimal: number | null;
  exchangeDecimal: number | null;
  updatedAt: number;
}): RacingOddsOverride {
  return {
    raceId: row.raceId,
    horseId: row.horseId,
    bookieDecimal: row.bookieDecimal,
    exchangeDecimal: row.exchangeDecimal,
    updatedAt: row.updatedAt,
  };
}

export async function listNeonOverridesForRaces(
  raceIds: string[]
): Promise<Map<string, Map<string, RacingOddsOverride>>> {
  const byRace = new Map<string, Map<string, RacingOddsOverride>>();
  for (const raceId of raceIds) byRace.set(raceId, new Map());
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId || raceIds.length === 0) return byRace;
  const rows = await getNeonDb()
    .select()
    .from(pgOverrides)
    .where(
      and(eq(pgOverrides.clerkUserId, clerkUserId), inArray(pgOverrides.raceId, raceIds))
    );
  for (const row of rows) {
    const map = byRace.get(row.raceId) ?? new Map();
    map.set(row.horseId, toOverride(row));
    byRace.set(row.raceId, map);
  }
  return byRace;
}

export async function upsertNeonOddsOverride(input: {
  raceId: string;
  horseId: string;
  bookieDecimal?: number | null;
  exchangeDecimal?: number | null;
}): Promise<RacingOddsOverride> {
  const clerkUserId = requireClerk("save pasted odds");
  const now = Date.now();
  const existing = await getNeonDb()
    .select()
    .from(pgOverrides)
    .where(
      and(
        eq(pgOverrides.clerkUserId, clerkUserId),
        eq(pgOverrides.raceId, input.raceId),
        eq(pgOverrides.horseId, input.horseId)
      )
    )
    .limit(1);
  const bookie =
    input.bookieDecimal !== undefined
      ? input.bookieDecimal
      : (existing[0]?.bookieDecimal ?? null);
  const exchange =
    input.exchangeDecimal !== undefined
      ? input.exchangeDecimal
      : (existing[0]?.exchangeDecimal ?? null);

  if (bookie == null && exchange == null) {
    if (existing[0]) {
      await getNeonDb()
        .delete(pgOverrides)
        .where(
          and(eq(pgOverrides.id, existing[0].id), eq(pgOverrides.clerkUserId, clerkUserId))
        );
    }
    return {
      raceId: input.raceId,
      horseId: input.horseId,
      bookieDecimal: null,
      exchangeDecimal: null,
      updatedAt: now,
    };
  }

  if (existing[0]) {
    const rows = await getNeonDb()
      .update(pgOverrides)
      .set({ bookieDecimal: bookie, exchangeDecimal: exchange, updatedAt: now })
      .where(and(eq(pgOverrides.id, existing[0].id), eq(pgOverrides.clerkUserId, clerkUserId)))
      .returning();
    return toOverride(rows[0] ?? { ...existing[0], bookieDecimal: bookie, exchangeDecimal: exchange, updatedAt: now });
  }

  const rows = await getNeonDb()
    .insert(pgOverrides)
    .values({
      raceId: input.raceId,
      horseId: input.horseId,
      bookieDecimal: bookie,
      exchangeDecimal: exchange,
      updatedAt: now,
      clerkUserId,
    })
    .returning();
  if (!rows[0]) throw new Error("Neon did not return the odds override.");
  return toOverride(rows[0]);
}

export async function clearNeonOddsOverride(
  raceId: string,
  horseId: string
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  await getNeonDb()
    .delete(pgOverrides)
    .where(
      and(
        eq(pgOverrides.clerkUserId, clerkUserId),
        eq(pgOverrides.raceId, raceId),
        eq(pgOverrides.horseId, horseId)
      )
    );
}
