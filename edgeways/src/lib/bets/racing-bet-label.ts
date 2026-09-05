/**
 * Racing desk offer bets are labelled "Course · Offer". Older rows baked the
 * edge-pick runner in as "Course · Horse · Offer". If the user then backed a
 * different horse, the favourite stayed in the title while Market showed the
 * real selection. Strip that stale runner; keep it when it is the selection.
 */
import { horseNamesMatch } from "@/lib/racing";

const SEP = " · ";

function looksLikeOfferCopy(s: string): boolean {
  return /\b(free\s*bet|fb\b|bet\s+£?\s*\d|£\s*\d)/i.test(s);
}

function looksLikeClockTime(s: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(s.trim());
}

function splitLabel(label: string): string[] {
  return label
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Qualifying / place-refund title from Racing Desk. Runner lives on selection. */
export function racingOfferBetLabel(course: string, offerTitle: string): string {
  const c = course.trim();
  const t = offerTitle.trim();
  if (c && t) return `${c}${SEP}${t}`;
  return t || c;
}

/**
 * Drop a middot horse segment that is not the backed selection.
 * No-op unless the label looks like Course · Horse · Offer.
 */
export function stripStaleHorseFromRacingBetLabel(
  label: string,
  selection: string | null | undefined
): string {
  const sel = selection?.trim() ?? "";
  if (!sel || !label.includes("·")) return label;
  const parts = splitLabel(label);
  if (parts.length < 3) return label;
  const last = parts[parts.length - 1];
  if (!last || !looksLikeOfferCopy(last)) return label;

  const kept = parts.filter((part, i) => {
    if (i === 0 || i === parts.length - 1) return true;
    if (horseNamesMatch(part, sel)) return true;
    if (looksLikeClockTime(part) || looksLikeOfferCopy(part)) return true;
    return false;
  });
  return kept.length > 0 ? kept.join(SEP) : label;
}

/**
 * When the user picks a different runner, drop or rewrite the old horse in the
 * label. Offer titles lose the stale runner; EW-style titles keep a horse name.
 */
export function syncRacingBetLabelOnSelectionChange(
  label: string,
  previousSelection: string,
  nextSelection: string
): string {
  const prev = previousSelection.trim();
  const next = nextSelection.trim();
  if (!prev || !next || horseNamesMatch(prev, next)) return label;
  const parts = splitLabel(label);
  if (parts.length < 2) return label;

  const last = parts[parts.length - 1] ?? "";
  const offerLike = looksLikeOfferCopy(last);
  let changed = false;
  const mapped: Array<string | null> = parts.map((part) => {
    const lower = part.toLowerCase();
    const prevLower = prev.toLowerCase();
    if (lower.startsWith(prevLower) && part.length > prev.length) {
      const rest = part.slice(prev.length);
      if (/^\s+(EW|EP)\b/i.test(rest)) {
        changed = true;
        return `${next}${rest}`;
      }
    }
    if (horseNamesMatch(part, prev)) {
      changed = true;
      return offerLike ? null : next;
    }
    return part;
  });
  if (!changed) return label;
  return mapped.filter((p): p is string => p != null && p.trim() !== "").join(SEP);
}
