/**
 * Bet-level race outcomes — finishing position and promo awards for UI.
 */
import { formatGbp } from "@/lib/format-money";
import type { BetRow, EventRow } from "@/lib/db/schema";
import { parseRaceResults, selectionPosition } from "@/lib/racing";

export interface PromoAwardInfo {
  amount: number;
  reason: string;
}

export type PromoAwardsByBetId = Record<number, PromoAwardInfo>;

/** Human label for a finishing position, e.g. "Finished 2nd" or "Won". */
export function formatFinishingPosition(position: number): string | null {
  if (position <= 0) return null;
  if (position === 1) return "Won";
  const mod100 = position % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : position % 10 === 1
        ? "st"
        : position % 10 === 2
          ? "nd"
          : position % 10 === 3
            ? "rd"
            : "th";
  return `Finished ${position}${suffix}`;
}

export function formatPromoTooltip(amount: number, reason?: string, compact = false): string {
  const amountLabel = `${formatGbp(amount)} free bet`;
  if (compact || !reason?.trim()) return amountLabel;
  const cleaned = reason
    .replace(/\s*—\s*£[\d.]+\s*free bet\s*$/i, "")
    .trim();
  if (!cleaned) return amountLabel;
  return `${amountLabel} · ${cleaned}`;
}

export interface BetRaceOutcome {
  position: number;
  positionLabel: string | null;
  promoAward: PromoAwardInfo | null;
}

export function betRaceOutcome(
  bet: Pick<BetRow, "id" | "selection" | "eventId">,
  event: Pick<EventRow, "sport" | "goals"> | undefined,
  promoAwards: PromoAwardsByBetId
): BetRaceOutcome | null {
  if (!event || event.sport !== "horse_racing" || !bet.selection.trim()) return null;
  const race = parseRaceResults(event.goals);
  if (!race) return null;
  const position = selectionPosition(bet.selection, race);
  return {
    position,
    positionLabel: formatFinishingPosition(position),
    promoAward: promoAwards[bet.id] ?? null,
  };
}
