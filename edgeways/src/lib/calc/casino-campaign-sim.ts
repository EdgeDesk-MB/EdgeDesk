/**
 * Combined-campaign Monte Carlo simulation (K2) - the multi-component
 * counterpart to `casino-sim.ts`'s single-Bonus simulator. A campaign's real
 * bust risk is the SUM of its components' risk; this composes ONE run per
 * campaign by chaining/summing each component's own contribution, reusing
 * `casino-sim.ts`'s session engine (`runSession`, `sessionParams`,
 * `ladderCumulative`, `drawLadderReturn`) rather than reimplementing it -
 * see the K2 brief (implementation-briefs.md, Phase 12) for the full spec
 * and the reasoning behind each component's chosen shape.
 *
 * Sign conventions (carried over from the analytic calc, casino-reward-ev.ts):
 * - Bonus / Free Spins: the reward is the OPERATOR's money - the session's
 *   retained balance (`final`) IS the contribution, no subtraction.
 * - Qualifying wager / Cashback's underlying play: the stake is the
 *   PLAYER's own money - the contribution is the CHANGE relative to what
 *   went in (`final - amount`), matching a loss/gain on their own stake.
 * - Golden Chips: chips are free like spins - the raw per-chip draw already
 *   nets to the right mean, no subtraction.
 */

import { DEFAULT_RTP, houseEdgeFromRtp } from "./casino-ev";
import {
  drawLadderReturn,
  ladderCumulative,
  runSession,
  sessionParams,
  type CasinoSimInput,
  type SlotVolatility,
} from "./casino-sim";
import { roundPence } from "./money";
import type { CasinoComponentType } from "./casino-reward-ev";

/** Even-money outside bet (red/black, odd/even) - the natural default for a single discrete bet. Confirm against a real golden-chips promo before treating this as final; see the K2 brief. */
export const GOLDEN_CHIP_PAYOUT_MULTIPLIER = 2;

/** Loosely-typed, nullable input mirroring the `casino_offer_components` row shape - same shape `deriveComponentEv` consumes, so a campaign's stored components feed both the analytic and simulated paths identically. */
export interface CampaignSimComponent {
  componentType: CasinoComponentType;
  amount?: number | null;
  wageringMultiplier?: number | null;
  rtp?: number | null;
  contributionPct?: number | null;
  spins?: number | null;
  spinValue?: number | null;
  chipCount?: number | null;
  chipValue?: number | null;
  cashbackPct?: number | null;
  cashbackCap?: number | null;
}

/**
 * Free Spins stage 1: `spins` independent draws against the SAME ladder
 * `runSession` uses, each staking `spinValue`, summed. No cycling, no bust
 * condition - a fixed number of one-shot draws, not a wagering session.
 */
export function simulateSpinsSession(
  spins: number,
  spinValue: number,
  volatility: SlotVolatility,
  rtp: number,
  rng: () => number
): number {
  if (!(spins > 0) || !(spinValue > 0)) return 0;
  const { hitRate, cumP, multipliers } = ladderCumulative(volatility, rtp);
  let total = 0;
  for (let i = 0; i < spins; i++) {
    total += drawLadderReturn(hitRate, cumP, multipliers, spinValue, rng);
  }
  return total;
}

/**
 * A golden chip is one discrete bet, not a slot spin - a single Bernoulli
 * draw. `p` is chosen so `p × payoutMultiplier = 1 − houseEdge` exactly,
 * matching `goldenChipsEv`'s mean by construction.
 */
export function simulateGoldenChipReturn(
  chipValue: number,
  houseEdge: number,
  rng: () => number,
  payoutMultiplier: number = GOLDEN_CHIP_PAYOUT_MULTIPLIER
): number {
  if (!(chipValue > 0)) return 0;
  const edge = Math.min(1, Math.max(0, houseEdge));
  const p = (1 - edge) / payoutMultiplier;
  return rng() < p ? chipValue * payoutMultiplier : 0;
}

function houseEdgeOf(c: CampaignSimComponent): number {
  return houseEdgeFromRtp(c.rtp ?? DEFAULT_RTP);
}

/** One wagering-cycle session (bonus/qualifying-wager/cashback-underlying-play shape), or null if there's nothing to cycle. */
function cycleSession(
  bonus: number,
  wageringMultiplier: number,
  houseEdge: number,
  contributionPct: number | null | undefined,
  volatility: SlotVolatility,
  rng: () => number
): { final: number; staked: number } | null {
  const input: CasinoSimInput = {
    bonusAmount: bonus,
    wageringMultiplier,
    houseEdge,
    contributionPct: contributionPct ?? undefined,
    volatility,
  };
  const params = sessionParams(input);
  if (!params) return null;
  return runSession(params, rng);
}

/** One component's simulated £ contribution to a single campaign run. */
function simulateComponentContribution(
  c: CampaignSimComponent,
  volatility: SlotVolatility,
  rng: () => number
): number {
  const houseEdge = houseEdgeOf(c);
  switch (c.componentType) {
    case "cash":
      return c.amount ?? 0;

    case "bonus": {
      const session = cycleSession(
        c.amount ?? 0,
        c.wageringMultiplier ?? 0,
        houseEdge,
        c.contributionPct,
        volatility,
        rng
      );
      return session ? session.final : 0;
    }

    case "qualifying_wager": {
      const amount = c.amount ?? 0;
      const session = cycleSession(amount, 1, houseEdge, undefined, volatility, rng);
      return session ? session.final - amount : 0;
    }

    case "free_spins": {
      const spinWinnings = simulateSpinsSession(
        c.spins ?? 0,
        c.spinValue ?? 0,
        volatility,
        1 - houseEdge,
        rng
      );
      const winningsWagerX = c.wageringMultiplier;
      if (!winningsWagerX || winningsWagerX <= 0 || spinWinnings <= 0) return spinWinnings;
      const session = cycleSession(
        spinWinnings,
        winningsWagerX,
        houseEdge,
        c.contributionPct,
        volatility,
        rng
      );
      return session ? session.final : spinWinnings;
    }

    case "golden_chips": {
      const chipCount = c.chipCount ?? 0;
      const chipValue = c.chipValue ?? 0;
      let total = 0;
      for (let i = 0; i < chipCount; i++) {
        total += simulateGoldenChipReturn(chipValue, houseEdge, rng);
      }
      return total;
    }

    case "cashback": {
      const turnover = c.amount ?? 0;
      const session = cycleSession(turnover, 1, houseEdge, undefined, volatility, rng);
      if (!session) return 0;
      const actualLoss = Math.max(0, turnover - session.final);
      const uncapped = actualLoss * (c.cashbackPct ?? 0);
      const cap = c.cashbackCap;
      return Number.isFinite(cap) && cap != null ? Math.min(uncapped, cap) : uncapped;
    }
  }
}

/** One full campaign run: sums every component's contribution. */
export function simulateCampaignRun(
  components: CampaignSimComponent[],
  volatility: SlotVolatility,
  rng: () => number
): number {
  let total = 0;
  for (const c of components) {
    total += simulateComponentContribution(c, volatility, rng);
  }
  return total;
}

/** Chunked runner - mirrors `simulateFinals`'s shape so the UI can chunk identically. */
export function simulateCampaignFinals(
  components: CampaignSimComponent[],
  volatility: SlotVolatility,
  count: number,
  rng: () => number,
  finals: number[]
): void {
  for (let i = 0; i < count; i++) {
    finals.push(simulateCampaignRun(components, volatility, rng));
  }
}

export interface CampaignSimResult {
  runs: number;
  /** Fraction of runs ending net negative (campaigns can be negative-only, e.g. a qualifying wager with no reward yet - "bust to zero" doesn't apply to a signed sum, so this is distinct from casino-sim.ts's `bustPct`) */
  lossPct: number;
  median: number;
  p10: number;
  p90: number;
  meanEv: number;
  /** The K1 analytic figure (sumCampaignEv) for the same components, for honest side-by-side */
  analyticEv: number;
  histogram: { edges: number[]; counts: number[] };
}

const HISTOGRAM_BUCKETS = 20;

export function summariseCampaignFinals(
  finals: number[],
  analyticEv: number
): CampaignSimResult {
  const n = finals.length;
  const sorted = [...finals].sort((a, b) => a - b);
  const q = (frac: number) => sorted[Math.min(n - 1, Math.floor(frac * (n - 1)))];
  const mean = finals.reduce((a, b) => a + b, 0) / n;
  const losses = finals.reduce((a, b) => a + (b < 0 ? 1 : 0), 0);

  // Buckets span the actual spread (can be negative), sized to the bulk
  // (p1-p99) with overflow clipped into the end buckets.
  const lo = Math.min(q(0.01), 0);
  const hi = Math.max(q(0.99), lo + 1);
  const width = (hi - lo) / HISTOGRAM_BUCKETS;
  const counts = new Array<number>(HISTOGRAM_BUCKETS).fill(0);
  for (const f of finals) {
    const idx = width > 0 ? Math.floor((f - lo) / width) : 0;
    counts[Math.min(HISTOGRAM_BUCKETS - 1, Math.max(0, idx))]++;
  }
  const edges = Array.from({ length: HISTOGRAM_BUCKETS + 1 }, (_, i) => roundPence(lo + i * width));

  return {
    runs: n,
    lossPct: losses / n,
    median: roundPence(q(0.5)),
    p10: roundPence(q(0.1)),
    p90: roundPence(q(0.9)),
    meanEv: roundPence(mean),
    analyticEv: roundPence(analyticEv),
    histogram: { edges, counts },
  };
}
