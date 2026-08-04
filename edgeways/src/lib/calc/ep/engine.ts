/**
 * Early-Payout Edge Desk engine - ported verbatim from EP_EDGE_DESK_BUILD_SPEC v6.
 * Pure functions, no React. Do NOT "optimise" the combinatorics or normalisation
 * without re-running the test vectors in engine.test.ts.
 */

/* ---------------------------------- 4.1 primitives & goal model ---------------------------------- */

export function pois(k: number, lam: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lam) * Math.pow(lam, k)) / f;
}

export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

export function* combos(n: number, k: number, start = 0, cur: number[] = []): Generator<number[]> {
  if (cur.length === k) {
    yield cur;
    return;
  }
  for (let i = start; i <= n - (k - cur.length); i++) {
    cur.push(i);
    yield* combos(n, k, i + 1, cur);
    cur.pop();
  }
}

/** Dixon-Coles low-score correction (fixes 0-0/1-0/0-1/1-1 vs independent Poisson) */
export function tau(i: number, j: number, lh: number, la: number, rho: number): number {
  if (i === 0 && j === 0) return 1 - lh * la * rho;
  if (i === 0 && j === 1) return 1 + lh * rho;
  if (i === 1 && j === 0) return 1 + la * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

export function clampRho(lh: number, la: number, r: number): number {
  const rmax = Math.min(1, lh * la > 0 ? 1 / (lh * la) : 1);
  const rmin = Math.max(-1, -1 / Math.max(lh, la));
  return Math.min(Math.max(r, rmin), rmax);
}

/** Normalised joint scoreline grid g[i][j] = P(home i, away j) */
export function scoreGrid(lh: number, la: number, rho: number, M = 12): number[][] {
  const g: number[][] = [];
  let tot = 0;
  for (let i = 0; i <= M; i++) {
    g[i] = [];
    for (let j = 0; j <= M; j++) {
      let p = pois(i, lh) * pois(j, la) * tau(i, j, lh, la, rho);
      if (p < 0) p = 0;
      g[i][j] = p;
      tot += p;
    }
  }
  for (let i = 0; i <= M; i++) for (let j = 0; j <= M; j++) g[i][j] /= tot;
  return g;
}

export interface Markets {
  H: number;
  D: number;
  A: number;
  OV: number; // P(over 2.5)
  BT: number; // P(both teams score)
}

export function marketsFromGrid(g: number[][]): Markets {
  const M = g.length - 1;
  let H = 0,
    D = 0,
    A = 0,
    OV = 0,
    BT = 0;
  for (let i = 0; i <= M; i++)
    for (let j = 0; j <= M; j++) {
      const p = g[i][j];
      if (i > j) H += p;
      else if (i === j) D += p;
      else A += p;
      if (i + j >= 3) OV += p;
      if (i >= 1 && j >= 1) BT += p;
    }
  return { H, D, A, OV, BT };
}

/* ---------------------------------- 4.2 calibration ---------------------------------- */

export interface FitResult {
  lh: number;
  la: number;
  rho: number;
  err: number;
  useRho: boolean;
}

/**
 * Fits (λ_home, λ_away, ρ) by coarse-then-refine grid search (least squares) to reproduce
 * the true H/D/A plus optional Over 2.5 and BTTS. If neither refinement market is supplied,
 * ρ is pinned to 0 (independent Poisson).
 */
export function fitModel(
  tH: number,
  tD: number,
  tA: number,
  tOV?: number | null,
  tBT?: number | null
): FitResult {
  const useRho = tOV != null || tBT != null;
  const err = (lh: number, la: number, rho: number) => {
    const m = marketsFromGrid(scoreGrid(lh, la, rho, 12));
    let e = (m.H - tH) ** 2 + (m.D - tD) ** 2 + (m.A - tA) ** 2;
    if (tOV != null) e += (m.OV - tOV) ** 2;
    if (tBT != null) e += (m.BT - tBT) ** 2;
    return e;
  };
  let best = 1e9,
    LH = 1,
    LA = 1,
    RHO = 0,
    g = 0.1;
  const rhoSet = useRho ? [-0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18] : [0];
  for (let a = 0.2; a < 3.8; a += g)
    for (let b = 0.1; b < 2.8; b += g)
      for (const r of rhoSet) {
        const rr = clampRho(a, b, r);
        const e = err(a, b, rr);
        if (e < best) {
          best = e;
          LH = a;
          LA = b;
          RHO = rr;
        }
      }
  for (let it = 0; it < 3; it++) {
    g /= 4;
    const bl = LH,
      ba = LA,
      br = RHO;
    const rSteps = useRho ? [-3, -2, -1, 0, 1, 2, 3] : [0];
    for (let a = Math.max(0.05, bl - 4 * g); a <= bl + 4 * g; a += g)
      for (let b = Math.max(0.05, ba - 4 * g); b <= ba + 4 * g; b += g)
        for (const ds of rSteps) {
          const rr = clampRho(a, b, br + ds * g);
          const e = err(a, b, rr);
          if (e < best) {
            best = e;
            LH = a;
            LA = b;
            RHO = rr;
          }
        }
  }
  return { lh: LH, la: LA, rho: RHO, err: best, useRho };
}

/** Proportional overround stripping for a full market of decimal odds. */
export function stripMargin(odds: number[]): { probs: number[]; overround: number } {
  const inv = odds.map((o) => 1 / o);
  const S = inv.reduce((a, b) => a + b, 0);
  return { probs: inv.map((p) => p / S), overround: S - 1 };
}

/* ---------------------------------- 4.3 EP trigger probabilities ---------------------------------- */

export type WeightFn = (nh: number, na: number) => number;

export interface EpProbs {
  pD: number;
  pH1: number;
  pH2: number;
  pA1: number;
  pA2: number;
  pWinH: number;
  pWinA: number;
}

/**
 * For each final score, every goal ordering is equally likely (uniform interleaving -
 * exact for Poisson, assumed under DC). Enumerate orderings, track the running lead's
 * max/min to detect ≥1/≥2-ahead for each side. 2UP = ever-2-ahead OR win FT.
 */
export function epProbsW(wfn: WeightFn, maxg = 11, thresh = 1e-11): EpProbs {
  let pD = 0,
    pH1 = 0,
    pH2 = 0,
    pA1 = 0,
    pA2 = 0,
    pWinH = 0,
    pWinA = 0,
    tot = 0;
  for (let nh = 0; nh <= maxg; nh++)
    for (let na = 0; na <= maxg; na++) {
      const w = wfn(nh, na);
      if (w < thresh) continue;
      const n = nh + na;
      const result = nh > na ? "H" : nh < na ? "A" : "D";
      if (result === "H") pWinH += w;
      else if (result === "A") pWinA += w;
      if (n === 0) {
        pD += w;
        tot += w;
        continue;
      }
      const cnt = comb(n, nh);
      let cH1 = 0,
        cH2 = 0,
        cA1 = 0,
        cA2 = 0;
      for (const hpos of combos(n, nh)) {
        const hset = new Set(hpos);
        let diff = 0,
          mx = 0,
          mn = 0;
        for (let i = 0; i < n; i++) {
          diff += hset.has(i) ? 1 : -1;
          if (diff > mx) mx = diff;
          if (diff < mn) mn = diff;
        }
        if (mx >= 1) cH1++;
        if (mx >= 2) cH2++;
        if (mn <= -1) cA1++;
        if (mn <= -2) cA2++;
      }
      const wp = w / cnt;
      pH1 += wp * cH1;
      pH2 += wp * (cH2 + (result === "H" ? cnt - cH2 : 0)); // 2UP = ever-2-ahead OR win FT
      pA1 += wp * cA1;
      pA2 += wp * (cA2 + (result === "A" ? cnt - cA2 : 0));
      if (result === "D") pD += w;
      tot += w;
    }
  return {
    pD: pD / tot,
    pH1: pH1 / tot,
    pH2: pH2 / tot,
    pA1: pA1 / tot,
    pA2: pA2 / tot,
    pWinH: pWinH / tot,
    pWinA: pWinA / tot,
  };
}

/** One row per distinct trigger-combo - powers the distribution/settlement calcs. */
export interface Scenario {
  result: "H" | "D" | "A";
  He1: boolean;
  He2: boolean;
  Ae1: boolean;
  Ae2: boolean;
  p: number;
}

export function scenariosW(wfn: WeightFn, maxg = 11, thresh = 1e-11): Scenario[] {
  const map = new Map<string, Scenario>();
  let tot = 0;
  const add = (s: Omit<Scenario, "p">, p: number) => {
    const key = `${s.result}|${+s.He1}${+s.He2}${+s.Ae1}${+s.Ae2}`;
    const cur = map.get(key);
    if (cur) cur.p += p;
    else map.set(key, { ...s, p });
  };
  for (let nh = 0; nh <= maxg; nh++)
    for (let na = 0; na <= maxg; na++) {
      const w = wfn(nh, na);
      if (w < thresh) continue;
      const n = nh + na;
      const result: Scenario["result"] = nh > na ? "H" : nh < na ? "A" : "D";
      tot += w;
      if (n === 0) {
        add({ result, He1: false, He2: false, Ae1: false, Ae2: false }, w);
        continue;
      }
      const cnt = comb(n, nh);
      const counts = new Map<string, number>();
      for (const hpos of combos(n, nh)) {
        const hset = new Set(hpos);
        let diff = 0,
          mx = 0,
          mn = 0;
        for (let i = 0; i < n; i++) {
          diff += hset.has(i) ? 1 : -1;
          if (diff > mx) mx = diff;
          if (diff < mn) mn = diff;
        }
        const key = `${+(mx >= 1)}${+(mx >= 2)}${+(mn <= -1)}${+(mn <= -2)}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      for (const [key, c] of counts) {
        add(
          {
            result,
            He1: key[0] === "1",
            He2: key[1] === "1",
            Ae1: key[2] === "1",
            Ae2: key[3] === "1",
          },
          (w * c) / cnt
        );
      }
    }
  const rows = [...map.values()];
  for (const r of rows) r.p /= tot;
  return rows;
}

/* ---------------------------------- 4.4 dutch, staking, rounding ---------------------------------- */

export interface DutchStakes {
  SH: number;
  SA: number;
  SD: number;
}

export type StakeMode = "total" | "home" | "draw" | "away";

/** Equal gross return per leg; fix one leg (or the total), the rest equalise. */
export function equalizedStakes(
  oH: number,
  oA: number,
  oD: number,
  mode: StakeMode,
  amt: number
): DutchStakes {
  const rH = 1 / oH,
    rA = 1 / oA,
    rD = 1 / oD;
  let G: number;
  if (mode === "home") G = amt * oH;
  else if (mode === "away") G = amt * oA;
  else if (mode === "draw") G = amt * oD;
  else G = amt / (rH + rA + rD);
  return { SH: G * rH, SA: G * rA, SD: G * rD };
}

export const roundStake = (x: number, inc: number): number =>
  inc > 0 ? Math.round(x / inc) * inc : x;

export interface DutchLadderRung {
  label: string;
  pl: number;
  p: number;
}

export interface DutchDist {
  EV: number;
  sd: number;
  ladder: DutchLadderRung[];
  worst: number;
  best: number;
  pProfit: number;
  total: number;
}

/**
 * Explicit stakes → EV, sd, payout ladder, worst/best, P(profit).
 * `threshold` = 2 for 2UP, 1 for 1UP. EP leg wins ⟺ ever-N-ahead OR wins FT.
 */
export function dutchDist(
  scen: Scenario[],
  oH: number,
  oA: number,
  oD: number,
  SH: number,
  SA: number,
  SD: number,
  threshold: 1 | 2
): DutchDist {
  return dutchDistMixed(scen, oH, oA, oD, SH, SA, SD, threshold, threshold);
}

/**
 * Mixed-threshold dutch: home and away can use different EP rules
 * (e.g. favourite 2UP + outsider 1UP - common when the dog rarely leads by 2).
 */
export function dutchDistMixed(
  scen: Scenario[],
  oH: number,
  oA: number,
  oD: number,
  SH: number,
  SA: number,
  SD: number,
  homeThreshold: 1 | 2,
  awayThreshold: 1 | 2
): DutchDist {
  const total = SH + SA + SD;
  let EV = 0,
    E2 = 0,
    pProfit = 0,
    worst = Infinity,
    best = -Infinity;
  const buckets = new Map<string, DutchLadderRung>();
  for (const s of scen) {
    const homeWin =
      (homeThreshold === 2 ? s.He2 : s.He1) || s.result === "H";
    const awayWin =
      (awayThreshold === 2 ? s.Ae2 : s.Ae1) || s.result === "A";
    const ret =
      (homeWin ? SH * oH : 0) + (awayWin ? SA * oA : 0) + (s.result === "D" ? SD * oD : 0);
    const pl = ret - total;
    EV += s.p * pl;
    E2 += s.p * pl * pl;
    if (pl > 1e-9) pProfit += s.p;
    if (pl < worst) worst = pl;
    if (pl > best) best = pl;
    const legs = [
      homeWin ? `H${homeThreshold}UP` : null,
      awayWin ? `A${awayThreshold}UP` : null,
      s.result === "D" ? "Draw" : null,
    ].filter(Boolean);
    const label = legs.length === 0 ? "All legs lose" : legs.join(" + ");
    const key = `${label}|${pl.toFixed(2)}`;
    const cur = buckets.get(key);
    if (cur) cur.p += s.p;
    else buckets.set(key, { label, pl, p: s.p });
  }
  const ladder = [...buckets.values()].sort((a, b) => b.pl - a.pl);
  const varr = Math.max(E2 - EV * EV, 0);
  return { EV, sd: Math.sqrt(varr), ladder, worst, best, pProfit, total };
}

/* ---------------------------------- 4.5 lay play ---------------------------------- */

export interface LayPlayResult {
  L: number;
  RW: number;
  RG: number;
  RN: number;
  pW: number;
  pG: number;
  pN: number;
  EV: number;
  evPer1: number;
  sd: number;
  liability: number;
  b: number;
  B: number;
}

/**
 * Back-EP + lay-exchange. Three regions: W team wins (hedged flat), G led-by-threshold
 * then failed to win (BOTH back and lay win - the bonus), N never led (hedged flat).
 * `tW` must be the MODEL win prob (pWinH/pWinA), not the margin-stripped input.
 */
export function layPlay(
  b: number,
  B: number,
  X: number,
  c: number,
  pEP: number,
  tW: number
): LayPlayResult {
  const L = (b * B) / (X - c);
  const RW = b * (B - 1) - L * (X - 1); // team wins
  const RG = b * (B - 1) + L * (1 - c); // led, didn't win → BOTH win
  const RN = -b + L * (1 - c); // never led, didn't win
  const pW = tW,
    pG = Math.max(pEP - tW, 0),
    pN = Math.max(1 - pEP, 0);
  const EV = pW * RW + pG * RG + pN * RN;
  const evPer1 = (B * (1 - c)) / (X - c) - 1 + B * (pEP - tW); // closed form == EV/b
  const varr = pW * (RW - EV) ** 2 + pG * (RG - EV) ** 2 + pN * (RN - EV) ** 2;
  return {
    L,
    RW,
    RG,
    RN,
    pW,
    pG,
    pN,
    EV,
    evPer1,
    sd: Math.sqrt(Math.max(varr, 0)),
    liability: L * (X - 1),
    b,
    B,
  };
}

/* ---------------------------------- 4.6 EP-bonus decomposition ---------------------------------- */

export interface EpDecomposition {
  straight: number; // o·tW − 1 (negative - short odds)
  bonus: number; // o·(pEP − tW) (positive - early-payout value)
  total: number; // o·pEP − 1 = straight + bonus
  G: number; // pEP − tW: "led-then-didn't-win" probability
  fair: number; // 1/pEP
}

export function epDecompose(o: number, pEP: number, tW: number): EpDecomposition {
  return {
    straight: o * tW - 1,
    bonus: o * (pEP - tW),
    total: o * pEP - 1,
    G: pEP - tW,
    fair: 1 / pEP,
  };
}

/* ---------------------------------- 7.4 live settlement ---------------------------------- */

export interface LiveTriggers {
  eH1: boolean;
  eH2: boolean;
  eA1: boolean;
  eA2: boolean;
}

/** Effective flags: auto-lock when the lead forces it; enforce 2UP ⟹ 1UP. */
export function effectiveTriggers(
  hg: number,
  ag: number,
  mH1: boolean,
  mH2: boolean,
  mA1: boolean,
  mA2: boolean
): LiveTriggers {
  const lead = hg - ag;
  const eH2 = lead >= 2 || mH2;
  const eH1 = lead >= 1 || mH1 || eH2;
  const eA2 = -lead >= 2 || mA2;
  const eA1 = -lead >= 1 || mA1 || eA2;
  return { eH1, eH2, eA1, eA2 };
}

export function liveResult(hg: number, ag: number): "H" | "D" | "A" {
  return hg > ag ? "H" : hg < ag ? "A" : "D";
}

/** Dutch P&L at the current score + triggers, using the computed stakes. */
export function dutchPL(
  stakes: DutchStakes,
  oH: number,
  oA: number,
  oD: number,
  result: "H" | "D" | "A",
  epH: boolean,
  epA: boolean
): number {
  const total = stakes.SH + stakes.SA + stakes.SD;
  return (
    (epH || result === "H" ? stakes.SH * oH : 0) +
    (epA || result === "A" ? stakes.SA * oA : 0) +
    (result === "D" ? stakes.SD * oD : 0) -
    total
  );
}

/** Lay-side P&L: back leg settles on EP-or-win; lay leg settles on the real result. */
export function laySidePL(
  r: LayPlayResult,
  side: "H" | "A",
  result: "H" | "D" | "A",
  epWin: boolean,
  X: number,
  c: number
): number {
  return (
    (epWin || result === side ? r.b * (r.B - 1) : -r.b) +
    (result !== side ? r.L * (1 - c) : -r.L * (X - 1))
  );
}
