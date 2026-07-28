import "server-only";
import { eq } from "drizzle-orm";
import { db, casinoOfferComponents, casinoOffers, type CasinoOfferComponentRow } from "@/lib/db";
import { sumCampaignEv } from "@/lib/calc/casino-reward-ev";
import type { EvBasis } from "@/lib/offers/advantage";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

/** "heuristic" if any component defaulted its RTP; otherwise "estimated". */
function campaignEvBasis(components: CasinoOfferComponentRow[]): EvBasis {
  return components.some((c) => c.rtp == null) ? "heuristic" : "estimated";
}

function summariseCasinoOffer(
  offer: typeof casinoOffers.$inferSelect,
  components: CasinoOfferComponentRow[]
): CasinoOfferSummary {
  const sorted = [...components].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  return {
    ...offer,
    components: sorted,
    expectedEv: sumCampaignEv(sorted),
    evBasis: campaignEvBasis(sorted),
  };
}

export function getCasinoOfferSummaries(): CasinoOfferSummary[] {
  const allOffers = db.select().from(casinoOffers).all();
  const allComponents = db.select().from(casinoOfferComponents).all();
  const componentsByOffer = new Map<number, CasinoOfferComponentRow[]>();
  for (const c of allComponents) {
    const list = componentsByOffer.get(c.casinoOfferId) ?? [];
    list.push(c);
    componentsByOffer.set(c.casinoOfferId, list);
  }

  return allOffers
    .map((offer) => summariseCasinoOffer(offer, componentsByOffer.get(offer.id) ?? []))
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
  return summariseCasinoOffer(offer, components);
}
