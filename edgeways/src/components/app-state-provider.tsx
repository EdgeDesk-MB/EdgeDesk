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
import { ALERT_INBOX_READ_EVENT } from "@/lib/alerts/inbox-read-event";
import { setDisplayTimeFormat } from "@/lib/time-format";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { buildPublicDemoState } from "@/lib/demo/public-fixture";

const FALLBACK_POLL_MS = 3000;

type AppStateContextValue = {
  state: AppState | null;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Pause the shared /api/state poll (e.g. while Add bet is open).
   * Returns a resume function; safe to call from useEffect cleanups.
   */
  pausePolling: () => () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

/** Abandon a coalesced poll that has been stuck this long (dev compile / API hang). */
const STALE_INFLIGHT_MS = 15_000;

/** One poll loop for the whole app - avoids N duplicate /api/state fetches per page. */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const publicDemo = usePublicDemo();
  const [state, setState] = useState<AppState | null>(() =>
    publicDemo.active ? buildPublicDemoState(publicDemo.view) : null
  );
  const [error, setError] = useState<string | null>(null);
  const [pauseCount, setPauseCount] = useState(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const inFlightStartedAt = useRef(0);

  useEffect(() => {
    if (!publicDemo.active) return;
    const next = buildPublicDemoState(publicDemo.view);
    setDisplayTimeFormat(next.settings.timeFormat);
    setState(next);
    setError(null);
  }, [publicDemo.active, publicDemo.view]);

  const refresh = useCallback(async () => {
    if (publicDemo.active) {
      const next = buildPublicDemoState(publicDemo.view);
      setDisplayTimeFormat(next.settings.timeFormat);
      setState(next);
      setError(null);
      return;
    }
    // Coalesce duplicate polls, but do not wedge Delete/Expire refresh behind a
    // zombie /api/state that has been hanging for tens of seconds (seen when
    // Racing Desk / Offer Edge saturates the Next process).
    if (
      inFlight.current &&
      Date.now() - inFlightStartedAt.current < STALE_INFLIGHT_MS
    ) {
      return inFlight.current;
    }

    let run!: Promise<void>;
    run = (async () => {
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
  }, [publicDemo.active, publicDemo.view]);

  const pausePolling = useCallback(() => {
    setPauseCount((n) => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setPauseCount((n) => Math.max(0, n - 1));
    };
  }, []);

  const pollMs = state?.settings.dashboardPollMs ?? FALLBACK_POLL_MS;
  const pollingPaused = pauseCount > 0;

  useEffect(() => {
    if (publicDemo.active) return;
    if (pollingPaused) return;
    void refresh();
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [refresh, pollMs, pollingPaused, publicDemo.active]);

  useEffect(() => {
    if (publicDemo.active) return;
    const onInboxRead = () => {
      setState((current) =>
        current == null
          ? current
          : { ...current, alertsUnread: Math.max(0, current.alertsUnread - 1) }
      );
      void refresh();
    };
    window.addEventListener(ALERT_INBOX_READ_EVENT, onInboxRead);
    return () => window.removeEventListener(ALERT_INBOX_READ_EVENT, onInboxRead);
  }, [refresh, publicDemo.active]);

  const value = useMemo(
    () => ({ state, error, refresh, pausePolling }),
    [state, error, refresh, pausePolling]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/** Pause shared app-state polling while `paused` is true (Add bet, heavy editors). */
export function usePauseAppStatePolling(paused: boolean) {
  const { pausePolling } = useAppStateContext();
  useEffect(() => {
    if (!paused) return;
    return pausePolling();
  }, [paused, pausePolling]);
}

/** @param _intervalMs Ignored - poll interval comes from Settings → dashboard poll (shared). */
export function useAppStateContext(_intervalMs?: number): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
