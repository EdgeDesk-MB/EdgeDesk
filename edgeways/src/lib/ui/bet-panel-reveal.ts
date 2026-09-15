/** Top-to-bottom paint on each plate. */
export const BET_PANEL_SHINE_MS = 50;

/** Lay waits this long after Back when both first-tint as a load pair. */
export const BET_PANEL_PAIR_DELAY_MS = 25;

/** If Lay first-tints within this window of Back, treat it as a load pair. */
const PAIR_WINDOW_MS = 800;

let lastBackFirstTintAt = 0;

export function noteBackFirstTint(now = performance.now()): void {
  lastBackFirstTintAt = now;
}

/** Pair delay when Back just first-tinted; otherwise 0. */
export function layFirstTintDelayMs(now = performance.now()): number {
  return now - lastBackFirstTintAt < PAIR_WINDOW_MS ? BET_PANEL_PAIR_DELAY_MS : 0;
}

export function prefersReducedPanelMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function resetBetPanelRevealForTests(): void {
  lastBackFirstTintAt = 0;
}
