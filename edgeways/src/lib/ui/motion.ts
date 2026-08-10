/**
 * Shared motion tokens. Spring is for opacity / transform flourishes —
 * quick, light overshoot. Height collapses use COLLAPSE_EASE instead.
 */
export const SPRING_EASE = "cubic-bezier(0.34, 1.4, 0.64, 1)";
export const SPRING_DURATION_MS = 200;

export const springTransition = `${SPRING_DURATION_MS}ms ${SPRING_EASE}`;

/**
 * Height / clip collapses. Same duration as the spring, but no overshoot —
 * max-height and grid 0fr/1fr read as a glitch when the curve goes past the
 * target. Keep in sync with `.nav-sub-panel` in globals.css.
 */
export const COLLAPSE_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
export const collapseTransition = `${SPRING_DURATION_MS}ms ${COLLAPSE_EASE}`;

/**
 * Meta-nav Chrome tab slide — WAAPI on transform + width (compositor /
 * high-refresh). Fast + almost linear (very light ease-in/out only).
 */
export const META_TAB_EASE = [0.4, 0.12, 0.6, 0.88] as const;
export const META_TAB_DURATION_S = 0.16;
/** Colour handoff after the pill lands */
export const META_TAB_COLOR_FADE_MS = 90;
