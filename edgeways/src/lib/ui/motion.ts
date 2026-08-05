/**
 * Shared motion tokens. Matches the side-nav expand spring
 * (`nav-sub-panel` in globals.css) — quick, light overshoot.
 */
export const SPRING_EASE = "cubic-bezier(0.34, 1.4, 0.64, 1)";
export const SPRING_DURATION_MS = 200;

export const springTransition = `${SPRING_DURATION_MS}ms ${SPRING_EASE}`;

/**
 * Meta-nav Chrome tab slide — WAAPI on transform + width (compositor /
 * high-refresh). Fast + almost linear (very light ease-in/out only).
 */
export const META_TAB_EASE = [0.4, 0.12, 0.6, 0.88] as const;
export const META_TAB_DURATION_S = 0.16;
/** Colour handoff after the pill lands */
export const META_TAB_COLOR_FADE_MS = 90;
