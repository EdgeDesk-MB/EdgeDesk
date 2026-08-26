/**
 * Lay-stake increment + display. UK exchanges (Betfair, Betdaq, Smarkets,
 * Matchbook) accept pounds and pence, so the executable increment is £0.01
 * and the idle display is always two decimal places.
 *
 * Arrow / wheel steps stay on that penny grid. Bind the wheel with
 * `useNonPassiveWheel` (never React `onWheel`). Do not use a raw HTML
 * `step={0.01}` number input for lay stake: native spinners drop trailing
 * zeros and do not share this display rule.
 */

import { roundPence } from "./money";

export const EXCHANGE_STAKE_INCREMENT = 0.01;

const EPS = 1e-9;

export type ExchangeStakeDirection = "up" | "down";

/** Always two decimal places — the exchange stake box. */
export function formatLayStake(stake: number): string {
  if (!Number.isFinite(stake)) return "";
  return roundPence(stake).toFixed(2);
}

/** Snap to the nearest penny the exchange will accept. */
export function roundLayStake(stake: number): number {
  if (!Number.isFinite(stake)) return NaN;
  return roundPence(Math.max(0, stake));
}

export function commitLayStake(stake: number): number {
  if (!Number.isFinite(stake) || stake < 0) return stake;
  return roundLayStake(stake);
}

export function stepLayStake(stake: number, direction: ExchangeStakeDirection): number {
  const base =
    Number.isFinite(stake) && stake >= 0 ? roundLayStake(stake) : 0;
  const next =
    direction === "up" ? base + EXCHANGE_STAKE_INCREMENT : base - EXCHANGE_STAKE_INCREMENT;
  return roundLayStake(Math.max(0, next));
}

export function handleLayStakeKeyDown(
  e: { key: string; preventDefault: () => void },
  value: number,
  onChange: (v: number) => void
): void {
  if (e.key === "ArrowUp") {
    e.preventDefault();
    onChange(stepLayStake(value, "up"));
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    onChange(stepLayStake(value, "down"));
  }
}

export function handleLayStakeWheel(
  e: { deltaY: number; preventDefault: () => void },
  value: number,
  onChange: (v: number) => void
): void {
  if (e.deltaY === 0) return;
  e.preventDefault();
  onChange(stepLayStake(value, e.deltaY > 0 ? "down" : "up"));
}

export function layStakeStepHandlers(
  value: number,
  onChange: (v: number) => void
): {
  onKeyDown: (e: { key: string; preventDefault: () => void }) => void;
  onWheel: (e: { deltaY: number; preventDefault: () => void }) => void;
} {
  return {
    onKeyDown: (e) => handleLayStakeKeyDown(e, value, onChange),
    onWheel: (e) => handleLayStakeWheel(e, value, onChange),
  };
}

/** True when a value sits on the exchange penny grid (or is empty). */
export function isExchangeLayStake(stake: number): boolean {
  if (!Number.isFinite(stake)) return true;
  return Math.abs(stake - roundLayStake(stake)) < EPS;
}
