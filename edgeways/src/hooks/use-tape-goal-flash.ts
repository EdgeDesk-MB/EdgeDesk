"use client";

import { useEffect, useRef, useState } from "react";
import {
  TAPE_GOAL_FLASH_MS,
  tapeGoalFromScoreDelta,
  tapeGoalPreviewRequested,
  type TapeGoalFlash,
} from "@/lib/events/fixture-tape-goal";

const QUIET: TapeGoalFlash = { home: false, away: false };

/** Flash Goal on a live tape row when that side’s score ticks up. */
export function useTapeGoalFlash(
  key: string,
  home: number,
  away: number,
  active: boolean,
  seed?: TapeGoalFlash | null
): TapeGoalFlash {
  const prevRef = useRef<{ key: string; home: number; away: number } | null>(null);
  const seededKey = useRef<string | null>(null);
  const [flash, setFlash] = useState<TapeGoalFlash>(QUIET);

  useEffect(() => {
    const next = { key, home, away };
    if (!active) {
      prevRef.current = next;
      seededKey.current = null;
      setFlash(QUIET);
      return;
    }
    const prev = prevRef.current;
    prevRef.current = next;
    if (seed && (seed.home || seed.away) && seededKey.current !== key) {
      seededKey.current = key;
      setFlash(seed);
      const clear = window.setTimeout(() => setFlash(QUIET), TAPE_GOAL_FLASH_MS);
      return () => window.clearTimeout(clear);
    }
    if (!prev || prev.key !== key) return;
    const hit = tapeGoalFromScoreDelta(
      { home: prev.home, away: prev.away },
      { home, away }
    );
    if (!hit) {
      if (home < prev.home || away < prev.away) setFlash(QUIET);
      return;
    }
    setFlash(hit);
    const clear = window.setTimeout(() => setFlash(QUIET), TAPE_GOAL_FLASH_MS);
    return () => window.clearTimeout(clear);
  }, [key, home, away, active, seed?.home, seed?.away]);

  return flash;
}

const PREVIEW_DELAY_MS = 900;

/**
 * Localhost `?previewGoal=1` — bump the first two live homes after first
 * paint and leave the new score. Goal clears on its own. Does not write
 * the desk or the feed store.
 */
export function useLocalTapeGoalPreview(liveKeys: readonly string[]): string[] {
  const [keys, setKeys] = useState<string[]>([]);
  const armed = useRef(false);
  const seed = liveKeys.slice(0, 2).join("\0");

  useEffect(() => {
    if (armed.current || !seed) return;
    if (typeof window === "undefined") return;
    if (!tapeGoalPreviewRequested(window.location.hostname, window.location.search)) {
      return;
    }
    armed.current = true;
    const pair = seed.split("\0").filter(Boolean);
    const start = window.setTimeout(() => setKeys(pair), PREVIEW_DELAY_MS);
    return () => window.clearTimeout(start);
  }, [seed]);

  return keys;
}
