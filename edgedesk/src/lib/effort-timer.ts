"use client";

/**
 * Hybrid effort capture (J1) - a per-tab singleton, no React plumbing.
 * beginEffort marks the first meaningful engagement with an offer;
 * completeEffort fires when a bet for that offer saves, posting the sample.
 * Out-of-band durations are rejected server-side; stale starts expire here.
 * Users can edit a wrong measurement afterwards on the campaign card.
 */

import { api } from "@/hooks/use-app-state";

const STALE_MS = 60 * 60 * 1000;

const running = new Map<number, { startedAt: number; actionKind: string }>();

/** First engagement wins - re-opening the same offer does not restart the clock. */
export function beginEffort(offerId: number, actionKind: string): void {
  const existing = running.get(offerId);
  const now = Date.now();
  if (existing && now - existing.startedAt < STALE_MS) return;
  running.set(offerId, { startedAt: now, actionKind });
}

/** Called when a bet linked to the offer saves; posts the sample and clears. */
export function completeEffort(offerId: number): void {
  const entry = running.get(offerId);
  if (!entry) return;
  running.delete(offerId);
  const endedAt = Date.now();
  if (endedAt - entry.startedAt >= STALE_MS) return;
  void api("/api/effort", {
    method: "POST",
    json: {
      offerId,
      actionKind: entry.actionKind,
      startedAt: entry.startedAt,
      endedAt,
    },
  }).catch(() => {
    // Best-effort telemetry - never interrupt the betting flow.
  });
}
