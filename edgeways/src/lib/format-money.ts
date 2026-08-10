/** Round to pence - use before storing or comparing GBP amounts. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * True when a GBP amount is negative after rounding to pence.
 * Use for red/loss colouring so floating-point dust that displays as £0.00
 * is never treated as an overdraft.
 */
export function isNegativeGbp(value: number): boolean {
  return roundMoney(value) < 0;
}

/** True when a GBP amount has no fractional pence after rounding. */
export function isWholePounds(value: number): boolean {
  const rounded = roundMoney(value);
  return Number.isFinite(rounded) && Math.round(rounded * 100) % 100 === 0;
}

/** Fraction digits for EV / estimate surfaces: 0 for whole pounds, 2 otherwise. */
export function evFractionDigits(value: number): number {
  return isWholePounds(value) ? 0 : 2;
}

/**
 * EV / estimate GBP label: whole pounds without decimals, otherwise two dp.
 * e.g. £14, £6.70, £9.50
 */
export function formatEvGbp(
  value: number | null | undefined,
  opts?: { signed?: boolean }
): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const rounded = roundMoney(value);
  const whole = isWholePounds(rounded);
  const abs = Math.abs(rounded);
  const formatted = whole
    ? Math.round(abs).toLocaleString("en-GB")
    : abs.toFixed(2);

  if (opts?.signed) {
    if (rounded > 0) return `+£${formatted}`;
    if (rounded < 0) return `-£${formatted}`;
    return `£${formatted}`;
  }
  if (rounded < 0) return `-£${formatted}`;
  return `£${formatted}`;
}

/** Absolute amount as `12.30` (no £) - money inputs and bare pence copy. */
export function formatMoneyAmount(value: number): string {
  return roundMoney(value).toFixed(2);
}

/** Static GBP label with exactly 2 decimal places. */
export function formatGbp(
  value: number | null | undefined,
  opts?: { signed?: boolean }
): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const rounded = roundMoney(value);
  const abs = formatMoneyAmount(Math.abs(rounded));
  if (opts?.signed) {
    if (rounded > 0) return `+£${abs}`;
    if (rounded < 0) return `-£${abs}`;
    return `£${abs}`;
  }
  if (rounded < 0) return `-£${abs}`;
  return `£${abs}`;
}
