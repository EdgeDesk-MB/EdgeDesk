/**
 * How long a tab must go untouched before hiding it counts as stepping away.
 * Shorter gaps are part of the task: flipping to a bookmaker or exchange to
 * check a price, then coming back to finish the bet.
 */
export const HIDDEN_RELOAD_IDLE_MS = 10 * 60_000;

/** Interaction that proves someone is working in the tab. */
export const USER_ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

type ActivityTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export type UserActivityTracker = {
  /** Milliseconds since the last interaction (or since tracking began). */
  idleMs: () => number;
  /** Count a moment as activity, e.g. the tab coming back into view. */
  markActive: () => void;
  dispose: () => void;
};

export function trackUserActivity(
  target: ActivityTarget,
  now: () => number = () => Date.now()
): UserActivityTracker {
  let lastActiveAt = now();
  const onActivity = () => {
    lastActiveAt = now();
  };
  // Capture so element scrolls, which do not bubble, still count.
  const options = { capture: true, passive: true } as const;
  for (const type of USER_ACTIVITY_EVENTS) {
    target.addEventListener(type, onActivity, options);
  }
  return {
    idleMs: () => Math.max(0, now() - lastActiveAt),
    markActive: onActivity,
    dispose() {
      for (const type of USER_ACTIVITY_EVENTS) {
        target.removeEventListener(type, onActivity, options);
      }
    },
  };
}

/** Hiding the tab only means the user has left when it was already idle. */
export function steppedAwayBeforeHiding(idleMs: number): boolean {
  return idleMs >= HIDDEN_RELOAD_IDLE_MS;
}
