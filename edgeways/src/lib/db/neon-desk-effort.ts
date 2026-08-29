/**
 * Hosted offer-effort samples. Powers £/hr on Do Next for this Clerk user.
 */
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDeskOffer } from "@/lib/db/neon-desk-offers";
import {
  offerEffortSamples as pgEffort,
  type OfferEffortSampleRow as PgEffortRow,
} from "@/lib/db/schema.pg";
import type { OfferEffortSampleRow } from "@/lib/db/schema";
import { medianEffortByKind } from "@/lib/offers/effort";

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function toSqliteEffort(row: PgEffortRow): OfferEffortSampleRow {
  return {
    id: row.id,
    offerId: row.offerId,
    actionKind: row.actionKind,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMin: row.durationMin,
    edited: row.edited,
    createdAt: row.createdAt,
  };
}

export async function listNeonEffortSamples(
  offerId: number
): Promise<OfferEffortSampleRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgEffort)
    .where(and(eq(pgEffort.offerId, offerId), eq(pgEffort.clerkUserId, clerkUserId)))
    .orderBy(desc(pgEffort.createdAt));
  return rows.map(toSqliteEffort);
}

export async function listAllNeonEffortSamples(): Promise<OfferEffortSampleRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgEffort)
    .where(eq(pgEffort.clerkUserId, clerkUserId));
  return rows.map(toSqliteEffort);
}

export async function neonEffortMeasured() {
  return medianEffortByKind(await listAllNeonEffortSamples());
}

export async function createNeonEffortSample(input: {
  offerId: number;
  actionKind: string;
  startedAt: number;
  endedAt: number;
  durationMin: number;
}): Promise<OfferEffortSampleRow> {
  const clerkUserId = requireClerk("log effort");
  const offer = await getNeonDeskOffer(input.offerId);
  if (!offer) throw new Error("Offer not found");
  const rows = await getNeonDb()
    .insert(pgEffort)
    .values({
      offerId: input.offerId,
      actionKind: input.actionKind,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMin: input.durationMin,
      createdAt: Date.now(),
      clerkUserId,
    })
    .returning();
  if (!rows[0]) throw new Error("Neon did not return the effort sample.");
  return toSqliteEffort(rows[0]);
}

export async function patchNeonEffortSample(
  id: number,
  durationMin: number
): Promise<OfferEffortSampleRow | null> {
  const clerkUserId = requireClerk("edit effort");
  const rows = await getNeonDb()
    .update(pgEffort)
    .set({ durationMin, edited: 1 })
    .where(and(eq(pgEffort.id, id), eq(pgEffort.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteEffort(rows[0]) : null;
}
