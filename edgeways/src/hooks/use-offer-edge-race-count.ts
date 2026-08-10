"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canUseOfferEdge } from "@/lib/entitlements/offer-edge";
import { fetchOfferEdgePlays } from "@/lib/offers/offer-edge-client";
import type { PlanPreview } from "@/lib/entitlements/acca-desk";
import { useNow } from "@/hooks/use-now";

/**
 * Unique Race picks (Offer Edge) race count for today.
 * Returns 0 when the plan preview is not Edge-entitled.
 * Re-checks on a minute clock and when the racing-offer set changes.
 */
export function useOfferEdgeRaceCount(
  settings?: { planPreview?: PlanPreview | null } | null,
  /** Stable key of active/planned racing offer ids — forces a fresh read when it changes. */
  racingOfferKey = ""
): number {
  const entitled = canUseOfferEdge(settings);
  const [count, setCount] = useState(0);
  // Align with Offer Edge client cache TTL so the nav can notice new picks.
  const now = useNow(60_000);
  const prevOfferKey = useRef(racingOfferKey);

  useEffect(() => {
    if (!entitled) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const date = new Date().toISOString().slice(0, 10);
    const offerSetChanged = prevOfferKey.current !== racingOfferKey;
    prevOfferKey.current = racingOfferKey;
    fetchOfferEdgePlays(date, { force: offerSetChanged }).then(({ plays }) => {
      if (cancelled) return;
      setCount(new Set(plays.map((p) => p.raceExternalId)).size);
    });
    return () => {
      cancelled = true;
    };
  }, [entitled, now, racingOfferKey]);

  return entitled ? count : 0;
}

/** Compact key of racing offers that can drive Race picks. */
export function racingOfferEdgeKey(
  offers: Array<{ id: number; sport?: string | null; status?: string | null }> | null | undefined
): string {
  if (!offers?.length) return "";
  return offers
    .filter(
      (o) =>
        o.sport === "horse_racing" &&
        (o.status === "active" || o.status === "planned")
    )
    .map((o) => o.id)
    .sort((a, b) => a - b)
    .join(",");
}

export function useRacingOfferEdgeKey(
  offers: Array<{ id: number; sport?: string | null; status?: string | null }> | null | undefined
): string {
  return useMemo(() => racingOfferEdgeKey(offers), [offers]);
}
