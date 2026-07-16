"use client";

/**
 * Shared Do Next assembly - offers scoped to available bookies, free-bet lots,
 * measured retention and funding checks. Used by the Home Do Next strip and
 * the Daily Plan so both rank work identically.
 */

import { useEffect, useMemo, useState } from "react";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  offerMatchesAvailableBookies,
  visibleBookieNames,
} from "@/lib/accounts/available-bookies";
import { bookmakerHealthMap } from "@/lib/accounts/bookmaker-stats";
import { effectiveEffortMinutes } from "@/lib/offers/effort";
import {
  buildDoNextItems,
  type BookieBalanceMap,
  type DoNextItem,
  type FreeBetLotInput,
} from "@/lib/offers/do-next";

export function useDoNextItems(pollMs?: number): {
  items: DoNextItem[];
  lots: FreeBetLotInput[];
  state: ReturnType<typeof useAppState>["state"];
} {
  const { state } = useAppState(pollMs);
  const [lots, setLots] = useState<FreeBetLotInput[]>([]);

  const retention = state?.retention;
  const freeBetTotal = state?.balances?.accounts
    ?.filter((a) => a.type === "bookie")
    .reduce((s, a) => s + (a.freeBets ?? 0), 0);

  useEffect(() => {
    api<{ lots: FreeBetLotInput[] }>("/api/accounts/free-bets")
      .then((r) => setLots(r.lots ?? []))
      .catch(() => setLots([]));
  }, [freeBetTotal]);

  // Gubbed bookies stay in scope (their offers sink, never hide); only
  // closed/archived wallets drop out.
  const scopedOffers = useMemo(() => {
    const all = state?.offers ?? [];
    const visible = visibleBookieNames(state?.balances?.accounts ?? []);
    if (visible.size === 0) return all;
    return all.filter((o) => offerMatchesAvailableBookies(o.bookmaker, visible));
  }, [state?.offers, state?.balances?.accounts]);

  const healthMap = useMemo(
    () => bookmakerHealthMap(state?.balances?.accounts ?? []),
    [state?.balances?.accounts]
  );

  const bookieBalances = useMemo<BookieBalanceMap>(() => {
    const map: BookieBalanceMap = new Map();
    for (const a of state?.balances?.accounts ?? []) {
      if (a.type === "bookie") map.set(a.name.trim().toLowerCase(), a.balance ?? 0);
    }
    return map;
  }, [state?.balances?.accounts]);

  // J1: explicit E1 overrides win; measured kinds blend toward the defaults.
  const tuningEffort = state?.settings.tuning.effortMinutes;
  const effortMeasured = state?.effortMeasured;
  const effortMinutes = useMemo(
    () => effectiveEffortMinutes(tuningEffort ?? {}, effortMeasured ?? {}),
    [tuningEffort, effortMeasured]
  );

  const items = useMemo(() => {
    const opts = {
      ...(retention
        ? { retention: retention.rate, retentionSampleSize: retention.sampleSize }
        : {}),
      bookmakerHealth: healthMap,
      effortMinutes,
    };
    // buildDoNextItems defaults `now` internally - keeps this memo pure.
    return buildDoNextItems(scopedOffers, lots, undefined, opts, bookieBalances);
  }, [scopedOffers, lots, retention, healthMap, effortMinutes, bookieBalances]);

  return { items, lots, state };
}
