import { sportDisplayLabel } from "@/lib/sports";
import {
  clampEpLeadBy,
  defaultEpLeadBy,
  formatEpRule,
  isEpDeskSport,
  scopeForBookieSport,
  toEpDeskSport,
  type EpBookieSetup,
  type EpDeskSport,
} from "@/lib/twoup/bookie-offers";

export type SuggestedEpScope = {
  bookie: string;
  sport: EpDeskSport;
  leadBy: number;
  reason: string;
};

function copyBlob(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

function sportFromLeadUnit(unit: string, hinted?: string | null): EpDeskSport | null {
  const hint = toEpDeskSport(hinted);
  const key = unit.toLowerCase();
  if (key.startsWith("goal")) return hint === "ice_hockey" ? "ice_hockey" : "football";
  if (key.startsWith("run")) return hint === "cricket" ? "cricket" : "baseball";
  if (key.startsWith("set")) {
    if (hint === "volleyball" || hint === "darts") return hint;
    return "tennis";
  }
  if (key.startsWith("map")) return "esports";
  if (key.startsWith("point")) {
    if (hint && hint !== "football" && hint !== "baseball") return hint;
    return null;
  }
  return hint;
}

/**
 * Conservative read of title, important notes, and any sport already on the
 * offer. No scrape. Returns null unless the copy names an early-payout rule.
 */
export function inferEpScopeFromOfferCopy(input: {
  bookie: string;
  title?: string | null;
  importantNotes?: string | null;
  description?: string | null;
  sport?: string | null;
}): SuggestedEpScope | null {
  const bookie = input.bookie.trim();
  if (!bookie) return null;
  const text = copyBlob(input.title, input.importantNotes, input.description);
  if (!text) return null;

  if (/\b2[\s-]?up\b/i.test(text)) {
    return {
      bookie,
      sport: "football",
      leadBy: 2,
      reason: "The offer copy names 2UP.",
    };
  }
  if (/\b1[\s-]?up\b/i.test(text)) {
    return {
      bookie,
      sport: "football",
      leadBy: 1,
      reason: "The offer copy names 1UP.",
    };
  }

  const ahead = text.match(
    /\b(\d{1,2})\s+(goals?|runs?|points?|sets?|maps?)\s+ahead\b/i
  );
  if (ahead) {
    const leadBy = clampEpLeadBy(Number(ahead[1]));
    const sport = sportFromLeadUnit(ahead[2] ?? "", input.sport);
    if (sport) {
      return {
        bookie,
        sport,
        leadBy,
        reason: `The offer copy names ${formatEpRule(sport, leadBy)}.`,
      };
    }
  }

  if (/\bearly[\s-]?payout\b|\bpays?\s+out\s+early\b/i.test(text)) {
    const sport = toEpDeskSport(input.sport);
    if (!sport || !isEpDeskSport(sport)) return null;
    const leadBy = defaultEpLeadBy(sport);
    return {
      bookie,
      sport,
      leadBy,
      reason: `The offer copy names early payout on ${sportDisplayLabel(sport)}.`,
    };
  }

  return null;
}

export function shouldProposeBookieScope(
  setup: EpBookieSetup,
  suggested: Pick<SuggestedEpScope, "bookie" | "sport" | "leadBy">
): boolean {
  const existing = scopeForBookieSport(setup, suggested.bookie, suggested.sport);
  if (!existing) return true;
  return clampEpLeadBy(existing.leadBy) !== clampEpLeadBy(suggested.leadBy);
}
