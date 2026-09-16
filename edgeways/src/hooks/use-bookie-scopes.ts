"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  BOOKIE_SCOPES_MIGRATED_KEY,
  BOOKIE_SCOPES_STORAGE_KEY,
  EMPTY_EP_BOOKIE_SETUP,
  normalizeBookieScopes,
  resolveBookieScopesMigration,
  type EpBookieScope,
  type EpBookieSetup,
} from "@/lib/twoup/bookie-offers";
import {
  bookieScopesMigrateLock,
  EMPTY_BOOKIE_SCOPE_WALLET_NAMES,
} from "@/lib/twoup/bookie-scopes-migrate";

export function useBookieScopes(opts?: {
  walletNames?: readonly string[];
  walletsLoaded?: boolean;
}) {
  const { state, applyLocalSettingsPatch } = useAppState();
  const allowSeed = opts != null && "walletNames" in opts;
  const walletNames = opts?.walletNames ?? EMPTY_BOOKIE_SCOPE_WALLET_NAMES;
  const walletsLoaded = opts?.walletsLoaded ?? true;
  const scopes = state?.settings.bookieScopes ?? [];
  const setup = useMemo<EpBookieSetup>(() => ({ scopes }), [scopes]);
  const [hydrated, setHydrated] = useState(false);
  const persistGen = useRef(0);

  const persist = useCallback(
    async (next: readonly EpBookieScope[]) => {
      const previous = scopes;
      const bookieScopes = normalizeBookieScopes(next);
      const gen = ++persistGen.current;
      applyLocalSettingsPatch({ bookieScopes });
      try {
        await api("/api/settings", { method: "PATCH", json: { bookieScopes } });
      } catch (error) {
        if (gen === persistGen.current) {
          applyLocalSettingsPatch({ bookieScopes: previous });
        }
        const message = error instanceof Error ? error.message : "";
        if (!message.includes("look at the desk")) {
          toast.error("Could not save bookie scope");
        }
        throw error;
      }
    },
    [applyLocalSettingsPatch, scopes]
  );

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const persistSetup = useCallback(
    (next: EpBookieSetup) => {
      void persist(next.scopes);
    },
    [persist]
  );

  useLayoutEffect(() => {
    if (!state) return;
    if (allowSeed && !walletsLoaded) return;
    if (typeof window === "undefined") return;

    const alreadyMigrated = window.localStorage.getItem(BOOKIE_SCOPES_MIGRATED_KEY) === "1";
    const localStorageRaw = window.localStorage.getItem(BOOKIE_SCOPES_STORAGE_KEY);
    const result = resolveBookieScopesMigration({
      settingsScopes: state.settings.bookieScopes,
      localStorageRaw,
      alreadyMigrated,
      walletNames,
      allowSeed,
    });

    if (!result.shouldPersist && !result.markMigrated && !result.dropLocalStorage) {
      setHydrated(true);
      return;
    }

    if (result.shouldPersist) {
      if (!bookieScopesMigrateLock.tryStart()) {
        setHydrated(true);
        return;
      }
      void persistRef.current(result.scopes)
        .then(() => {
          window.localStorage.setItem(BOOKIE_SCOPES_MIGRATED_KEY, "1");
          window.localStorage.removeItem(BOOKIE_SCOPES_STORAGE_KEY);
        })
        .catch(() => {
          // Leave the lock set. Re-arming here is EDGE-156 (unbounded PATCH).
        })
        .finally(() => {
          setHydrated(true);
        });
      return;
    }

    if (result.markMigrated) {
      window.localStorage.setItem(BOOKIE_SCOPES_MIGRATED_KEY, "1");
    }
    if (result.dropLocalStorage) {
      window.localStorage.removeItem(BOOKIE_SCOPES_STORAGE_KEY);
    }
    setHydrated(true);
  }, [allowSeed, state, walletNames, walletsLoaded]);

  return {
    setup: state ? setup : EMPTY_EP_BOOKIE_SETUP,
    scopes,
    persist,
    persistSetup,
    hydrated,
  };
}
