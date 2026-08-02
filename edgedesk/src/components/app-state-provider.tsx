"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppState } from "@/lib/services/state.types";
import { setDisplayTimeFormat } from "@/lib/time-format";

const FALLBACK_POLL_MS = 3000;

type AppStateContextValue = {
  state: AppState | null;
  error: string | null;
  refresh: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

/** Abandon a coalesced poll that has been stuck this long (dev compile / API hang). */
const STALE_INFLIGHT_MS = 15_000;

/** One poll loop for the whole app - avoids N duplicate /api/state fetches per page. */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const inFlightStartedAt = useRef(0);

  const refresh = useCallback(async () => {
    // Coalesce duplicate polls, but do not wedge Delete/Expire refresh behind a
    // zombie /api/state that has been hanging for tens of seconds (seen when
    // Racing Desk / Offer Edge saturates the Next process).
    if (
      inFlight.current &&
      Date.now() - inFlightStartedAt.current < STALE_INFLIGHT_MS
    ) {
      return inFlight.current;
    }

    const run = (async () => {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as AppState;
        setDisplayTimeFormat(next.settings?.timeFormat);
        setState(next);
        setError(null);
      } catch (e) {
        setError(String(e));
        // Keep the last good snapshot - never blank the desk on a failed poll.
      } finally {
        if (inFlight.current === run) inFlight.current = null;
      }
    })();

    inFlight.current = run;
    inFlightStartedAt.current = Date.now();
    return run;
  }, []);

  const pollMs = state?.settings.dashboardPollMs ?? FALLBACK_POLL_MS;

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [refresh, pollMs]);

  const value = useMemo(
    () => ({ state, error, refresh }),
    [state, error, refresh]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/** @param _intervalMs Ignored - poll interval comes from Settings → dashboard poll (shared). */
export function useAppStateContext(_intervalMs?: number): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
