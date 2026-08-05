/**
 * Topbar header texture (Hero Patterns).
 * Default = diagonal-lines. Ink is 5% of `--topbar-foreground` via CSS mask.
 */

import {
  DEFAULT_HEADER_PATTERN,
  HEADER_PATTERN_ATTR,
  HEADER_PATTERN_COOKIE_KEY,
  HEADER_PATTERN_IDS,
  HEADER_PATTERN_STORAGE_KEY,
  type HeaderPatternId,
} from "@/lib/header-pattern-constants";

export {
  DEFAULT_HEADER_PATTERN,
  HEADER_PATTERN_ATTR,
  HEADER_PATTERN_COOKIE_KEY,
  HEADER_PATTERN_IDS,
  HEADER_PATTERN_STORAGE_KEY,
  type HeaderPatternId,
} from "@/lib/header-pattern-constants";
export { HEADER_PATTERN_FOUC_SCRIPT } from "@/lib/header-pattern-fouc";

export const HEADER_PATTERN_OPTIONS: ReadonlyArray<{
  id: HeaderPatternId;
  label: string;
}> = [
  { id: "diagonal-lines", label: "Diagonal lines" },
  { id: "diagonal-stripes", label: "Diagonal stripes" },
  { id: "graph-paper", label: "Graph paper" },
  { id: "plus", label: "Plus" },
  { id: "hideout", label: "Hideout" },
  { id: "texture", label: "Texture" },
  { id: "architect", label: "Architect" },
  { id: "overlapping-circles", label: "Overlapping circles" },
  { id: "hexagons", label: "Hexagons" },
  { id: "circuit-board", label: "Circuit board" },
  { id: "morphing-diamonds", label: "Morphing diamonds" },
  { id: "bank-note", label: "Bank note" },
];

export function isHeaderPatternId(
  value: unknown
): value is HeaderPatternId {
  return (
    typeof value === "string" &&
    (HEADER_PATTERN_IDS as readonly string[]).includes(value)
  );
}

export function normalizeHeaderPattern(value: unknown): HeaderPatternId {
  return isHeaderPatternId(value) ? value : DEFAULT_HEADER_PATTERN;
}

/** Apply the chosen texture on `<html>` (CSS switches mask via `data-header-pattern`). */
export function applyHeaderPattern(id: HeaderPatternId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = normalizeHeaderPattern(id);
  if (resolved === DEFAULT_HEADER_PATTERN) {
    root.removeAttribute(HEADER_PATTERN_ATTR);
  } else {
    root.setAttribute(HEADER_PATTERN_ATTR, resolved);
  }
}

export function readStoredHeaderPattern(): HeaderPatternId {
  if (typeof window === "undefined") return DEFAULT_HEADER_PATTERN;
  try {
    return normalizeHeaderPattern(
      localStorage.getItem(HEADER_PATTERN_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_HEADER_PATTERN;
  }
}

export function writeStoredHeaderPattern(id: HeaderPatternId): void {
  if (typeof window === "undefined") return;
  const resolved = normalizeHeaderPattern(id);
  try {
    localStorage.setItem(HEADER_PATTERN_STORAGE_KEY, resolved);
  } catch {
    /* private mode / quota */
  }
  try {
    document.cookie =
      HEADER_PATTERN_COOKIE_KEY +
      "=" +
      encodeURIComponent(resolved) +
      ";path=/;max-age=31536000;SameSite=Lax";
  } catch {
    /* ignore */
  }
}
