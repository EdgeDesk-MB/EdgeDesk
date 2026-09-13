"use client";

import { useEffect, useRef, useState } from "react";
import {
  TAPE_GOAL_FLASH_MS,
  tapeGoalFromLastSideChange,
  tapeGoalFromLatestEvent,
  tapeGoalFromScoreDelta,
  tapeGoalPreviewRequested,
  type TapeGoalFlash,
  type TapeLastGoal,
} from "@/lib/events/fixture-tape-goal";

const QUIET: TapeGoalFlash = { home: false, away: false };

/** Flash Goal on a live tape row when that side’s score ticks up. */
export function useTapeGoalFlash(
  key: string,
  home: number,
  away: number,
  active: boolean,
  seed?: TapeGoalFlash | null,
  lastGoal?: TapeLastGoal | null,
  matchMinute?: number | null
): TapeGoalFlash {
  const prevRef = useRef<{ key: string; home: number; away: number } | null>(null);
  const seededKey = useRef<string | null>(null);
  const lastSideRef = useRef<"home" | "away" | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<TapeGoalFlash>(QUIET);

  useEffect(() => {
    function clearHold() {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
    function hold(hit: TapeGoalFlash) {
      setFlash(hit);
      clearHold();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        setFlash(QUIET);
      }, TAPE_GOAL_FLASH_MS);
    }

    const next = { key, home, away };
    const prevLastSide = lastSideRef.current;
    lastSideRef.current = lastGoal?.side ?? null;
    if (!active) {
      prevRef.current = next;
      seededKey.current = null;
      lastSideRef.current = null;
      clearHold();
      setFlash(QUIET);
      return;
    }
    const prev = prevRef.current;
    prevRef.current = next;
    const exclusiveSeed =
      seed && seed.home && seed.away
        ? null
        : seed && (seed.home || seed.away)
          ? seed
          : null;
    if (exclusiveSeed && seededKey.current !== key) {
      seededKey.current = key;
      hold(exclusiveSeed);
      return;
    }
    const lastSide = lastGoal?.side ?? null;
    if (!prev || prev.key !== key) {
      const recent = tapeGoalFromLatestEvent(lastGoal ?? null, matchMinute);
      if (recent) hold(recent);
      return;
    }
    const hit = tapeGoalFromScoreDelta(
      { home: prev.home, away: prev.away },
      { home, away },
      lastSide
    );
    if (hit) {
      hold(hit);
      return;
    }
    const catchUp = tapeGoalFromLastSideChange(
      prevLastSide,
      lastGoal ?? null,
      matchMinute
    );
    if (catchUp) {
      hold(catchUp);
      return;
    }
    if (home < prev.home || away < prev.away) {
      clearHold();
      setFlash(QUIET);
    }
  }, [key, home, away, active, seed?.home, seed?.away, lastGoal?.side, lastGoal?.minute, matchMinute]);

  useEffect(
    () => () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    },
    []
  );

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
