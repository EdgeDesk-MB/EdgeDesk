"use client";

/**
 * Shared Do Next assembly - offers scoped to available bookies, free-bet lots,
 * measured retention and funding checks. Used by the Home Do Next strip and
 * the Daily Plan so both rank work identically.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, useAppState } from "@/hooks/use-app-state";
import {
  offerMatchesAvailableBookies,
  visibleBookieNames,
} from "@/lib/accounts/available-bookies";
import { bookmakerHealthMap } from "@/lib/accounts/bookmaker-stats";
import { effectiveEffortMinutes } from "@/lib/offers/effort";
import { mugDue } from "@/lib/accounts/mug-plan";
import { useNow } from "@/hooks/use-now";
import {
  buildDoNextItems,
  type BookieBalanceMap,
  type DoNextItem,
  type FreeBetLotInput,
} from "@/lib/offers/do-next";
import { canUseOfferEdge } from "@/lib/entitlements/offer-edge";
import { fetchOfferEdgePlays } from "@/lib/offers/offer-edge-client";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import { racingOfferEdgeKey } from "@/hooks/use-offer-edge-race-count";
import { localCalendarDate } from "@/lib/events";

export function useDoNextItems(pollMs?: number): {
  items: DoNextItem[];
  lots: FreeBetLotInput[];
  state: ReturnType<typeof useAppState>["state"];
} {
  const { state } = useAppState(pollMs);
  const [lots, setLots] = useState<FreeBetLotInput[]>([]);
  // Minute-bucketed clock keeps the memo pure while mug due-ness can flip.
  const now = useNow(60_000);

  const retention = state?.retention;
  const freeBetTotal = state?.balances?.accounts
    ?.filter((a) => a.type === "bookie")
    .reduce((s, a) => s + (a.freeBets ?? 0), 0);

  useEffect(() => {
    apiGet<{ lots: FreeBetLotInput[] }>("/api/accounts/free-bets")
      .then((r) => setLots(r.lots ?? []))
      .catch(() => setLots([]));
  }, [freeBetTotal, now]);

  const bets = state?.bets;
  const lotsWithOffers = useMemo(() => {
    if (!bets?.length) return lots;
    return lots.map((lot) => {
      if (lot.offerId != null || lot.betId == null) return lot;
      const offerId = bets.find((b) => b.id === lot.betId)?.offerId ?? null;
      return offerId != null ? { ...lot, offerId } : lot;
    });
  }, [lots, bets]);

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

  // J5: due camouflage reminders, scoped like offers (closed bookies drop out).
  const mugDueList = useMemo(() => {
    const visible = visibleBookieNames(state?.balances?.accounts ?? []);
    return (state?.mugPlans ?? [])
      .filter((p) => visible.size === 0 || visible.has(p.accountName.trim().toLowerCase()))
      .map((p) => ({ plan: p, due: mugDue(p, now) }))
      .filter(({ due }) => due.due)
      .map(({ plan, due }) => ({ accountName: plan.accountName, daysSince: due.daysSince }));
  }, [state?.mugPlans, state?.balances?.accounts, now]);

  // Offer Edge: the best race and horse per racing offer, so "place qualifying
  // bet" can name the play instead of just the bookmaker. Refreshed on the same
  // minute clock as the rest of this hook, and cached across callers.
  const canOfferEdge = canUseOfferEdge(state?.settings);
  const hasRacingOffer = useMemo(
    () => canOfferEdge && scopedOffers.some((o) => o.sport === "horse_racing"),
    [canOfferEdge, scopedOffers]
  );
  const [edgePlays, setEdgePlays] = useState<Map<number, OfferEdgePlay>>(new Map());
  const racingOfferKey = useMemo(
    () => racingOfferEdgeKey(scopedOffers),
    [scopedOffers]
  );
  const prevRacingOfferKey = useRef(racingOfferKey);

  // Adjust-during-render (react-hooks/set-state-in-effect): drop plays as soon
  // as no racing offer remains; the effect below only fetches.
  const [prevHasRacingOffer, setPrevHasRacingOffer] = useState(hasRacingOffer);
  if (hasRacingOffer !== prevHasRacingOffer) {
    setPrevHasRacingOffer(hasRacingOffer);
    if (!hasRacingOffer) setEdgePlays(new Map());
  }

  useEffect(() => {
    if (!hasRacingOffer) return;
    let cancelled = false;
    const date = localCalendarDate();
    const offerSetChanged = prevRacingOfferKey.current !== racingOfferKey;
    prevRacingOfferKey.current = racingOfferKey;
    fetchOfferEdgePlays(date, { force: offerSetChanged }).then(({ plays }) => {
      if (cancelled) return;
      // Plays arrive best-EV first, so the first per offer is the one to show.
      const best = new Map<number, OfferEdgePlay>();
      for (const play of plays) {
        if (!best.has(play.offerId)) best.set(play.offerId, play);
      }
      setEdgePlays(best);
    });
    return () => {
      cancelled = true;
    };
  }, [hasRacingOffer, now, racingOfferKey]);

  const items = useMemo(() => {
    const opts = {
      ...(retention
        ? { retention: retention.rate, retentionSampleSize: retention.sampleSize }
        : {}),
      bookmakerHealth: healthMap,
      effortMinutes,
      mugDue: mugDueList,
      edgePlays,
    };
    // buildDoNextItems defaults `now` internally - keeps this memo pure.
    return buildDoNextItems(scopedOffers, lotsWithOffers, undefined, opts, bookieBalances);
  }, [
    scopedOffers,
    lotsWithOffers,
    retention,
    healthMap,
    effortMinutes,
    mugDueList,
    bookieBalances,
    edgePlays,
  ]);

  return { items, lots: lotsWithOffers, state };
}
