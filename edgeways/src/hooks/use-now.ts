"use client";

/**
 * Render-pure clock. `Date.now()` during render breaks React Compiler purity,
 * so time-sensitive labels subscribe to a quantised tick instead: the value
 * is stable within each `refreshMs` bucket (a requirement of
 * useSyncExternalStore snapshots) and the component re-renders when the
 * bucket rolls - kickoff/finished labels now refresh themselves too.
 */

import { useSyncExternalStore } from "react";

export function useNow(refreshMs = 30_000): number {
  const bucket = useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, refreshMs);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / refreshMs),
    // Server snapshot: these surfaces render from client-polled state, so a
    // zero epoch never reaches paint.
    () => 0
  );
  return bucket * refreshMs;
}
