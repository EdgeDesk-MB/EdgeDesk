import "server-only";
import { eq } from "drizzle-orm";
import {
  db,
  casinoOfferComponents,
  casinoOfferSeries,
  casinoOffers,
  type CasinoOfferComponentRow,
} from "@/lib/db";
import { sumCampaignEv } from "@/lib/calc/casino-reward-ev";
import type { EvBasis } from "@/lib/offers/advantage";
import { getCasinoOfferRecurrenceMeta } from "@/lib/offers/casino-offer-recurrence";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

/** "heuristic" if any component defaulted its RTP; otherwise "estimated". */
function campaignEvBasis(components: CasinoOfferComponentRow[]): EvBasis {
  return components.some((c) => c.rtp == null) ? "heuristic" : "estimated";
}

function summariseCasinoOffer(
  offer: typeof casinoOffers.$inferSelect,
  components: CasinoOfferComponentRow[],
  seriesById: Map<number, typeof casinoOfferSeries.$inferSelect>
): CasinoOfferSummary {
  const sorted = [...components].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const series = offer.seriesId != null ? seriesById.get(offer.seriesId) ?? null : null;
  return {
    ...offer,
    components: sorted,
    expectedEv: sumCampaignEv(sorted),
    evBasis: campaignEvBasis(sorted),
    recurrence: getCasinoOfferRecurrenceMeta(offer, series),
  };
}

export function getCasinoOfferSummaries(): CasinoOfferSummary[] {
  const allOffers = db.select().from(casinoOffers).all();
  const allComponents = db.select().from(casinoOfferComponents).all();
  const allSeries = db.select().from(casinoOfferSeries).all();
  const seriesById = new Map(allSeries.map((s) => [s.id, s]));
  const componentsByOffer = new Map<number, CasinoOfferComponentRow[]>();
  for (const c of allComponents) {
    const list = componentsByOffer.get(c.casinoOfferId) ?? [];
    list.push(c);
    componentsByOffer.set(c.casinoOfferId, list);
  }

  return allOffers
    .map((offer) =>
      summariseCasinoOffer(offer, componentsByOffer.get(offer.id) ?? [], seriesById)
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getCasinoOfferSummary(id: number): CasinoOfferSummary | null {
  const offer = db.select().from(casinoOffers).where(eq(casinoOffers.id, id)).get();
  if (!offer) return null;
  const components = db
    .select()
    .from(casinoOfferComponents)
    .where(eq(casinoOfferComponents.casinoOfferId, id))
    .all();
  const series =
    offer.seriesId != null
      ? db.select().from(casinoOfferSeries).where(eq(casinoOfferSeries.id, offer.seriesId)).get()
      : null;
  const seriesById = new Map(series ? [[series.id, series] as const] : []);
  return summariseCasinoOffer(offer, components, seriesById);
}
