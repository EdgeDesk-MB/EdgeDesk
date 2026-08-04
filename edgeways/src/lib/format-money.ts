/** Round to pence - use before storing or comparing GBP amounts. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Static GBP label with exactly 2 decimal places. */
export function formatGbp(
  value: number | null | undefined,
  opts?: { signed?: boolean }
): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const rounded = roundMoney(value);
  const abs = Math.abs(rounded).toFixed(2);
  if (opts?.signed) {
    if (rounded > 0) return `+£${abs}`;
    if (rounded < 0) return `-£${abs}`;
    return `£${abs}`;
  }
  if (rounded < 0) return `-£${abs}`;
  return `£${abs}`;
}
