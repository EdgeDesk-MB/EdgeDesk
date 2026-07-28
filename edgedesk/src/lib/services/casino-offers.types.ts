/**
 * Client-safe casino offer campaign types (K1, no SQLite / server services).
 */
import type { CasinoOfferComponentRow, CasinoOfferRow } from "@/lib/db/schema";
import type { EvBasis } from "@/lib/offers/advantage";

export interface CasinoOfferSummary extends CasinoOfferRow {
  components: CasinoOfferComponentRow[];
  /** sumCampaignEv(components) - always derived, never the legacy stored column */
  expectedEv: number;
  /** Worst basis across components; "heuristic" if any component defaulted its RTP */
  evBasis: EvBasis;
}
