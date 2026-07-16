/**
 * Measured execution effort (J1) - turns logged offer-execution durations
 * into the effort minutes behind the £/hr sort. Pure and client-safe.
 *
 * Precedence at the £/hr call site: explicit E1 tuning override (user intent)
 * beats measured; measured (blended toward the default prior) beats the
 * static EFFORT_MINUTES guess.
 */

import { EFFORT_MINUTES } from "@/lib/offers/do-next";

export interface EffortSampleLike {
  actionKind: string;
  durationMin: number;
  createdAt: number;
}

export interface MeasuredEffort {
  minutes: number;
  sampleSize: number;
}

/** Only the freshest samples count - technique improves, old timings mislead. */
const SAMPLE_WINDOW = 20;

/** Per-kind median of the most recent SAMPLE_WINDOW samples. */
export function medianEffortByKind(
  samples: EffortSampleLike[]
): Record<string, MeasuredEffort> {
  const byKind = new Map<string, EffortSampleLike[]>();
  for (const s of samples) {
    const list = byKind.get(s.actionKind) ?? [];
    list.push(s);
    byKind.set(s.actionKind, list);
  }

  const out: Record<string, MeasuredEffort> = {};
  for (const [kind, list] of byKind) {
    const recent = [...list]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, SAMPLE_WINDOW)
      .map((s) => s.durationMin)
      .sort((a, b) => a - b);
    const mid = Math.floor(recent.length / 2);
    const median =
      recent.length % 2 === 1 ? recent[mid] : (recent[mid - 1] + recent[mid]) / 2;
    out[kind] = { minutes: median, sampleSize: recent.length };
  }
  return out;
}

/** A1's blend idiom: few samples lean on the prior, many samples win. */
export function blendedEffortMinutes(
  measured: number,
  n: number,
  prior: number,
  priorWeight = 3
): number {
  if (n + priorWeight <= 0) return prior;
  return (measured * n + prior * priorWeight) / (n + priorWeight);
}

/**
 * The effort map handed to buildDoNextItems: explicit tuning overrides pass
 * through untouched; measured kinds blend toward their static default; kinds
 * with neither stay absent so do-next uses EFFORT_MINUTES directly.
 */
export function effectiveEffortMinutes(
  tuningOverrides: Record<string, number>,
  measured: Record<string, MeasuredEffort>
): Record<string, number> {
  const out: Record<string, number> = { ...tuningOverrides };
  for (const [kind, m] of Object.entries(measured)) {
    if (out[kind] != null) continue; // user override wins
    const prior = EFFORT_MINUTES[kind as keyof typeof EFFORT_MINUTES] ?? m.minutes;
    out[kind] = blendedEffortMinutes(m.minutes, m.sampleSize, prior);
  }
  return out;
}
