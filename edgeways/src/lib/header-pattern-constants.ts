/** Shared header-pattern constants (no FOUC script — keeps the graph cycle-free). */

export const HEADER_PATTERN_STORAGE_KEY = "edgeways-header-pattern";

/** Cookie so the server can paint the chosen pattern on first HTML. */
export const HEADER_PATTERN_COOKIE_KEY = "edgeways-header-pattern";

/** `html` attribute that selects the active topbar texture. */
export const HEADER_PATTERN_ATTR = "data-header-pattern";

/**
 * Hero Patterns (Steve Schoger) — twelve subtle tiles for the app top bar.
 * Default is diagonal-lines (CSS applies when the attr is absent).
 */
export const HEADER_PATTERN_IDS = [
  "diagonal-lines",
  "diagonal-stripes",
  "graph-paper",
  "plus",
  "hideout",
  "texture",
  "architect",
  "overlapping-circles",
  "hexagons",
  "circuit-board",
  "morphing-diamonds",
  "bank-note",
] as const;

export type HeaderPatternId = (typeof HEADER_PATTERN_IDS)[number];

export const DEFAULT_HEADER_PATTERN: HeaderPatternId = "diagonal-lines";
