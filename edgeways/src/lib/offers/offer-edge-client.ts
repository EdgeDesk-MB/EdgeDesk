"use client";

import { api } from "@/hooks/use-app-state";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";

export interface OfferEdgeResponse {
  date: string;
  plays: OfferEdgePlay[];
  source?: "demo" | "racing-api" | "error";
}

/**
 * Shared in-flight cache, keyed by date.
 *
 * Building the plays still hits racecards plus exchange books for qualifying
 * races, so several offer cards mounting at once must not each trigger it.
 */
const inFlight = new Map<string, Promise<OfferEdgeResponse>>();

const CACHE_TTL_MS = 60_000;
const settled = new Map<string, { at: number; value: OfferEdgeResponse }>();
/** Bumped on force so a slower in-flight response cannot overwrite a fresh one. */
let fetchGen = 0;

export function fetchOfferEdgePlays(
  date: string,
  opts?: { force?: boolean }
): Promise<OfferEdgeResponse> {
  if (opts?.force) {
    settled.delete(date);
  } else {
    const cached = settled.get(date);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return Promise.resolve(cached.value);
    }
  }

  // Always join an in-flight build. `force` only drops the settled cache —
  // campaign cards must not each start a fresh Betfair round-trip.
  const existing = inFlight.get(date);
  if (existing) return existing;

  fetchGen += 1;
  const gen = fetchGen;
  const request = api<OfferEdgeResponse>(
    `/api/offers/edge?date=${encodeURIComponent(date)}`
  )
    .then((data) => {
      const value: OfferEdgeResponse = { date, plays: data.plays ?? [], source: data.source };
      if (gen === fetchGen) settled.set(date, { at: Date.now(), value });
      return value;
    })
    .catch(() => ({ date, plays: [] }) satisfies OfferEdgeResponse)
    .finally(() => {
      if (inFlight.get(date) === request) inFlight.delete(date);
    });

  inFlight.set(date, request);
  return request;
}

/** Warm today's picks without blocking the desk. Safe to call from any mount. */
export function prefetchOfferEdgePlays(date: string): void {
  void fetchOfferEdgePlays(date);
}

/** Drop the cache so a refresh re-reads live prices. */
export function clearOfferEdgeCache(): void {
  settled.clear();
  inFlight.clear();
  fetchGen += 1;
}
