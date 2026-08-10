"use client";

import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";

export interface OfferEdgeResponse {
  date: string;
  plays: OfferEdgePlay[];
  source?: "demo" | "racing-api" | "error";
}

/**
 * Shared in-flight cache, keyed by date.
 *
 * Building the plays means assembling the whole Racing Desk (racecards plus a live
 * exchange call), so several offer cards mounting at once must not each trigger it.
 */
const inFlight = new Map<string, Promise<OfferEdgeResponse>>();

const CACHE_TTL_MS = 60_000;
const settled = new Map<string, { at: number; value: OfferEdgeResponse }>();

export function fetchOfferEdgePlays(
  date: string,
  opts?: { force?: boolean }
): Promise<OfferEdgeResponse> {
  if (!opts?.force) {
    const cached = settled.get(date);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return Promise.resolve(cached.value);
    }
  } else {
    settled.delete(date);
  }

  const existing = inFlight.get(date);
  if (existing) return existing;

  const request = fetch(`/api/offers/edge?date=${encodeURIComponent(date)}`)
    .then((res) => (res.ok ? res.json() : { date, plays: [] }))
    .then((data: OfferEdgeResponse) => {
      const value: OfferEdgeResponse = { date, plays: data.plays ?? [], source: data.source };
      settled.set(date, { at: Date.now(), value });
      return value;
    })
    .catch(() => ({ date, plays: [] }) satisfies OfferEdgeResponse)
    .finally(() => {
      inFlight.delete(date);
    });

  inFlight.set(date, request);
  return request;
}

/** Drop the cache so a refresh re-reads live prices. */
export function clearOfferEdgeCache(): void {
  settled.clear();
  inFlight.clear();
}
