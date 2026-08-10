import type { BetBuilderRunRow } from "@/lib/db/schema";
import type { DeskBackBetType } from "@/lib/desk/desk-back-bet-type";

/** Prefill for the global / Bet Builder Desk "New run" dialog. */
export interface BetBuilderRunPrefill {
  offerId: number;
  label: string;
  stake: number;
  bookmaker?: string;
  sport?: string | null;
  minOdds?: number | null;
  minStake?: number | null;
  maxStake?: number | null;
  minSelections?: number | null;
  importantNotes?: string | null;
  suggestedMethod?: BetBuilderRunRow["method"];
  purpose?: "qualify" | "convert";
  backBetType?: DeskBackBetType;
  eventLabel?: string;
  scheduledAt?: number | null;
}

export function emptySelectionCountFromPrefill(
  prefill?: BetBuilderRunPrefill | null
): number {
  const n = prefill?.minSelections;
  if (typeof n === "number" && Number.isFinite(n)) {
    return Math.min(12, Math.max(2, Math.floor(n)));
  }
  return 3;
}
