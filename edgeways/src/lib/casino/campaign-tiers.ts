/**
 * UI grouping for casino campaign steps. Money maths stays a flat sum of
 * each component's locked expectedEv - tiers are presentation only.
 *
 * A new tier starts at every qualifying_wager; following reward steps attach
 * to that tier until the next qualifying wager. Leading rewards (no QW yet)
 * form a single orphan tier.
 */

export type CampaignTier<T extends { componentType: string }> = {
  /** 1-based display index */
  index: number;
  components: T[];
};

export function groupCampaignTiers<T extends { componentType: string }>(
  components: T[]
): CampaignTier<T>[] {
  const buckets: T[][] = [];
  for (const c of components) {
    if (c.componentType === "qualifying_wager") {
      buckets.push([c]);
    } else if (buckets.length === 0) {
      buckets.push([c]);
    } else {
      buckets[buckets.length - 1]!.push(c);
    }
  }
  return buckets.map((items, i) => ({ index: i + 1, components: items }));
}

/** Stake ladders and multi-QW campaigns get tier chrome; a single pair stays flat. */
export function shouldShowCampaignTiers<T extends { componentType: string }>(
  tiers: CampaignTier<T>[]
): boolean {
  if (tiers.length < 2) return false;
  return tiers.some((t) => t.components.some((c) => c.componentType === "qualifying_wager"));
}

export function tierExpectedEv<T extends { expectedEv: number }>(components: T[]): number {
  let sum = 0;
  for (const c of components) sum += c.expectedEv;
  return sum;
}
