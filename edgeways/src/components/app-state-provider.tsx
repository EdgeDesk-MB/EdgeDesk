"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { AppSettings } from "@/lib/services/settings-shared";
import type { AppState } from "@/lib/services/state.types";
import { ALERT_INBOX_READ_EVENT } from "@/lib/alerts/inbox-read-event";
import { setDisplayTimeFormat } from "@/lib/time-format";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { buildPublicDemoState } from "@/lib/demo/public-fixture";
import { writeChromeSnapshot } from "@/lib/chrome-snapshot";
import {
  readDeskSnapshot,
  subscribeDeskSnapshot,
  writeDeskSnapshot,
  openBetsPastResultWindow,
} from "@/lib/desk-snapshot";
import { canUseOfferEdge } from "@/lib/entitlements/offer-edge";
import { localCalendarDate } from "@/lib/events";
import { jsonSnapshotUnchanged } from "@/lib/services/app-state-snapshot";

const FALLBACK_POLL_MS = 3000;

type AppStateContextValue = {
  state: AppState | null;
  error: string | null;
  /** Always fetches a fresh snapshot. Polling uses a coalesced path internally. */
  refresh: () => Promise<void>;
  /** Patch one campaign in the current snapshot so the CTA can move before the next poll. */
  applyLocalOfferPatch: (offerId: number, patch: Partial<OfferSummary>) => void;
  /** Merge desk settings after /api/settings so hide/save survive the next poll. */
  applyLocalSettingsPatch: (patch: Partial<AppSettings>) => void;
  /**
   * Pause the shared /api/state poll (e.g. while Add bet is open).
   * Returns a resume function; safe to call from useEffect cleanups.
   */
  pausePolling: () => () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

/** Abandon a coalesced poll that has been stuck this long (dev compile / API hang). */
const STALE_INFLIGHT_MS = 15_000;

function settingsHoldCovered(
  incoming: AppSettings,
  hold: Partial<AppSettings>
): boolean {
  for (const [key, value] of Object.entries(hold)) {
    const current = incoming[key as keyof AppSettings];
    if (Array.isArray(value) && Array.isArray(current)) {
      if (value.join("\0") !== current.join("\0")) return false;
      continue;
    }
    if (current !== value) return false;
  }
  return true;
}

/** One poll loop for the whole app - avoids N duplicate /api/state fetches per page. */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const publicDemo = usePublicDemo();
  const cached = useSyncExternalStore(
    subscribeDeskSnapshot,
    readDeskSnapshot,
    () => null
  );
  const [live, setLive] = useState<AppState | null>(() =>
    publicDemo.active ? buildPublicDemoState(publicDemo.view) : null
  );
  const state = publicDemo.active ? live : live ?? cached;
  const [error, setError] = useState<string | null>(null);
  const [pauseCount, setPauseCount] = useState(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const inFlightStartedAt = useRef(0);
  const stateEtag = useRef<string | null>(null);
  /** Bumped on user refresh / local patches so a slower poll cannot clobber newer state. */
  const pollGen = useRef(0);
  /** Hide / saved keys stay until /api/state echoes them, so a poll cannot flash them back. */
  const settingsHoldRef = useRef<Partial<AppSettings> | null>(null);
  const staleOpenRetry = useRef(false);
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
      setLive(buildPublicDemoState(publicDemo.view));
      setError(null);
    }
  }

  useEffect(() => {
    if (!publicDemo.active) return;
    setDisplayTimeFormat(
      buildPublicDemoState(publicDemo.view).settings.timeFormat
    );
  }, [publicDemo.active, publicDemo.view]);

  useEffect(() => {
    if (!live || publicDemo.active) return;
    writeChromeSnapshot(live);
    writeDeskSnapshot(live);
  }, [live, publicDemo.active]);

  const pauseCountRef = useRef(0);
  pauseCountRef.current = pauseCount;
  const stateRef = useRef(state);
  stateRef.current = state;

  const fetchState = useCallback(
    async (mode: "poll" | "user") => {
      if (publicDemo.active) {
        const next = buildPublicDemoState(publicDemo.view);
        setDisplayTimeFormat(next.settings.timeFormat);
        setLive(next);
        setError(null);
        return;
      }
      // A modal can pause after this poll has already left the network.
      // Still allow the first snapshot so Home is not stuck on Loading.
      if (mode === "poll" && pauseCountRef.current > 0 && stateRef.current) {
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
          const res = await fetch("/api/state", {
            cache: "no-store",
            headers: stateEtag.current
              ? { "If-None-Match": stateEtag.current }
              : undefined,
          });
          let bodyRes = res;
          if (res.status === 304) {
            if (pollGen.current !== gen) return;
            if (
              !staleOpenRetry.current &&
              stateRef.current &&
              openBetsPastResultWindow(stateRef.current)
            ) {
              staleOpenRetry.current = true;
              stateEtag.current = null;
              bodyRes = await fetch("/api/state", { cache: "no-store" });
            } else {
              staleOpenRetry.current = false;
              setError(null);
              return;
            }
          }
          if (bodyRes.status === 304) {
            if (pollGen.current !== gen) return;
            setError(null);
            return;
          }
          if (!bodyRes.ok) throw new Error(`HTTP ${bodyRes.status}`);
          const nextEtag = bodyRes.headers.get("etag");
          if (nextEtag) stateEtag.current = nextEtag;
          staleOpenRetry.current = false;
          const next = (await bodyRes.json()) as AppState;
          if (pollGen.current !== gen) return;
          if (
            mode === "poll" &&
            pauseCountRef.current > 0 &&
            stateRef.current
          ) {
            return;
          }
          const hold = settingsHoldRef.current;
          const settings =
            hold && !settingsHoldCovered(next.settings, hold)
              ? { ...next.settings, ...hold }
              : next.settings;
          if (hold && settingsHoldCovered(next.settings, hold)) {
            settingsHoldRef.current = null;
          }
          setDisplayTimeFormat(settings.timeFormat);
          const applied = { ...next, settings };
          if (
            mode === "poll" &&
            jsonSnapshotUnchanged(stateRef.current, applied) &&
            !(
              stateRef.current &&
              openBetsPastResultWindow(stateRef.current) &&
              !openBetsPastResultWindow(applied)
            )
          ) {
            setError(null);
            return;
          }
          setLive(applied);
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
      setLive((current) => {
        const base = current ?? cached;
        if (base == null) return current;
        return {
          ...base,
          offers: base.offers.map((row) =>
            row.id === offerId ? { ...row, ...patch } : row
          ),
        };
      });
    },
    [cached]
  );

  const applyLocalSettingsPatch = useCallback((patch: Partial<AppSettings>) => {
    settingsHoldRef.current = { ...settingsHoldRef.current, ...patch };
    setLive((current) => {
      const base = current ?? cached;
      if (base == null) return current;
      return { ...base, settings: { ...base.settings, ...patch } };
    });
  }, [cached]);

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
    if (pollingPaused && stateRef.current) return;

    function pollIfVisible() {
      if (typeof document !== "undefined" && document.hidden) return;
      if (stateRef.current && openBetsPastResultWindow(stateRef.current)) {
        stateEtag.current = null;
      }
      void fetchState("poll");
    }

    pollIfVisible();
    const timer = setInterval(pollIfVisible, pollMs);
    document.addEventListener("visibilitychange", pollIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pollIfVisible);
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

  const deskReady = state != null;

  useEffect(() => {
    if (publicDemo.active || !deskReady) return;
    void import("@/lib/prefetch-desk-pages").then((mod) => {
      mod.prefetchWarmDeskPages();
    });
  }, [deskReady, publicDemo.active]);

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
      setLive((current) =>
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
    () => ({
      state,
      error,
      refresh,
      applyLocalOfferPatch,
      applyLocalSettingsPatch,
      pausePolling,
    }),
    [state, error, refresh, applyLocalOfferPatch, applyLocalSettingsPatch, pausePolling]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/** Pause shared app-state polling while `paused` is true.
 * Safe outside `AppStateProvider` (marketing dialogs no-op).
 * `DialogContent` pauses for every open modal. */
export function usePauseAppStatePolling(paused: boolean) {
  const ctx = useContext(AppStateContext);
  useEffect(() => {
    if (!paused || !ctx) return;
    return ctx.pausePolling();
  }, [paused, ctx]);
}

/** @param _intervalMs Ignored. Shared poll is a product default (3s), not a user setting. */
export function useAppStateContext(_intervalMs?: number): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
