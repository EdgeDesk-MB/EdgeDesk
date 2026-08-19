/** UK exchange lay-odds ladder (Betfair / Betdaq / Matchbook / Smarkets). */

export const EXCHANGE_MIN_ODDS = 1.01;
export const EXCHANGE_MAX_ODDS = 1000;

const EPS = 1e-9;

export type ExchangeOddsDirection = "up" | "down";

/**
 * Tick bands used by Betfair, Betdaq and Matchbook. Smarkets is percentage-
 * based underneath but the displayed decimal rungs match this ladder.
 */
const TIERS: readonly { max: number; step: number }[] = [
  { max: 2, step: 0.01 },
  { max: 3, step: 0.02 },
  { max: 4, step: 0.05 },
  { max: 6, step: 0.1 },
  { max: 10, step: 0.2 },
  { max: 20, step: 0.5 },
  { max: 30, step: 1 },
  { max: 50, step: 2 },
  { max: 100, step: 5 },
  { max: 1000, step: 10 },
];

function decimalPlaces(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  return 2;
}

function formatOdds(value: number, step: number): number {
  const dp = decimalPlaces(step);
  return parseFloat(Math.min(EXCHANGE_MAX_ODDS, Math.max(EXCHANGE_MIN_ODDS, value)).toFixed(dp));
}

function tierMinForStep(step: number): number {
  if (step <= 0.01) return EXCHANGE_MIN_ODDS;
  if (step <= 0.02) return 2;
  if (step <= 0.05) return 3;
  if (step <= 0.1) return 4;
  if (step <= 0.2) return 6;
  if (step <= 0.5) return 10;
  if (step <= 1) return 20;
  if (step <= 2) return 30;
  if (step <= 5) return 50;
  return 100;
}

/**
 * Step size for the current odds value.
 * With `direction`, boundary transitions use the tier being entered (up) or left (down).
 */
export function getExchangeOddsStep(
  odds: number,
  direction?: ExchangeOddsDirection
): number {
  if (!Number.isFinite(odds)) return 0.01;

  if (direction === "up") {
    for (const tier of TIERS) {
      if (odds < tier.max - EPS) return tier.step;
    }
    return 10;
  }

  if (direction === "down") {
    for (let i = TIERS.length - 1; i >= 0; i--) {
      const prevMax = i === 0 ? EXCHANGE_MIN_ODDS : TIERS[i - 1]!.max;
      if (odds > prevMax + EPS) return TIERS[i]!.step;
    }
    return 0.01;
  }

  for (const tier of TIERS) {
    if (odds <= tier.max + EPS) return tier.step;
  }
  return 10;
}

/** Snap a value to the nearest valid exchange increment for its tier. */
export function roundExchangeOdds(odds: number): number {
  if (!Number.isFinite(odds)) return NaN;
  if (odds < EXCHANGE_MIN_ODDS) return EXCHANGE_MIN_ODDS;
  if (odds > EXCHANGE_MAX_ODDS) return EXCHANGE_MAX_ODDS;

  const step = getExchangeOddsStep(odds);
  const tierMin = tierMinForStep(step);
  const ticks = Math.round((odds - tierMin) / step + 1e-6);
  const snapped = tierMin + ticks * step;
  return formatOdds(snapped, step);
}

/** Idle display: tick decimal places when on-ladder; raw 2 dp while still off-tick. */
export function formatExchangeOdds(odds: number): string {
  if (!Number.isFinite(odds)) return "";
  const snapped = roundExchangeOdds(odds);
  if (Math.abs(odds - snapped) < EPS) {
    return snapped.toFixed(decimalPlaces(getExchangeOddsStep(snapped)));
  }
  return parseFloat(odds.toFixed(2)).toString();
}

/**
 * Native spinner sends previous ± HTML `step`. Map that onto the ladder.
 * Any other change (typing 6.97) is kept as entered.
 */
export function applyExchangeOddsInputChange(
  previous: number,
  next: number,
  onChange: (v: number) => void
): void {
  if (!Number.isFinite(next)) {
    onChange(Number.NaN);
    return;
  }
  if (Number.isFinite(previous)) {
    const delta = next - previous;
    const step = getExchangeOddsStep(previous);
    if (Math.abs(Math.abs(delta) - step) < 1e-6) {
      onChange(stepExchangeOdds(previous, delta > 0 ? "up" : "down"));
      return;
    }
  }
  onChange(next);
}

function stepOnTick(base: number, direction: ExchangeOddsDirection): number {
  const step = getExchangeOddsStep(base, direction);
  const next = direction === "up" ? base + step : base - step;
  if (next < EXCHANGE_MIN_ODDS) return EXCHANGE_MIN_ODDS;
  if (next > EXCHANGE_MAX_ODDS) return EXCHANGE_MAX_ODDS;
  return roundExchangeOdds(next);
}

/**
 * Step lay odds up or down on the exchange ladder.
 * Off-tick typed prices (6.97) move to the next tick in that direction only
 * (7.0 / 6.8), then further presses follow the ladder.
 */
export function stepExchangeOdds(odds: number, direction: ExchangeOddsDirection): number {
  const raw =
    Number.isFinite(odds) && odds >= EXCHANGE_MIN_ODDS ? odds : EXCHANGE_MIN_ODDS;
  const snapped = roundExchangeOdds(raw);
  if (Math.abs(raw - snapped) > EPS) {
    if (direction === "up") {
      return snapped > raw + EPS ? snapped : stepOnTick(snapped, "up");
    }
    return snapped < raw - EPS ? snapped : stepOnTick(snapped, "down");
  }
  return stepOnTick(snapped, direction);
}

/** Arrow-key handler for lay odds inputs - only intercepts ArrowUp/ArrowDown. */
export function handleExchangeOddsKeyDown(
  e: { key: string; preventDefault: () => void },
  value: number,
  onChange: (v: number) => void
): void {
  if (e.key === "ArrowUp") {
    e.preventDefault();
    onChange(stepExchangeOdds(value, "up"));
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    onChange(stepExchangeOdds(value, "down"));
  }
}

/** Scroll-wheel handler - scroll down lowers odds, scroll up raises (exchange ladder). */
export function handleExchangeOddsWheel(
  e: { deltaY: number; preventDefault: () => void },
  value: number,
  onChange: (v: number) => void
): void {
  if (e.deltaY === 0) return;
  e.preventDefault();
  onChange(stepExchangeOdds(value, e.deltaY > 0 ? "down" : "up"));
}

/** Arrow keys + scroll wheel for exchange lay odds inputs. Typed values stay. */
export function exchangeOddsStepHandlers(
  value: number,
  onChange: (v: number) => void
): {
  onKeyDown: (e: { key: string; preventDefault: () => void }) => void;
  onWheel: (e: { deltaY: number; preventDefault: () => void }) => void;
} {
  return {
    onKeyDown: (e) => handleExchangeOddsKeyDown(e, value, onChange),
    onWheel: (e) => handleExchangeOddsWheel(e, value, onChange),
  };
}
