/** Money amounts placed on bookies/exchanges - round to nearest penny. */
export function roundPence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Excel MROUND for stakes: nearest multiple of `increment`, halfway away from
 * zero. Worked in integer pence so 132.6875 to £0.01 is exactly 132.69.
 */
export function roundToIncrement(value: number, increment: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(increment) || increment <= 0) return roundPence(value);
  const incrementPence = Math.round(increment * 100);
  if (incrementPence <= 0) return roundPence(value);
  const units = (value * 100) / incrementPence;
  const roundedUnits = units >= 0 ? Math.round(units) : -Math.round(-units);
  return roundPence((roundedUnits * incrementPence) / 100);
}

/**
 * Next increment above or below `value` on the increment grid (from zero).
 * Already-aligned values move by one increment. Stakes never go below £0.
 */
export function stepByIncrement(
  value: number,
  increment: number,
  direction: 1 | -1
): number {
  if (!Number.isFinite(value)) return 0;
  const incrementPence = Math.round(
    (Number.isFinite(increment) && increment > 0 ? increment : 0.01) * 100
  );
  if (incrementPence <= 0) return roundPence(Math.max(0, value));
  const currentPence = Math.round(roundPence(value) * 100);
  const rem = ((currentPence % incrementPence) + incrementPence) % incrementPence;
  const nextPence =
    direction > 0
      ? rem === 0
        ? currentPence + incrementPence
        : currentPence + (incrementPence - rem)
      : rem === 0
        ? currentPence - incrementPence
        : currentPence - rem;
  return roundPence(Math.max(0, nextPence) / 100);
}
