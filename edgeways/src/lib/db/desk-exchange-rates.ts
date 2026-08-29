import type { ExchangeRow } from "@/lib/db/schema";

export type DeskExchangeOverlay = {
  commissionPct: number;
  isDefault: boolean;
};

/**
 * Overlay per-desk commission and default onto catalog exchange rows.
 * Uses an explicit overlay object so 0% and a non-Betfair default both stick.
 */
export function applyDeskExchangeRates(
  exchanges: ExchangeRow[],
  overlays: ReadonlyMap<number, DeskExchangeOverlay>
): ExchangeRow[] {
  const defaultId = [...overlays.entries()].find(([, overlay]) => overlay.isDefault)?.[0];
  return exchanges.map((exchange) => {
    const overlay = overlays.get(exchange.id);
    const commissionPct = overlay ? overlay.commissionPct : exchange.commissionPct;
    const isDefault =
      defaultId != null ? (exchange.id === defaultId ? 1 : 0) : exchange.isDefault;
    if (!overlay && defaultId == null) return exchange;
    return { ...exchange, commissionPct, isDefault };
  });
}
