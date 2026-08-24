/**
 * Hosted casino desk on Neon (EDGE-47 casino cutover). Clerk-scoped like the
 * rest of the desk; rows are mapped to the SQLite shapes so services and UI
 * consume either backend unchanged.
 *
 * Recurring-series machinery (materialisation, template sealing) stays
 * SQLite-only: restored series rows are readable here so instances render
 * their recurrence meta, but creating/editing series is rejected at the
 * route layer on the hosted desk.
 */
import "server-only";

import { and, desc, eq, gte } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import {
  toSqliteCasinoGameRow,
  toSqliteCasinoOfferComponentRow,
  toSqliteCasinoOfferRow,
  toSqliteCasinoOfferSeriesComponentRow,
  toSqliteCasinoOfferSeriesRow,
} from "@/lib/db/neon-desk-map";
import {
  insertNeonDeskAccount,
  insertNeonDeskTransaction,
  listNeonDeskAccounts,
  patchNeonDeskAccount,
} from "@/lib/db/neon-desk-accounts";
import { insertNeonDeskHistory } from "@/lib/db/neon-desk-history";
import { getNeonDb } from "@/lib/db/neon";
import {
  casinoGames as pgCasinoGames,
  casinoOfferComponents as pgCasinoOfferComponents,
  casinoOfferSeries as pgCasinoOfferSeries,
  casinoOfferSeriesComponents as pgCasinoOfferSeriesComponents,
  casinoOffers as pgCasinoOffers,
  balanceTransactions as pgBalanceTransactions,
  history as pgHistory,
} from "@/lib/db/schema.pg";
import type {
  CasinoGameRow,
  CasinoOfferComponentRow,
  CasinoOfferRow,
  CasinoOfferSeriesComponentRow,
  CasinoOfferSeriesRow,
} from "@/lib/db/schema";
import { sumCampaignEv } from "@/lib/calc/casino-reward-ev";
import { roundPence } from "@/lib/calc/money";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { SEED_GAMES } from "@/lib/casino/game-library";
import type { EvBasis } from "@/lib/offers/advantage";
import { getCasinoOfferRecurrenceMeta } from "@/lib/offers/casino-offer-recurrence";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

export type NeonDeskCasinoRows = {
  offers: CasinoOfferRow[];
  series: CasinoOfferSeriesRow[];
  components: CasinoOfferComponentRow[];
  seriesComponents: CasinoOfferSeriesComponentRow[];
  games: CasinoGameRow[];
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listNeonDeskCasinoOffers(): Promise<CasinoOfferRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgCasinoOffers)
    .where(eq(pgCasinoOffers.clerkUserId, clerkUserId))
    .orderBy(pgCasinoOffers.id);
  return rows.map(toSqliteCasinoOfferRow);
}

export async function getNeonDeskCasinoOffer(
  id: number
): Promise<CasinoOfferRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const rows = await getNeonDb()
    .select()
    .from(pgCasinoOffers)
    .where(and(eq(pgCasinoOffers.id, id), eq(pgCasinoOffers.clerkUserId, clerkUserId)))
    .limit(1);
  return rows[0] ? toSqliteCasinoOfferRow(rows[0]) : null;
}

export async function listNeonDeskCasinoRows(): Promise<NeonDeskCasinoRows> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    return { offers: [], series: [], components: [], seriesComponents: [], games: [] };
  }
  const db = getNeonDb();
  const [offers, series, components, seriesComponents, games] =
    await Promise.all([
      db.select().from(pgCasinoOffers).where(eq(pgCasinoOffers.clerkUserId, clerkUserId)).orderBy(pgCasinoOffers.id),
      db.select().from(pgCasinoOfferSeries).where(eq(pgCasinoOfferSeries.clerkUserId, clerkUserId)).orderBy(pgCasinoOfferSeries.id),
      db.select().from(pgCasinoOfferComponents).where(eq(pgCasinoOfferComponents.clerkUserId, clerkUserId)).orderBy(pgCasinoOfferComponents.id),
      db.select().from(pgCasinoOfferSeriesComponents).where(eq(pgCasinoOfferSeriesComponents.clerkUserId, clerkUserId)).orderBy(pgCasinoOfferSeriesComponents.id),
      db.select().from(pgCasinoGames).where(eq(pgCasinoGames.clerkUserId, clerkUserId)).orderBy(pgCasinoGames.id),
    ]);
  return {
    offers: offers.map(toSqliteCasinoOfferRow),
    series: series.map(toSqliteCasinoOfferSeriesRow),
    components: components.map(toSqliteCasinoOfferComponentRow),
    seriesComponents: seriesComponents.map(toSqliteCasinoOfferSeriesComponentRow),
    games: games.map(toSqliteCasinoGameRow),
  };
}

// ---------------------------------------------------------------------------
// Summaries (same shape as services/casino-offers.ts, minus SQLite backfills
// and reminders - hosted reminders are not wired to casino yet)
// ---------------------------------------------------------------------------

function campaignEvBasis(components: CasinoOfferComponentRow[]): EvBasis {
  return components.some((c) => c.rtp == null) ? "heuristic" : "estimated";
}

function summariseNeonCasinoOffer(
  offer: CasinoOfferRow,
  components: CasinoOfferComponentRow[],
  seriesById: Map<number, CasinoOfferSeriesRow>
): CasinoOfferSummary {
  const sorted = [...components].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  // Never call getCasinoOfferRecurrenceMeta without an explicit series row:
  // its fallback queries SQLite, which on the hosted desk is an empty
  // in-memory database.
  const seriesRow = offer.seriesId != null ? seriesById.get(offer.seriesId) : undefined;
  return {
    ...offer,
    components: sorted,
    expectedEv: sumCampaignEv(sorted),
    evBasis: campaignEvBasis(sorted),
    recurrence: seriesRow ? getCasinoOfferRecurrenceMeta(offer, seriesRow) : null,
    reminders: [],
  };
}

export function summariseNeonCasinoOffers(
  rows: NeonDeskCasinoRows
): CasinoOfferSummary[] {
  const seriesById = new Map(rows.series.map((s) => [s.id, s]));
  const componentsByOffer = new Map<number, CasinoOfferComponentRow[]>();
  for (const c of rows.components) {
    const list = componentsByOffer.get(c.casinoOfferId) ?? [];
    list.push(c);
    componentsByOffer.set(c.casinoOfferId, list);
  }
  return rows.offers
    .map((offer) =>
      summariseNeonCasinoOffer(offer, componentsByOffer.get(offer.id) ?? [], seriesById)
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getNeonCasinoOfferSummary(
  id: number
): Promise<CasinoOfferSummary | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return null;
  const db = getNeonDb();
  const offer = await getNeonDeskCasinoOffer(id);
  if (!offer) return null;
  const components = (
    await db
      .select()
      .from(pgCasinoOfferComponents)
      .where(
        and(
          eq(pgCasinoOfferComponents.casinoOfferId, id),
          eq(pgCasinoOfferComponents.clerkUserId, clerkUserId)
        )
      )
  ).map(toSqliteCasinoOfferComponentRow);
  const seriesById = new Map<number, CasinoOfferSeriesRow>();
  if (offer.seriesId != null) {
    const seriesRows = await db
      .select()
      .from(pgCasinoOfferSeries)
      .where(
        and(
          eq(pgCasinoOfferSeries.id, offer.seriesId),
          eq(pgCasinoOfferSeries.clerkUserId, clerkUserId)
        )
      )
      .limit(1);
    if (seriesRows[0]) {
      seriesById.set(seriesRows[0].id, toSqliteCasinoOfferSeriesRow(seriesRows[0]));
    }
  }
  return summariseNeonCasinoOffer(offer, components, seriesById);
}

// ---------------------------------------------------------------------------
// Offer writes
// ---------------------------------------------------------------------------

export type NeonDeskCasinoOfferValues = {
  casino?: string | null;
  title: string;
  status?: "planned" | "active";
  notes?: string | null;
  offerUrl?: string | null;
  expiresAt?: number | null;
};

export async function insertNeonDeskCasinoOffer(
  values: NeonDeskCasinoOfferValues
): Promise<CasinoOfferRow> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save a casino offer.");
  }
  const rows = await getNeonDb()
    .insert(pgCasinoOffers)
    .values({
      clerkUserId,
      casino: values.casino ?? null,
      title: values.title,
      // Legacy pre-K1 columns zeroed/nulled, same as the SQLite route.
      bonusAmount: 0,
      wageringMultiplier: 0,
      rtp: null,
      contributionPct: null,
      expectedEv: 0,
      game: null,
      status: values.status ?? "planned",
      notes: values.notes ?? null,
      offerUrl: values.offerUrl ?? null,
      expiresAt: values.expiresAt ?? null,
      createdAt: Date.now(),
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Neon did not return the saved casino offer.");
  }
  return toSqliteCasinoOfferRow(row);
}

export type NeonDeskCasinoOfferPatch = Partial<{
  casino: string | null;
  title: string;
  status: "planned" | "active" | "completed" | "expired";
  actualProfit: number | null;
  notes: string | null;
  offerUrl: string | null;
  expiresAt: number | null;
  completedAt: number | null;
}>;

export async function patchNeonDeskCasinoOffer(
  id: number,
  patch: NeonDeskCasinoOfferPatch
): Promise<CasinoOfferRow | null> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save a casino offer.");
  }
  const rows = await getNeonDb()
    .update(pgCasinoOffers)
    .set(patch)
    .where(and(eq(pgCasinoOffers.id, id), eq(pgCasinoOffers.clerkUserId, clerkUserId)))
    .returning();
  return rows[0] ? toSqliteCasinoOfferRow(rows[0]) : null;
}

/**
 * Delete a casino offer and its components. scope="future" also deletes
 * same-series instances dated on/after this one (restored series only -
 * series creation is not available on the hosted desk).
 */
export async function deleteNeonDeskCasinoOffer(
  offer: CasinoOfferRow,
  scope: "instance" | "future"
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  const db = getNeonDb();
  const ids = [offer.id];
  if (scope === "future" && offer.seriesId != null && offer.instanceDate) {
    const siblings = await db
      .select({ id: pgCasinoOffers.id })
      .from(pgCasinoOffers)
      .where(
        and(
          eq(pgCasinoOffers.clerkUserId, clerkUserId),
          eq(pgCasinoOffers.seriesId, offer.seriesId),
          gte(pgCasinoOffers.instanceDate, offer.instanceDate)
        )
      );
    for (const s of siblings) ids.push(s.id);
  }
  for (const id of ids) {
    await clearNeonCasinoOfferBalance(id);
    await db
      .delete(pgCasinoOfferComponents)
      .where(
        and(
          eq(pgCasinoOfferComponents.casinoOfferId, id),
          eq(pgCasinoOfferComponents.clerkUserId, clerkUserId)
        )
      );
    await db
      .delete(pgCasinoOffers)
      .where(and(eq(pgCasinoOffers.id, id), eq(pgCasinoOffers.clerkUserId, clerkUserId)));
  }
}

// ---------------------------------------------------------------------------
// Component writes
// ---------------------------------------------------------------------------

export type NeonDeskCasinoComponentValues = {
  casinoOfferId: number;
  componentType: CasinoOfferComponentRow["componentType"];
  amount?: number | null;
  wageringMultiplier?: number | null;
  rtp?: number | null;
  contributionPct?: number | null;
  spins?: number | null;
  spinValue?: number | null;
  chipCount?: number | null;
  chipValue?: number | null;
  houseEdgePreset?: "european" | "american" | "custom" | null;
  cashbackPct?: number | null;
  cashbackCap?: number | null;
  game?: string | null;
  eligibleGamesJson?: string | null;
  expectedEv: number;
  sortOrder: number;
};

export async function countNeonDeskCasinoComponents(offerId: number): Promise<number> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return 0;
  const rows = await getNeonDb()
    .select({ id: pgCasinoOfferComponents.id })
    .from(pgCasinoOfferComponents)
    .where(
      and(
        eq(pgCasinoOfferComponents.casinoOfferId, offerId),
        eq(pgCasinoOfferComponents.clerkUserId, clerkUserId)
      )
    );
  return rows.length;
}

export async function insertNeonDeskCasinoComponent(
  values: NeonDeskCasinoComponentValues
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save a casino component.");
  }
  await getNeonDb()
    .insert(pgCasinoOfferComponents)
    .values({ ...values, clerkUserId, createdAt: Date.now() });
}

export async function patchNeonDeskCasinoComponent(
  id: number,
  offerId: number,
  fields: Partial<Omit<NeonDeskCasinoComponentValues, "casinoOfferId" | "sortOrder">>
): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const rows = await getNeonDb()
    .update(pgCasinoOfferComponents)
    .set(fields)
    .where(
      and(
        eq(pgCasinoOfferComponents.id, id),
        eq(pgCasinoOfferComponents.casinoOfferId, offerId),
        eq(pgCasinoOfferComponents.clerkUserId, clerkUserId)
      )
    )
    .returning({ id: pgCasinoOfferComponents.id });
  return rows.length > 0;
}

export async function deleteNeonDeskCasinoComponent(
  id: number,
  offerId: number
): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const rows = await getNeonDb()
    .delete(pgCasinoOfferComponents)
    .where(
      and(
        eq(pgCasinoOfferComponents.id, id),
        eq(pgCasinoOfferComponents.casinoOfferId, offerId),
        eq(pgCasinoOfferComponents.clerkUserId, clerkUserId)
      )
    )
    .returning({ id: pgCasinoOfferComponents.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Game library
// ---------------------------------------------------------------------------

export async function listNeonDeskCasinoGames(): Promise<CasinoGameRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgCasinoGames)
    .where(eq(pgCasinoGames.clerkUserId, clerkUserId))
    .orderBy(desc(pgCasinoGames.rtp));
  return rows.map(toSqliteCasinoGameRow);
}

/** Seed once per desk: reference rows land only when the library is empty. */
export async function seedNeonCasinoGamesIfEmpty(): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  const db = getNeonDb();
  const existing = await db
    .select({ id: pgCasinoGames.id })
    .from(pgCasinoGames)
    .where(eq(pgCasinoGames.clerkUserId, clerkUserId))
    .limit(1);
  if (existing.length > 0) return;
  const now = Date.now();
  for (const g of SEED_GAMES) {
    await db
      .insert(pgCasinoGames)
      .values({
        clerkUserId,
        name: g.name,
        provider: g.provider,
        rtp: g.rtp,
        source: "seed",
        updatedAt: now,
      })
      .onConflictDoNothing();
  }
}

export async function upsertNeonDeskCasinoGame(input: {
  name: string;
  provider: string | null;
  rtp: number;
}): Promise<CasinoGameRow> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save a game.");
  }
  const rows = await getNeonDb()
    .insert(pgCasinoGames)
    .values({
      clerkUserId,
      name: input.name,
      provider: input.provider,
      rtp: input.rtp,
      source: "user",
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: [pgCasinoGames.clerkUserId, pgCasinoGames.name],
      set: {
        provider: input.provider,
        rtp: input.rtp,
        source: "user",
        updatedAt: Date.now(),
      },
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Neon did not return the saved game.");
  }
  return toSqliteCasinoGameRow(row);
}

export async function deleteNeonDeskCasinoGame(id: number): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const rows = await getNeonDb()
    .delete(pgCasinoGames)
    .where(and(eq(pgCasinoGames.id, id), eq(pgCasinoGames.clerkUserId, clerkUserId)))
    .returning({ id: pgCasinoGames.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Ledger sync (mirror of services/balances.ts syncCasinoOfferBalance)
// ---------------------------------------------------------------------------

/** Keep in sync with services/balances.ts casinoSettlementDedupe. */
function neonCasinoSettlementDedupe(casinoOfferId: number): string {
  return `casino:${casinoOfferId}`;
}

export async function clearNeonCasinoOfferBalance(
  casinoOfferId: number
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  const db = getNeonDb();
  await db
    .delete(pgBalanceTransactions)
    .where(
      and(
        eq(pgBalanceTransactions.casinoOfferId, casinoOfferId),
        eq(pgBalanceTransactions.clerkUserId, clerkUserId)
      )
    );
  await db
    .delete(pgHistory)
    .where(
      and(
        eq(pgHistory.dedupe, neonCasinoSettlementDedupe(casinoOfferId)),
        eq(pgHistory.clerkUserId, clerkUserId)
      )
    );
}

/** Find or create the bookie wallet for a free-typed casino name. */
async function ensureNeonVenueAccount(name: string) {
  const trimmed = name.trim();
  const q = trimmed.toLowerCase();
  const accounts = await listNeonDeskAccounts();
  const active = accounts.find(
    (a) => a.type === "bookie" && a.isActive === 1 && a.name.toLowerCase() === q
  );
  if (active) return active;
  const inactive = accounts.find(
    (a) => a.type === "bookie" && a.name.toLowerCase() === q
  );
  if (inactive) {
    const updated = await patchNeonDeskAccount(inactive.id, {
      isActive: 1,
      brandColor: inactive.brandColor ?? bookieBrandColor(trimmed),
    });
    if (updated) return updated;
  }
  return insertNeonDeskAccount({
    name: trimmed,
    type: "bookie",
    brandColor: bookieBrandColor(trimmed),
    isActive: 1,
    createdAt: Date.now(),
  });
}

/**
 * Full casino ledger sync on Neon: bookie wallet + History/Home feed row.
 * Mirrors syncCasinoOfferBalance in services/balances.ts.
 */
export async function syncNeonCasinoOfferBalance(
  offer: Pick<
    CasinoOfferRow,
    "id" | "casino" | "title" | "status" | "actualProfit" | "completedAt" | "createdAt"
  >
): Promise<boolean> {
  await clearNeonCasinoOfferBalance(offer.id);

  if (offer.status !== "completed") return false;
  if (offer.actualProfit == null) return false;

  const amount = roundPence(offer.actualProfit);
  const casino = offer.casino?.trim() || null;
  const when = offer.completedAt ?? offer.createdAt ?? Date.now();
  const detail = casino ? `${casino} · ${offer.title}` : offer.title;

  await insertNeonDeskHistory({
    dedupe: neonCasinoSettlementDedupe(offer.id),
    kind: "casino_settlement",
    title: "Casino settled",
    detail,
    amount,
    createdAt: when,
  });

  // Zero net or missing venue: feed row still stands; wallet only moves when
  // there is both a named bookie and a non-zero amount.
  if (casino && amount !== 0) {
    const bookie = await ensureNeonVenueAccount(casino);
    await insertNeonDeskTransaction({
      accountId: bookie.id,
      amount,
      category: "casino_settlement",
      casinoOfferId: offer.id,
      affectPnl: 0,
      note: `Casino campaign - ${offer.title}`,
      createdAt: Date.now(),
    });
  }
  return true;
}
