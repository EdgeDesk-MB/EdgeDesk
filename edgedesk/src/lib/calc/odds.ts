/** Odds conversion + implied probability utilities. All internal math uses decimal odds. */

export function decimalToFractional(decimal: number): string {
  const value = decimal - 1;
  if (value <= 0) return "0/1";
  // Find the nicest fraction within 0.01% using a bounded Stern-Brocot search
  let bestN = 1;
  let bestD = 1;
  let bestErr = Infinity;
  for (let d = 1; d <= 100; d++) {
    const n = Math.round(value * d);
    if (n === 0) continue;
    const err = Math.abs(value - n / d);
    if (err < bestErr - 1e-12) {
      bestErr = err;
      bestN = n;
      bestD = d;
    }
    if (bestErr < 1e-9) break;
  }
  return `${bestN}/${bestD}`;
}

export function fractionalToDecimal(fraction: string): number | null {
  const match = fraction.trim().match(/^(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const den = parseFloat(match[2]);
  if (den === 0) return null;
  return 1 + num / den;
}

export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

export function americanToDecimal(american: number): number {
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

/** Implied probability of decimal odds (includes bookmaker margin). */
export function impliedProbability(decimal: number): number {
  return 1 / decimal;
}

export function probabilityToDecimal(probability: number): number {
  return 1 / probability;
}
