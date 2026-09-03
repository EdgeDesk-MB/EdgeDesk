import { formatGbp } from "@/lib/format-money";
import {
  formatOfferOdds,
  type OfferImportantTerms,
} from "@/lib/offers/offer-terms";

export type PlacementPurpose = "qualify" | "convert";

/** Structured constraints that matter while placing a qualifier or convert. */
export type PlacementRequirements = {
  purpose: PlacementPurpose;
  minOdds: number | null;
  minStake: number | null;
  maxStake: number | null;
  minSelections: number | null;
  importantNotes: string | null;
};

export type PlacementDraft = {
  odds?: number | null;
  stake?: number | null;
  selectionCount?: number | null;
};

export type PlacementBreaches = {
  oddsLow: boolean;
  stakeLow: boolean;
  stakeHigh: boolean;
  selectionsLow: boolean;
};

export type PlacementRequirementPartKey =
  | "convert"
  | "minSelections"
  | "minOdds"
  | "minStake"
  | "maxStake"
  | "notes";

export type PlacementRequirementPart = {
  key: PlacementRequirementPartKey;
  text: string;
};

const EPS = 0.0001;
const NOTES_MAX = 160;

export function emptyPlacementBreaches(): PlacementBreaches {
  return {
    oddsLow: false,
    stakeLow: false,
    stakeHigh: false,
    selectionsLow: false,
  };
}

export function hasPlacementBreach(breaches: PlacementBreaches): boolean {
  return (
    breaches.oddsLow ||
    breaches.stakeLow ||
    breaches.stakeHigh ||
    breaches.selectionsLow
  );
}

export function hasPlacementRequirements(
  req: PlacementRequirements | null | undefined
): req is PlacementRequirements {
  if (!req) return false;
  return (
    req.minOdds != null ||
    req.minStake != null ||
    req.maxStake != null ||
    req.minSelections != null ||
    Boolean(req.importantNotes?.trim())
  );
}

export function placementRequirementsFromImportant(
  important: OfferImportantTerms,
  options?: {
    purpose?: PlacementPurpose;
    /** Acca / bet builder create dialogs. Add bet is a single, so omit. */
    includeSelections?: boolean;
  }
): PlacementRequirements {
  const purpose = options?.purpose ?? "qualify";
  const isConvert = purpose === "convert";
  const minSelections = isConvert
    ? important.rewardMinSelections ?? important.minSelections
    : important.minSelections;
  const notes = important.importantNotes.trim();
  return {
    purpose,
    minOdds: important.minOdds,
    minStake: isConvert ? null : important.minStake,
    maxStake: important.maxStake,
    minSelections: options?.includeSelections === true ? minSelections : null,
    importantNotes: notes || null,
  };
}

export function placementRequirementsFromPrefill(prefill: {
  purpose?: PlacementPurpose | null;
  minOdds?: number | null;
  minStake?: number | null;
  maxStake?: number | null;
  minSelections?: number | null;
  importantNotes?: string | null;
}): PlacementRequirements {
  const notes = prefill.importantNotes?.trim() ?? "";
  return {
    purpose: prefill.purpose === "convert" ? "convert" : "qualify",
    minOdds: prefill.minOdds ?? null,
    minStake: prefill.minStake ?? null,
    maxStake: prefill.maxStake ?? null,
    minSelections: prefill.minSelections ?? null,
    importantNotes: notes || null,
  };
}

export function formatPlacementRequirementParts(
  req: PlacementRequirements
): PlacementRequirementPart[] {
  const parts: PlacementRequirementPart[] = [];
  if (req.purpose === "convert") {
    parts.push({ key: "convert", text: "Free-bet convert" });
  }
  if (req.minSelections != null) {
    parts.push({
      key: "minSelections",
      text: `Min ${req.minSelections} selections`,
    });
  }
  if (req.minOdds != null) {
    parts.push({ key: "minOdds", text: `Min odds ${formatOfferOdds(req.minOdds)}` });
  }
  if (req.minStake != null) {
    parts.push({ key: "minStake", text: `Min stake ${formatGbp(req.minStake)}` });
  }
  if (req.maxStake != null) {
    parts.push({ key: "maxStake", text: `Max stake ${formatGbp(req.maxStake)}` });
  }
  if (req.importantNotes) {
    const notes =
      req.importantNotes.length > NOTES_MAX
        ? `${req.importantNotes.slice(0, NOTES_MAX - 3)}…`
        : req.importantNotes;
    parts.push({ key: "notes", text: notes });
  }
  return parts;
}

export function requirementPartBreached(
  key: PlacementRequirementPartKey,
  breaches: PlacementBreaches
): boolean {
  if (key === "minOdds") return breaches.oddsLow;
  if (key === "minStake") return breaches.stakeLow;
  if (key === "maxStake") return breaches.stakeHigh;
  if (key === "minSelections") return breaches.selectionsLow;
  return false;
}

export function evaluatePlacementBreaches(
  req: PlacementRequirements | null | undefined,
  draft: PlacementDraft
): PlacementBreaches {
  if (!req) return emptyPlacementBreaches();
  const odds = draft.odds;
  const stake = draft.stake;
  const count = draft.selectionCount;
  return {
    oddsLow:
      req.minOdds != null &&
      odds != null &&
      Number.isFinite(odds) &&
      odds > 1 &&
      odds + EPS < req.minOdds,
    stakeLow:
      req.minStake != null &&
      stake != null &&
      Number.isFinite(stake) &&
      stake > 0 &&
      stake + EPS < req.minStake,
    stakeHigh:
      req.maxStake != null &&
      stake != null &&
      Number.isFinite(stake) &&
      stake > 0 &&
      stake > req.maxStake + EPS,
    selectionsLow:
      req.minSelections != null &&
      count != null &&
      Number.isFinite(count) &&
      count > 0 &&
      count < req.minSelections,
  };
}

/** Adjacent sentences for stray stake / odds / selection count. */
export function placementBreachMessages(
  req: PlacementRequirements | null | undefined,
  breaches: PlacementBreaches,
  options?: { oddsScope?: "back" | "combined" }
): string[] {
  if (!req) return [];
  const lines: string[] = [];
  if (breaches.stakeLow && req.minStake != null) {
    lines.push(`Stake is below the min ${formatGbp(req.minStake)}`);
  }
  if (breaches.stakeHigh && req.maxStake != null) {
    lines.push(`Stake is above the max ${formatGbp(req.maxStake)}`);
  }
  if (breaches.oddsLow && req.minOdds != null) {
    const floor = formatOfferOdds(req.minOdds);
    lines.push(
      options?.oddsScope === "combined"
        ? `Combined odds are below the min ${floor}`
        : `Odds are below the min ${floor}`
    );
  }
  if (breaches.selectionsLow && req.minSelections != null) {
    lines.push(`Need at least ${req.minSelections} selections`);
  }
  return lines;
}
