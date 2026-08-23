/**
 * Hosted casino rows on Neon (EDGE-47 casino cutover). Clerk-scoped like the
 * rest of the desk; mapped to the SQLite row shapes so services code can
 * consume either backend unchanged.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { toSqliteCasinoOfferRow } from "@/lib/db/neon-desk-map";
import { getNeonDb } from "@/lib/db/neon";
import {
  casinoGames as pgCasinoGames,
  casinoOfferComponents as pgCasinoOfferComponents,
  casinoOfferSeries as pgCasinoOfferSeries,
  casinoOfferSeriesComponents as pgCasinoOfferSeriesComponents,
  casinoOffers as pgCasinoOffers,
} from "@/lib/db/schema.pg";
import type {
  CasinoGameRow as PgCasinoGameRow,
  CasinoOfferComponentRow as PgCasinoOfferComponentRow,
  CasinoOfferSeriesComponentRow as PgCasinoOfferSeriesComponentRow,
  CasinoOfferSeriesRow as PgCasinoOfferSeriesRow,
} from "@/lib/db/schema.pg";
import type { CasinoOfferRow } from "@/lib/db/schema";

export type NeonDeskCasinoRows = {
  offers: CasinoOfferRow[];
  series: PgCasinoOfferSeriesRow[];
  components: PgCasinoOfferComponentRow[];
  seriesComponents: PgCasinoOfferSeriesComponentRow[];
  games: PgCasinoGameRow[];
};

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

export async function listNeonDeskCasinoRows(): Promise<NeonDeskCasinoRows> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    return { offers: [], series: [], components: [], seriesComponents: [], games: [] };
  }
  const db = getNeonDb();
  const [offers, series, components, seriesComponents, games] =
    await Promise.all([
      db
        .select()
        .from(pgCasinoOffers)
        .where(eq(pgCasinoOffers.clerkUserId, clerkUserId))
        .orderBy(pgCasinoOffers.id),
      db
        .select()
        .from(pgCasinoOfferSeries)
        .where(eq(pgCasinoOfferSeries.clerkUserId, clerkUserId))
        .orderBy(pgCasinoOfferSeries.id),
      db
        .select()
        .from(pgCasinoOfferComponents)
        .where(eq(pgCasinoOfferComponents.clerkUserId, clerkUserId))
        .orderBy(pgCasinoOfferComponents.id),
      db
        .select()
        .from(pgCasinoOfferSeriesComponents)
        .where(eq(pgCasinoOfferSeriesComponents.clerkUserId, clerkUserId))
        .orderBy(pgCasinoOfferSeriesComponents.id),
      db
        .select()
        .from(pgCasinoGames)
        .where(eq(pgCasinoGames.clerkUserId, clerkUserId))
        .orderBy(pgCasinoGames.id),
    ]);
  return {
    offers: offers.map(toSqliteCasinoOfferRow),
    series,
    components,
    seriesComponents,
    games,
  };
}
