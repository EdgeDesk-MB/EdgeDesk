/** Money amounts placed on bookies/exchanges — round to nearest penny. */
export function roundPence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}
