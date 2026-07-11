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

/** One poll loop for the whole app - avoids N duplicate /api/state fetches per page. */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;

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
      } finally {
        inFlight.current = null;
      }
    })();

    inFlight.current = run;
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
