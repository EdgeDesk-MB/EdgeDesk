import type { AccaRunRow } from "@/lib/db/schema";
import type { DeskBackBetType } from "@/lib/desk/desk-back-bet-type";
import type { BetScope } from "@/lib/offers/offer-terms";

/** Prefill for the global / Acca Desk "New run" dialog. */
export interface AccaRunPrefill {
  offerId: number;
  label: string;
  stake: number;
  bookmaker?: string;
  /** Seeds each new leg's sport when present. */
  sport?: string | null;
  minOdds?: number | null;
  minStake?: number | null;
  maxStake?: number | null;
  minSelections?: number | null;
  importantNotes?: string | null;
  suggestedMethod?: AccaRunRow["method"];
  /** Scope that triggered Acca Desk (qualifier or reward). */
  scope?: BetScope;
  /** qualify → qualifying back; convert → free bet back (uses free-bet lot). */
  purpose?: "qualify" | "convert";
  backBetType?: DeskBackBetType;
}

export function emptyLegCountFromPrefill(prefill?: AccaRunPrefill | null): number {
  const n = prefill?.minSelections;
  if (typeof n === "number" && Number.isFinite(n)) {
    return Math.min(12, Math.max(2, Math.floor(n)));
  }
  return 3;
}
