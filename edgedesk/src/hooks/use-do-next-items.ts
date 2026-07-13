"use client";

/**
 * Shared Do Next assembly - offers scoped to available bookies, free-bet lots,
 * measured retention and funding checks. Used by the Home Do Next strip and
 * the Daily Plan so both rank work identically.
 */

import { useEffect, useMemo, useState } from "react";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
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

  const scopedOffers = useMemo(() => {
    const all = state?.offers ?? [];
    const available = availableBookieNames(state?.balances?.accounts ?? []);
    if (available.size === 0) return all;
    return all.filter((o) => offerMatchesAvailableBookies(o.bookmaker, available));
  }, [state?.offers, state?.balances?.accounts]);

  const bookieBalances = useMemo<BookieBalanceMap>(() => {
    const map: BookieBalanceMap = new Map();
    for (const a of state?.balances?.accounts ?? []) {
      if (a.type === "bookie") map.set(a.name.trim().toLowerCase(), a.balance ?? 0);
    }
    return map;
  }, [state?.balances?.accounts]);

  const items = useMemo(() => {
    const retentionOpts = retention
      ? { retention: retention.rate, retentionSampleSize: retention.sampleSize }
      : undefined;
    // buildDoNextItems defaults `now` internally - keeps this memo pure.
    return buildDoNextItems(scopedOffers, lots, undefined, retentionOpts, bookieBalances);
  }, [scopedOffers, lots, retention, bookieBalances]);

  return { items, lots, state };
}
