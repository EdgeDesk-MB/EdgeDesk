/**
 * Per-desk exchange commission and default on Neon. Catalog rows stay shared.
 */
import "server-only";

import { eq } from "drizzle-orm";
import {
  applyDeskExchangeRates,
  type DeskExchangeOverlay,
} from "@/lib/db/desk-exchange-rates";
import {
  insertNeonExchange,
  listNeonExchanges,
} from "@/lib/db/neon-desk-accounts";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import { deskExchangeRates } from "@/lib/db/schema.pg";
import type { ExchangeRow } from "@/lib/db/schema";

export async function listNeonDeskExchangeOverlays(): Promise<
  Map<number, DeskExchangeOverlay>
> {
  const clerkUserId = neonDeskClerkUserId();
  const overlays = new Map<number, DeskExchangeOverlay>();
  if (!clerkUserId) return overlays;
  const rows = await getNeonDb()
    .select({
      exchangeId: deskExchangeRates.exchangeId,
      commissionPct: deskExchangeRates.commissionPct,
      isDefault: deskExchangeRates.isDefault,
    })
    .from(deskExchangeRates)
    .where(eq(deskExchangeRates.clerkUserId, clerkUserId));
  for (const row of rows) {
    overlays.set(row.exchangeId, {
      commissionPct: row.commissionPct,
      isDefault: row.isDefault === 1,
    });
  }
  return overlays;
}

export async function listNeonDeskExchanges(): Promise<ExchangeRow[]> {
  const [exchanges, overlays] = await Promise.all([
    listNeonExchanges(),
    listNeonDeskExchangeOverlays(),
  ]);
  return applyDeskExchangeRates(exchanges, overlays);
}

export async function upsertNeonDeskExchangeRate(
  exchangeId: number,
  commissionPct: number
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save exchange commission.");
  }
  const now = Date.now();
  await getNeonDb()
    .insert(deskExchangeRates)
    .values({
      clerkUserId,
      exchangeId,
      commissionPct,
      isDefault: 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [deskExchangeRates.clerkUserId, deskExchangeRates.exchangeId],
      set: { commissionPct, updatedAt: now },
    });
}

export async function setNeonDeskDefaultExchange(exchangeId: number): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save the default exchange.");
  }
  const catalog = await listNeonExchanges();
  const match = catalog.find((row) => row.id === exchangeId);
  if (!match) {
    throw new Error("Exchange not found");
  }
  const overlays = await listNeonDeskExchangeOverlays();
  const commissionPct = overlays.get(exchangeId)?.commissionPct ?? match.commissionPct;
  const now = Date.now();
  const db = getNeonDb();
  await db
    .update(deskExchangeRates)
    .set({ isDefault: 0, updatedAt: now })
    .where(eq(deskExchangeRates.clerkUserId, clerkUserId));
  await db
    .insert(deskExchangeRates)
    .values({
      clerkUserId,
      exchangeId,
      commissionPct,
      isDefault: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [deskExchangeRates.clerkUserId, deskExchangeRates.exchangeId],
      set: { isDefault: 1, commissionPct, updatedAt: now },
    });
}

export async function createNeonDeskExchange(input: {
  name: string;
  commissionPct: number;
  brandColor: string;
  backColor: string;
  layColor: string;
  isDefault: boolean;
}): Promise<ExchangeRow> {
  const created = await insertNeonExchange({ ...input, isDefault: false });
  await upsertNeonDeskExchangeRate(created.id, input.commissionPct);
  if (input.isDefault) {
    await setNeonDeskDefaultExchange(created.id);
  }
  const rows = await listNeonDeskExchanges();
  return rows.find((row) => row.id === created.id) ?? created;
}
