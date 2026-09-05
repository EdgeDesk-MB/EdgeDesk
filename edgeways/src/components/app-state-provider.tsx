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
import type { OfferSummary } from "@/lib/services/offers.types";
import type { AppState } from "@/lib/services/state.types";
import { ALERT_INBOX_READ_EVENT } from "@/lib/alerts/inbox-read-event";
import { setDisplayTimeFormat } from "@/lib/time-format";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { buildPublicDemoState } from "@/lib/demo/public-fixture";
import { canUseOfferEdge } from "@/lib/entitlements/offer-edge";
import { localCalendarDate } from "@/lib/events";

const FALLBACK_POLL_MS = 3000;

type AppStateContextValue = {
  state: AppState | null;
  error: string | null;
  /** Always fetches a fresh snapshot. Polling uses a coalesced path internally. */
  refresh: () => Promise<void>;
  /** Patch one campaign in the current snapshot so the CTA can move before the next poll. */
  applyLocalOfferPatch: (offerId: number, patch: Partial<OfferSummary>) => void;
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
  /** Bumped on user refresh / local patches so a slower poll cannot clobber newer state. */
  const pollGen = useRef(0);
  const [prevDemo, setPrevDemo] = useState({
    active: publicDemo.active,
    view: publicDemo.view,
  });

  if (
    prevDemo.active !== publicDemo.active ||
    prevDemo.view !== publicDemo.view
  ) {
    setPrevDemo({ active: publicDemo.active, view: publicDemo.view });
    if (publicDemo.active) {
      setState(buildPublicDemoState(publicDemo.view));
      setError(null);
    }
  }

  useEffect(() => {
    if (!publicDemo.active) return;
    setDisplayTimeFormat(
      buildPublicDemoState(publicDemo.view).settings.timeFormat
    );
  }, [publicDemo.active, publicDemo.view]);

  const fetchState = useCallback(
    async (mode: "poll" | "user") => {
      if (publicDemo.active) {
        const next = buildPublicDemoState(publicDemo.view);
        setDisplayTimeFormat(next.settings.timeFormat);
        setState(next);
        setError(null);
        return;
      }
      // Background polls may share an in-flight request. User refresh (after a
      // mutation) must not join a snapshot that started before the write.
      if (
        mode === "poll" &&
        inFlight.current &&
        Date.now() - inFlightStartedAt.current < STALE_INFLIGHT_MS
      ) {
        return inFlight.current;
      }

      const gen = ++pollGen.current;
      const run: Promise<void> = (async () => {
        try {
          const res = await fetch("/api/state", { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const next = (await res.json()) as AppState;
          if (pollGen.current !== gen) return;
          setDisplayTimeFormat(next.settings?.timeFormat);
          setState(next);
          setError(null);
        } catch (e) {
          if (pollGen.current !== gen) return;
          setError(String(e));
          // Keep the last good snapshot - never blank the desk on a failed poll.
        }
      })();

      inFlight.current = run;
      inFlightStartedAt.current = Date.now();
      void run.finally(() => {
        if (inFlight.current === run) inFlight.current = null;
      });
      return run;
    },
    [publicDemo.active, publicDemo.view]
  );

  const refresh = useCallback(() => fetchState("user"), [fetchState]);

  const applyLocalOfferPatch = useCallback(
    (offerId: number, patch: Partial<OfferSummary>) => {
      pollGen.current += 1;
      setState((current) => {
        if (current == null) return current;
        return {
          ...current,
          offers: current.offers.map((row) =>
            row.id === offerId ? { ...row, ...patch } : row
          ),
        };
      });
    },
    []
  );

  const pausePolling = useCallback(() => {
    setPauseCount((n) => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setPauseCount((n) => Math.max(0, n - 1));
    };
  }, []);

  const pollMs = FALLBACK_POLL_MS;
  const pollingPaused = pauseCount > 0;

  useEffect(() => {
    if (publicDemo.active) return;
    if (pollingPaused) return;
    const initial = window.setTimeout(() => void fetchState("poll"), 0);
    const timer = setInterval(() => void fetchState("poll"), pollMs);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [fetchState, pollMs, pollingPaused, publicDemo.active]);

  const edgePrefetchKey =
    state && canUseOfferEdge(state.settings)
      ? state.offers
          .filter(
            (o) =>
              o.sport === "horse_racing" &&
              (o.status === "active" || o.status === "planned")
          )
          .map((o) => o.id)
          .sort((a, b) => a - b)
          .join(",")
      : "";

  useEffect(() => {
    if (publicDemo.active || !edgePrefetchKey) return;
    const date = localCalendarDate();
    // Dynamic import: this file must not import offer-edge-client (that module
    // pulls use-app-state, which re-exports the provider).
    void import("@/lib/offers/offer-edge-client").then((mod) => {
      mod.prefetchOfferEdgePlays(date);
    });
  }, [edgePrefetchKey, publicDemo.active]);

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
    () => ({ state, error, refresh, applyLocalOfferPatch, pausePolling }),
    [state, error, refresh, applyLocalOfferPatch, pausePolling]
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

/** @param _intervalMs Ignored. Shared poll is a product default (3s), not a user setting. */
export function useAppStateContext(_intervalMs?: number): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
