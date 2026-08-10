/**
 * Acca Desk hedges via separate lay_only bets, not bets.layStake on the
 * qualifying back. Tracker / naked-exposure helpers must recognise that.
 */

import type { BetRow } from "@/lib/db/schema";
import { isDeskFreeBetType } from "@/lib/desk/desk-back-bet-type";

/** Qualifying / free-bet convert back created by Acca Desk. */
export function isAccaDeskBack(bet: Pick<BetRow, "label" | "notes" | "betType">): boolean {
  if (!(bet.label.startsWith("Acca ·") || bet.label.startsWith("Acca FB ·"))) return false;
  return bet.notes?.includes("Acca desk") ?? false;
}

/** Per-leg or whole-acca lay created by Acca Desk. */
export function isAccaDeskLay(bet: Pick<BetRow, "label" | "betType">): boolean {
  return bet.betType === "lay_only" && bet.label.startsWith("Acca lay");
}

export function isAccaDeskConvertBack(
  bet: Pick<BetRow, "label" | "notes" | "betType">
): boolean {
  if (!isAccaDeskBack(bet)) return false;
  return isDeskFreeBetType(bet.betType) || bet.label.startsWith("Acca FB ·");
}

/** Run label from an Acca desk back (`Acca · Weekend` → `Weekend`). */
export function accaRunLabelFromBack(
  bet: Pick<BetRow, "label" | "notes" | "betType">
): string | null {
  if (!isAccaDeskBack(bet)) return null;
  if (bet.label.startsWith("Acca FB · ")) return bet.label.slice("Acca FB · ".length).trim() || null;
  if (bet.label.startsWith("Acca · ")) return bet.label.slice("Acca · ".length).trim() || null;
  return null;
}

/** True when a desk lay belongs to the Acca run named by `runLabel` / `offerId`. */
export function isAccaLayForRun(
  lay: Pick<BetRow, "label" | "notes" | "betType" | "offerId">,
  runLabel: string,
  offerId: number | null
): boolean {
  if (!isAccaDeskLay(lay)) return false;
  if (offerId != null && lay.offerId === offerId) return true;
  if (lay.label === `Acca lay (whole) · ${runLabel}`) return true;
  return lay.notes?.includes(`"${runLabel}"`) ?? false;
}

/** Parse "Acca desk: leg 2 of …" → 2; null if not a sequenced leg lay. */
export function accaLaySeq(bet: Pick<BetRow, "notes" | "label">): number | null {
  const m = bet.notes?.match(/Acca desk:\s*leg\s+(\d+)/i);
  if (m) return Number(m[1]);
  return null;
}

/**
 * Tracker-facing title. Stored ledger labels stay as Acca · / Acca FB · /
 * Acca lay · for identity; the campaign table shows plain language.
 */
export function formatAccaDeskBetDisplayTitle(
  bet: Pick<BetRow, "label" | "betType" | "notes" | "selection" | "market">
): string {
  if (isAccaDeskLay(bet)) {
    const whole = bet.label.startsWith("Acca lay (whole) · ");
    const sel = bet.selection?.trim();
    if (sel) return whole ? `Lay (whole) · ${sel}` : `Lay · ${sel}`;
    const fromMarket = bet.market?.includes(" · ")
      ? bet.market.split(" · ").slice(1).join(" · ").trim()
      : "";
    if (fromMarket) return whole ? `Lay (whole) · ${fromMarket}` : `Lay · ${fromMarket}`;
    const rest = whole
      ? bet.label.slice("Acca lay (whole) · ".length).trim()
      : bet.label.replace(/^Acca lay ·\s*/, "").trim();
    return whole ? `Lay (whole) · ${rest || "acca"}` : `Lay · ${rest || "leg"}`;
  }
  if (isAccaDeskBack(bet)) {
    return isAccaDeskConvertBack(bet) ? "Convert free bet" : "Qualify acca";
  }
  return bet.label;
}

type AccaSortRank = 0 | 1 | 2 | 3;

function accaCampaignSortRank(
  bet: Pick<BetRow, "label" | "notes" | "betType">
): AccaSortRank {
  if (isAccaDeskBack(bet) && !isAccaDeskConvertBack(bet)) return 0; // qualify
  if (isAccaDeskConvertBack(bet)) return 1; // convert
  if (isAccaDeskLay(bet)) return 2; // lays
  return 3; // other
}

/**
 * Campaign sort (narrative): qualify acca → convert free bet → leg lays by
 * seq → other bets oldest-first within each band.
 */
export function sortCampaignBetsWithAcca(bets: BetRow[]): BetRow[] {
  return [...bets].sort((a, b) => {
    const ar = accaCampaignSortRank(a);
    const br = accaCampaignSortRank(b);
    if (ar !== br) return ar - br;

    if (ar === 2 && br === 2) {
      const as = accaLaySeq(a) ?? Number.MAX_SAFE_INTEGER;
      const bs = accaLaySeq(b) ?? Number.MAX_SAFE_INTEGER;
      if (as !== bs) return as - bs;
    }

    // Oldest first so the campaign reads top-to-bottom in time.
    return a.createdAt - b.createdAt || a.id - b.id;
  });
}

/**
 * Bets that belong to one Acca run (back + per-leg / whole lays).
 * Does not use offerId alone — multiple runs can share a campaign.
 */
export function betsForAccaRun(
  run: {
    label: string;
    backBetId: number | null;
    wholeLayBetId?: number | null;
  },
  legs: Array<{ layBetId?: number | null }>,
  bets: BetRow[]
): BetRow[] {
  const ids = new Set<number>();
  if (run.backBetId != null) ids.add(run.backBetId);
  if (run.wholeLayBetId != null) ids.add(run.wholeLayBetId);
  for (const leg of legs) {
    if (leg.layBetId != null) ids.add(leg.layBetId);
  }

  const runLabel = run.label.trim();
  const matched = bets.filter((b) => {
    if (ids.has(b.id)) return true;
    if (!isAccaDeskLay(b)) return false;
    if (b.label === `Acca lay (whole) · ${runLabel}`) return true;
    return b.notes?.includes(`"${runLabel}"`) ?? false;
  });

  return sortCampaignBetsWithAcca(matched);
}
