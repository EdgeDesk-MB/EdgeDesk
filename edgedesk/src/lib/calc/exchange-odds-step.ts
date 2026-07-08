/** Exchange-style lay odds ladder stepping (Betfair-like increments). */

export const EXCHANGE_MIN_ODDS = 1.01;

const EPS = 1e-9;

export type ExchangeOddsDirection = "up" | "down";

function decimalPlaces(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  return 2;
}

function formatOdds(value: number, step: number): number {
  const dp = decimalPlaces(step);
  return parseFloat(Math.max(EXCHANGE_MIN_ODDS, value).toFixed(dp));
}

function tierMinForStep(step: number): number {
  if (step <= 0.01) return EXCHANGE_MIN_ODDS;
  if (step <= 0.05) return 3;
  if (step <= 0.1) return 4;
  if (step <= 0.5) return 10;
  return 20;
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
    if (odds < 3 - EPS) return 0.01;
    if (odds < 4 - EPS) return 0.05;
    if (odds < 10 - EPS) return 0.1;
    if (odds < 20 - EPS) return 0.5;
    return 1;
  }

  if (direction === "down") {
    if (odds > 20 + EPS) return 1;
    if (odds > 10 + EPS) return 0.5;
    if (odds > 4 + EPS) return 0.1;
    if (odds > 3 + EPS) return 0.05;
    return 0.01;
  }

  if (odds <= 3 + EPS) return 0.01;
  if (odds <= 4 + EPS) return 0.05;
  if (odds <= 10 + EPS) return 0.1;
  if (odds <= 20 + EPS) return 0.5;
  return 1;
}

/** Snap a value to the nearest valid exchange increment for its tier. */
export function roundExchangeOdds(odds: number): number {
  if (!Number.isFinite(odds)) return NaN;
  if (odds < EXCHANGE_MIN_ODDS) return EXCHANGE_MIN_ODDS;

  const step = getExchangeOddsStep(odds);
  const tierMin = tierMinForStep(step);
  const snapped = tierMin + Math.round((odds - tierMin) / step) * step;
  return formatOdds(snapped, step);
}

/** Step lay odds up or down on the exchange ladder. */
export function stepExchangeOdds(odds: number, direction: ExchangeOddsDirection): number {
  const base =
    Number.isFinite(odds) && odds >= EXCHANGE_MIN_ODDS
      ? roundExchangeOdds(odds)
      : EXCHANGE_MIN_ODDS;
  const step = getExchangeOddsStep(base, direction);
  const next = direction === "up" ? base + step : base - step;
  if (next < EXCHANGE_MIN_ODDS) return EXCHANGE_MIN_ODDS;
  return roundExchangeOdds(next);
}

/** Arrow-key handler for lay odds inputs — only intercepts ArrowUp/ArrowDown. */
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

/** Scroll-wheel handler — scroll down lowers odds, scroll up raises (exchange ladder). */
export function handleExchangeOddsWheel(
  e: { deltaY: number; preventDefault: () => void },
  value: number,
  onChange: (v: number) => void
): void {
  if (e.deltaY === 0) return;
  e.preventDefault();
  onChange(stepExchangeOdds(value, e.deltaY > 0 ? "down" : "up"));
}

/** Arrow keys + scroll wheel for exchange lay odds inputs. */
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
