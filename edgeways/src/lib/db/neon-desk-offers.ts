/**
 * Hosted desk offers on Neon (EDGE-47). Recurrence series stay SQLite-only
 * until their own cutover; playbook steps and EV tags write this table /
 * offer_ev_snapshots. The hosted path covers single campaigns: list, create,
 * edit, delete.
 */
import "server-only";

import { and, eq } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import { toSqliteOfferRow } from "@/lib/db/neon-desk-map";
import { offers as pgOffers } from "@/lib/db/schema.pg";
import type { OfferRow } from "@/lib/db/schema";

export type NeonDeskOfferValues = {
  bookmaker?: string | null;
  title: string;
  description?: string | null;
  expectedProfit?: number | null;
  status?: "planned" | "active" | "completed" | "expired";
  expiresAt?: number | null;
  startsOn?: string | null;
  sport?: string | null;
  offerType?: string | null;
  scopeCourse?: string | null;
  eventDate?: string | null;
  scopeRaceId?: string | null;
  scopeRaceLabel?: string | null;
  rules?: string | null;
  offerUrl?: string | null;
  createdAt: number;
};

export async function listNeonDeskOffers(
  clerkUserId?: string | null
): Promise<OfferRow[]> {
  const id = clerkUserId?.trim() || neonDeskClerkUserId();
  if (!id) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgOffers)
    .where(eq(pgOffers.clerkUserId, id))
    .orderBy(pgOffers.id);
  return rows.map(toSqliteOfferRow);
}

export async function getNeonDeskOffer(id: number): Promise<OfferRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const rows = await getNeonDb()
    .select()
    .from(pgOffers)
    .where(and(eq(pgOffers.id, id), eq(pgOffers.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0] ? toSqliteOfferRow(rows[0]) : null;
}

export async function insertNeonDeskOffer(
  values: NeonDeskOfferValues
): Promise<OfferRow> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save an offer.");
  }
  const rows = await getNeonDb()
    .insert(pgOffers)
    .values({ ...values, clerkUserId })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Neon did not return the saved offer.");
  }
  return toSqliteOfferRow(row);
}

export type NeonDeskOfferPatch = Partial<
  Omit<NeonDeskOfferValues, "createdAt">
> & { completedAt?: number | null };

export async function patchNeonDeskOffer(
  id: number,
  patch: NeonDeskOfferPatch
): Promise<OfferRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save an offer.");
  }
  const rows = await getNeonDb()
    .update(pgOffers)
    .set(patch)
    .where(and(eq(pgOffers.id, id), eq(pgOffers.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteOfferRow(rows[0]) : null;
}

/** Deletes this login's offer only. Linked bets keep their offerId (orphan = unmatched). */
export async function deleteNeonDeskOffer(id: number): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const rows = await getNeonDb()
    .delete(pgOffers)
    .where(and(eq(pgOffers.id, id), eq(pgOffers.clerkUserId, clerkUserId)))
    .returning({ id: pgOffers.id });
  return rows.length > 0;
}
