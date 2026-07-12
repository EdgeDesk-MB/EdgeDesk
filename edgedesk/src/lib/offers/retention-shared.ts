/**
 * Bayesian blend of a measured retention rate toward a prior.
 * With few conversions the prior dominates; with many the measured rate wins.
 * n=0 → prior; large n → measured.
 */
export function blendedRetention(
  measured: number,
  n: number,
  prior = 0.8,
  priorWeight = 5
): number {
  return (measured * n + prior * priorWeight) / (n + priorWeight);
}
