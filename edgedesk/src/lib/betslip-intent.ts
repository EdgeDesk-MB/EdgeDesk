/**
 * Betslip fill intent (J9) - one click copies a structured intent for the
 * browser extension AND puts the stake on the clipboard first, so a
 * missing or broken extension degrades gracefully. Fill only: the
 * extension never places a bet; the user always clicks the exchange's own
 * confirm. Zero odds scraping anywhere (D2 intact).
 */

export interface BetslipIntent {
  side: "back" | "lay";
  selection: string;
  /** £ stake, already pence-rounded by the calling calculator */
  stake: number;
  /** Advisory only - shown nowhere on the exchange, never scraped */
  odds?: number;
}

export const FILL_SLIP_EVENT = "edgedesk:fill-slip";

export function buildFillSlipDetail(intent: BetslipIntent): BetslipIntent | null {
  if (!(intent.stake > 0) || !Number.isFinite(intent.stake)) return null;
  if (!intent.selection.trim()) return null;
  return {
    side: intent.side,
    selection: intent.selection.trim(),
    stake: Math.round(intent.stake * 100) / 100,
    ...(intent.odds != null && intent.odds > 1 ? { odds: intent.odds } : {}),
  };
}

/** Clipboard first (the graceful degrade), then the extension event. */
export async function emitFillSlip(intent: BetslipIntent): Promise<boolean> {
  const detail = buildFillSlipDetail(intent);
  if (!detail) return false;
  try {
    await navigator.clipboard.writeText(detail.stake.toFixed(2));
  } catch {
    /* clipboard can be denied - the event still fires */
  }
  document.dispatchEvent(new CustomEvent(FILL_SLIP_EVENT, { detail }));
  return true;
}
