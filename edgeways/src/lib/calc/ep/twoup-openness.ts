/**
 * Pre-match 2UP fit from the goal environment. Not a bookie +EV.
 * Consumes the spec-locked Dixon-Coles helpers; does not edit engine.ts.
 */

import { epDecompose, epProbsW, fitModel, scoreGrid, stripMargin } from "./engine";

export const TWOUP_OPENNESS_TIERS = ["strong", "ok", "thin", "skip", "unknown"] as const;
export type TwoupOpennessTier = (typeof TWOUP_OPENNESS_TIERS)[number];

export const TWOUP_TIER_LABEL: Record<TwoupOpennessTier, string> = {
  strong: "Strong 2UP take",
  ok: "Fair 2UP take",
  thin: "Weak 2UP take",
  skip: "Skip this for 2UP",
  unknown: "No exchange prices yet",
};

/** Short word for match-events tab chrome. */
export const TWOUP_TIER_SHORT: Record<TwoupOpennessTier, string | null> = {
  strong: "Strong",
  ok: "Fair",
  thin: "Weak",
  skip: "Skip",
  unknown: null,
};

export interface TwoupOpennessInput {
  over25Back?: number;
  bttsYesBack?: number;
  homeBack?: number;
  drawBack?: number;
  awayBack?: number;
  /** Skip Dixon-Coles (tests / already-computed G). */
  computeWindfall?: boolean;
  windfallHome?: number;
  windfallAway?: number;
  homeGf?: number;
  homeGa?: number;
  awayGf?: number;
  awayGa?: number;
  leagueAvgGf?: number;
  leagueAvgGa?: number;
  modelXg?: number;
  twoUpHome?: number;
  twoUpAway?: number;
  winHome?: number;
  winAway?: number;
}

export type TwoupPickSide = "home" | "away";

export interface TwoupOpennessMarkets {
  over25?: number;
  btts?: number;
  home?: number;
  away?: number;
  fav?: number;
}

export interface TwoupVenueRates {
  homeGf: number;
  homeGa: number;
  awayGf: number;
  awayGa: number;
}

export interface TwoupOpennessResult {
  tier: TwoupOpennessTier;
  score01: number;
  /** Max of the two sides, for the list meter. */
  windfallPct?: number;
  windfallHomePct?: number;
  windfallAwayPct?: number;
  pick?: TwoupPickSide;
  reasons: string[];
  markets: TwoupOpennessMarkets;
  venue?: TwoupVenueRates;
  modelXg?: number;
  /** P(2UP pays): ever two ahead or win. */
  twoUpHomePct?: number;
  twoUpAwayPct?: number;
  winHomePct?: number;
  winAwayPct?: number;
}

export function twoupScoutKey(input: {
  homeTeam: string;
  awayTeam: string;
  startTime: number;
}): string {
  return `${input.homeTeam.trim().toLowerCase()}\t${input.awayTeam.trim().toLowerCase()}\t${input.startTime}`;
}

function finiteOdds(value: number | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 1 ? value : null;
}

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
  return y0 + (y1 - y0) * t;
}

function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

function over25Score(odds: number): number {
  if (odds <= 1.4) return 1;
  if (odds <= 1.5) return lerp(odds, 1.4, 1.5, 1, 0.75);
  if (odds <= 1.8) return lerp(odds, 1.5, 1.8, 0.75, 0);
  return 0;
}

function bttsScore(odds: number): number {
  if (odds <= 1.45) return 1;
  if (odds <= 1.55) return lerp(odds, 1.45, 1.55, 1, 0.75);
  if (odds <= 1.8) return lerp(odds, 1.55, 1.8, 0.75, 0);
  return 0;
}

function favouritePrice(home: number | null, away: number | null): number | null {
  if (home != null && away != null) return Math.min(home, away);
  return home ?? away;
}

function favScore(odds: number): number {
  if (odds >= 1.7 && odds <= 2.3) return 1;
  if (odds >= 1.5 && odds < 1.7) return lerp(odds, 1.5, 1.7, 0.4, 1);
  if (odds > 2.3 && odds <= 2.6) return lerp(odds, 2.3, 2.6, 1, 0.4);
  return 0;
}

/** Display band for match-shape prices. Same cutoffs as the scout score. */
export type TwoupShapeRead = "open" | "mixed" | "closed";

export function twoupOver25Read(odds: number): TwoupShapeRead {
  if (odds > 1.8) return "closed";
  if (odds <= 1.5) return "open";
  return "mixed";
}

export function twoupBttsRead(odds: number): TwoupShapeRead {
  if (odds > 1.8) return "closed";
  if (odds <= 1.55) return "open";
  return "mixed";
}

export function twoupFavRead(odds: number): TwoupShapeRead {
  if (odds < 1.5 || odds > 2.6) return "closed";
  if (odds >= 1.7 && odds <= 2.3) return "open";
  return "mixed";
}

function standingsScore(input: TwoupOpennessInput): number | null {
  const { homeGf, homeGa, awayGf, awayGa, leagueAvgGf, leagueAvgGa } = input;
  if (
    homeGf == null ||
    homeGa == null ||
    awayGf == null ||
    awayGa == null ||
    leagueAvgGf == null ||
    leagueAvgGa == null
  ) {
    return null;
  }
  if (
    ![homeGf, homeGa, awayGf, awayGa, leagueAvgGf, leagueAvgGa].every(
      (n) => Number.isFinite(n) && n >= 0
    )
  ) {
    return null;
  }
  const homeOpen = homeGf >= leagueAvgGf && homeGa >= leagueAvgGa;
  const awayOpen = awayGf >= leagueAvgGf && awayGa >= leagueAvgGa;
  const sterile =
    homeGf < leagueAvgGf * 0.75 || awayGf < leagueAvgGf * 0.75;
  const wall = homeGa < leagueAvgGa * 0.75 || awayGa < leagueAvgGa * 0.75;
  if (homeOpen && awayOpen) return 1;
  if (sterile || wall) return 0.2;
  return 0.5;
}

function weightedMean(parts: Array<{ weight: number; value: number }>): number {
  let w = 0;
  let s = 0;
  for (const part of parts) {
    w += part.weight;
    s += part.weight * part.value;
  }
  return w === 0 ? 0 : s / w;
}

function tierFromScore(score01: number, hardSkip: boolean): TwoupOpennessTier {
  if (hardSkip) return "skip";
  if (score01 >= 0.72) return "strong";
  if (score01 >= 0.48) return "ok";
  return "thin";
}

export function twoupWindfallFromOdds(input: {
  homeBack?: number;
  drawBack?: number;
  awayBack?: number;
  over25Back?: number;
  bttsYesBack?: number;
}): {
  home: number;
  away: number;
  lh: number;
  la: number;
  pH2: number;
  pA2: number;
  pWinH: number;
  pWinA: number;
} | null {
  const home = finiteOdds(input.homeBack);
  const draw = finiteOdds(input.drawBack);
  const away = finiteOdds(input.awayBack);
  if (home == null || draw == null || away == null) return null;
  const { probs } = stripMargin([home, draw, away]);
  const over = finiteOdds(input.over25Back);
  const btts = finiteOdds(input.bttsYesBack);
  const fit = fitModel(
    probs[0]!,
    probs[1]!,
    probs[2]!,
    over != null ? 1 / over : null,
    btts != null ? 1 / btts : null
  );
  const grid = scoreGrid(fit.lh, fit.la, fit.rho);
  const ep = epProbsW((nh, na) => grid[nh]?.[na] ?? 0);
  return {
    home: epDecompose(home, ep.pH2, ep.pWinH).G,
    away: epDecompose(away, ep.pA2, ep.pWinA).G,
    lh: fit.lh,
    la: fit.la,
    pH2: ep.pH2,
    pA2: ep.pA2,
    pWinH: ep.pWinH,
    pWinA: ep.pWinA,
  };
}

function pctFromMass(g: number | undefined): number | undefined {
  return g != null && Number.isFinite(g) && g > 0 ? Math.round(g * 100) : undefined;
}

/** Display band for one side's windfall % (go two ahead, then fail to win). */
export function twoupSideTierFromPct(pct: number | undefined): TwoupOpennessTier {
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return "unknown";
  if (pct < 2) return "skip";
  if (pct < 3) return "thin";
  if (pct < 4) return "ok";
  return "strong";
}

/** Fair or Strong take: the 2UP Edge pick bar. */
export function twoupIsEdgePick(tier: TwoupOpennessTier): boolean {
  return tier === "ok" || tier === "strong";
}

export function twoupTakeWindfallPct(
  result?: TwoupOpennessResult | null
): number | undefined {
  if (result?.pick === "home") return result.windfallHomePct;
  if (result?.pick === "away") return result.windfallAwayPct;
  return undefined;
}

export function twoupHasEdgePick(result?: TwoupOpennessResult | null): boolean {
  return twoupIsEdgePick(twoupSideTierFromPct(twoupTakeWindfallPct(result)));
}

function attachWindfall(
  input: TwoupOpennessInput,
  home: number | null,
  away: number | null
): Pick<
  TwoupOpennessResult,
  | "windfallPct"
  | "windfallHomePct"
  | "windfallAwayPct"
  | "pick"
  | "modelXg"
  | "twoUpHomePct"
  | "twoUpAwayPct"
  | "winHomePct"
  | "winAwayPct"
> {
  const windfall = computeWindfallG(input);
  const windfallHomePct = pctFromMass(windfall?.home);
  const windfallAwayPct = pctFromMass(windfall?.away);
  const twoUpHomePct = pctFromMass(windfall?.pH2);
  const twoUpAwayPct = pctFromMass(windfall?.pA2);
  const winHomePct = pctFromMass(windfall?.pWinH);
  const winAwayPct = pctFromMass(windfall?.pWinA);
  const windfallPct =
    windfallHomePct != null || windfallAwayPct != null
      ? Math.max(windfallHomePct ?? 0, windfallAwayPct ?? 0)
      : undefined;
  const fittedXg =
    windfall?.lh != null && windfall.la != null ? windfall.lh + windfall.la : undefined;
  const modelXg =
    input.modelXg != null && Number.isFinite(input.modelXg) && input.modelXg > 0
      ? input.modelXg
      : fittedXg;
  return {
    windfallPct,
    windfallHomePct,
    windfallAwayPct,
    pick: twoupPickSide(windfall, home, away),
    modelXg,
    twoUpHomePct,
    twoUpAwayPct,
    winHomePct,
    winAwayPct,
  };
}

export function twoupFailIn(twoUpPct: number, ftaPct: number): number | null {
  if (!Number.isFinite(twoUpPct) || !Number.isFinite(ftaPct)) return null;
  if (twoUpPct <= 0 || ftaPct <= 0) return null;
  return Math.max(2, Math.round(twoUpPct / ftaPct));
}

export interface TwoupLeanStory {
  takeTeam: string;
  otherTeam: string;
  takeFtaPct: number;
  otherFtaPct: number;
  takeTwoUpPct?: number;
  otherTwoUpPct?: number;
  takeFailIn?: number;
  otherFailIn?: number;
  takeLine: string;
  windfallLine: string;
  contrastLine: string;
}

export function twoupLeanStory(input: {
  homeTeam: string;
  awayTeam: string;
  pick?: TwoupPickSide;
  ftaHomePct?: number;
  ftaAwayPct?: number;
  twoUpHomePct?: number;
  twoUpAwayPct?: number;
}): TwoupLeanStory | null {
  if (input.pick !== "home" && input.pick !== "away") return null;
  const takeTeam = input.pick === "home" ? input.homeTeam : input.awayTeam;
  const otherTeam = input.pick === "home" ? input.awayTeam : input.homeTeam;
  const takeFtaPct = input.pick === "home" ? input.ftaHomePct : input.ftaAwayPct;
  const otherFtaPct = input.pick === "home" ? input.ftaAwayPct : input.ftaHomePct;
  const takeTwoUpPct = input.pick === "home" ? input.twoUpHomePct : input.twoUpAwayPct;
  const otherTwoUpPct = input.pick === "home" ? input.twoUpAwayPct : input.twoUpHomePct;
  if (takeFtaPct == null || otherFtaPct == null) return null;
  const takeFailIn =
    takeTwoUpPct != null ? twoupFailIn(takeTwoUpPct, takeFtaPct) ?? undefined : undefined;
  const otherFailIn =
    otherTwoUpPct != null ? twoupFailIn(otherTwoUpPct, otherFtaPct) ?? undefined : undefined;

  const windfallLine = `In about ${takeFtaPct} matches in 100, ${takeTeam} go two ahead and then fail to win. The bookie pays you as a winner and the exchange lay still wins. That is the only 2UP outcome that pays both sides.`;

  let contrastLine = `${otherTeam} have the smaller windfall: ${otherFtaPct} matches in 100.`;
  if (
    takeTwoUpPct != null &&
    otherTwoUpPct != null &&
    takeTwoUpPct < otherTwoUpPct &&
    takeFailIn != null &&
    otherFailIn != null
  ) {
    contrastLine = `${otherTeam} go two ahead far more often (${otherTwoUpPct} matches in 100 vs ${takeTwoUpPct}), but they almost always win from there, so the lay loses. Their windfall is only ${otherFtaPct} in 100. Once two ahead, ${takeTeam} fail to win about 1 time in ${takeFailIn}. ${otherTeam} fail about 1 time in ${otherFailIn}.`;
  } else if (
    takeTwoUpPct != null &&
    otherTwoUpPct != null &&
    takeTwoUpPct > otherTwoUpPct
  ) {
    contrastLine = `${takeTeam} also go two ahead more often (${takeTwoUpPct} matches in 100 vs ${otherTwoUpPct}). ${otherTeam} windfall is ${otherFtaPct} in 100.`;
  }

  return {
    takeTeam,
    otherTeam,
    takeFtaPct,
    otherFtaPct,
    takeTwoUpPct,
    otherTwoUpPct,
    takeFailIn,
    otherFailIn,
    takeLine: `Take 2UP on ${takeTeam}`,
    windfallLine,
    contrastLine,
  };
}

export function twoupPickSide(
  windfall: { home: number; away: number } | null,
  home: number | null,
  away: number | null
): TwoupPickSide | undefined {
  if (windfall) {
    if (windfall.home > windfall.away) return "home";
    if (windfall.away > windfall.home) return "away";
  }
  if (home != null && away != null) return home <= away ? "home" : "away";
  return undefined;
}

function computeWindfallG(input: TwoupOpennessInput): {
  home: number;
  away: number;
  lh?: number;
  la?: number;
  pH2?: number;
  pA2?: number;
  pWinH?: number;
  pWinA?: number;
} | null {
  if (input.windfallHome != null && input.windfallAway != null) {
    return {
      home: input.windfallHome,
      away: input.windfallAway,
      pH2: input.twoUpHome,
      pA2: input.twoUpAway,
      pWinH: input.winHome,
      pWinA: input.winAway,
    };
  }
  if (input.computeWindfall === false) return null;
  return twoupWindfallFromOdds(input);
}

export function twoupOpenness(input: TwoupOpennessInput): TwoupOpennessResult {
  const over = finiteOdds(input.over25Back);
  const btts = finiteOdds(input.bttsYesBack);
  const home = finiteOdds(input.homeBack);
  const away = finiteOdds(input.awayBack);
  const fav = favouritePrice(home, away);
  const markets: TwoupOpennessMarkets = {};
  if (over != null) markets.over25 = over;
  if (btts != null) markets.btts = btts;
  if (home != null) markets.home = home;
  if (away != null) markets.away = away;
  if (fav != null) markets.fav = fav;

  const venue =
    input.homeGf != null &&
    input.homeGa != null &&
    input.awayGf != null &&
    input.awayGa != null
      ? {
          homeGf: input.homeGf,
          homeGa: input.homeGa,
          awayGf: input.awayGf,
          awayGa: input.awayGa,
        }
      : undefined;

  if (over == null && btts == null) {
    return {
      tier: "unknown",
      score01: 0,
      reasons: [],
      markets,
      venue,
      ...attachWindfall(input, home, away),
    };
  }

  const standings = standingsScore(input);

  const reasons: string[] = [];
  if (over != null) reasons.push(`O2.5 ${formatOdds(over)}`);
  if (btts != null) reasons.push(`BTTS ${formatOdds(btts)}`);
  if (fav != null) reasons.push(`fav ${formatOdds(fav)}`);

  const hardSkip =
    (over != null && over > 1.8) ||
    (btts != null && btts > 1.8) ||
    (fav != null && (fav < 1.5 || fav > 2.6));

  if (over != null && over > 1.8) reasons.push("low scoring");
  if (btts != null && btts > 1.8) reasons.push("BTTS long");
  if (fav != null && fav < 1.5) reasons.push("blowout favourite");
  if (fav != null && fav > 2.6) reasons.push("favourite too long");
  if (standings === 1) reasons.push("both score and concede");
  if (standings === 0.2) reasons.push("one side sterile or tight");

  const parts: Array<{ weight: number; value: number }> = [];
  if (over != null) parts.push({ weight: 0.36, value: over25Score(over) });
  if (btts != null) parts.push({ weight: 0.36, value: bttsScore(btts) });
  if (fav != null) parts.push({ weight: 0.18, value: favScore(fav) });
  if (standings != null) parts.push({ weight: 0.1, value: standings });

  let score01 = weightedMean(parts);
  if (hardSkip) score01 = Math.min(score01, 0.18);

  const sides = attachWindfall(input, home, away);
  if (sides.pick === "home") reasons.push("lean home");
  if (sides.pick === "away") reasons.push("lean away");

  return {
    tier: tierFromScore(score01, hardSkip),
    score01: Math.min(1, Math.max(0, score01)),
    reasons,
    markets,
    venue,
    ...sides,
  };
}
