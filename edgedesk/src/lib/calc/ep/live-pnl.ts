/**
 * Live in-play expected P&L — Dixon-Coles remaining-goals model for EP / 2UP positions.
 */
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { DutchLegRecord, MatchResult, SettleableBet } from "@/lib/calc/settlement";
import { provisionalProfit, settleFromOutcome } from "@/lib/calc/settlement";
import {
  comb,
  combos,
  dutchDist,
  fitModel,
  liveResult,
  scoreGrid,
  scenariosW,
  type Scenario,
} from "@/lib/calc/ep/engine";

function rowToSettleable(bet: BetRow): SettleableBet {
  return {
    market: bet.market as SettleableBet["market"],
    selection: bet.selection,
    betType: bet.betType as SettleableBet["betType"],
    backStake: bet.backStake,
    backOdds: bet.backOdds,
    layStake: bet.layStake,
    layOdds: bet.layOdds,
    commission: bet.commission,
    earlyPayout: !!bet.earlyPayout,
    refundAmount: bet.refundAmount ?? undefined,
    refundRetention: bet.refundRetention ?? undefined,
    legs: bet.legs ? (JSON.parse(bet.legs) as DutchLegRecord[]) : undefined,
  };
}

function rowToMatchResult(event: EventRow): MatchResult {
  return {
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    homeLed2: !!event.homeLed2,
    awayLed2: !!event.awayLed2,
    inPlay: event.status === "live",
  };
}

export type LiveValuationMode = "model" | "snapshot";

export interface LiveValuation {
  value: number;
  mode: LiveValuationMode;
}

function remainingTimeFactor(minute: number): number {
  return Math.max(0.08, (90 - Math.min(Math.max(minute, 0), 90)) / 90);
}

function inferMatchProbs(bet: SettleableBet): { tH: number; tD: number; tA: number } | null {
  if (bet.legs?.length) {
    const bySel = (sel: string) => bet.legs!.find((l) => l.selection === sel);
    const home = bySel("home");
    const away = bySel("away");
    const draw = bySel("draw");
    if (home && away && draw && home.odds > 1 && away.odds > 1 && draw.odds > 1) {
      const tH = 1 / home.odds;
      const tA = 1 / away.odds;
      const tD = 1 / draw.odds;
      const sum = tH + tD + tA;
      return { tH: tH / sum, tD: tD / sum, tA: tA / sum };
    }
  }

  if (bet.market === "match_odds" || bet.earlyPayout || bet.market === "two_up") {
    const sel = bet.selection;
    const tBack = bet.backOdds > 1 ? 1 / bet.backOdds : null;
    if (!tBack) return null;
    if (sel === "home") {
      const tA = bet.layOdds > 1 ? Math.min(0.45, 1 / bet.layOdds) : 0.28;
      const tD = Math.max(0.12, 0.95 - tBack - tA);
      return { tH: tBack, tD, tA: Math.max(0.08, 1 - tBack - tD) };
    }
    if (sel === "away") {
      const tH = bet.layOdds > 1 ? Math.min(0.45, 1 / bet.layOdds) : 0.35;
      const tD = Math.max(0.12, 0.95 - tBack - tH);
      return { tA: tBack, tD, tH: Math.max(0.08, 1 - tBack - tD) };
    }
  }

  return null;
}

function hasEarlyPayoutExposure(bet: SettleableBet): boolean {
  if (bet.earlyPayout || bet.market === "two_up") return true;
  return !!bet.legs?.some((l) => l.earlyPayout);
}

/** Remaining-goals scenarios with final-score EP flags. */
function liveScenarios(
  wfn: (fh: number, fa: number) => number,
  hg: number,
  ag: number,
  homeLed2: boolean,
  awayLed2: boolean,
  threshold: 1 | 2,
  maxg = 9
): Scenario[] {
  const map = new Map<string, Scenario & { p: number }>();
  let tot = 0;

  const add = (result: "H" | "D" | "A", epH: boolean, epA: boolean, p: number) => {
    const key = `${result}|${+epH}${+epH}${+epA}${+epA}`;
    const cur = map.get(key);
    if (cur) cur.p += p;
    else map.set(key, { result, He1: epH, He2: epH, Ae1: epA, Ae2: epA, p });
  };

  for (let fh = 0; fh <= maxg; fh++) {
    for (let fa = 0; fa <= maxg; fa++) {
      const w = wfn(fh, fa);
      if (w < 1e-11) continue;
      const n = fh + fa;
      const finalResult = liveResult(hg + fh, ag + fa);
      tot += w;

      if (n === 0) {
        const epH = homeLed2 || (threshold === 2 ? false : false) || finalResult === "H";
        const epA = awayLed2 || finalResult === "A";
        add(finalResult, homeLed2 || epH, awayLed2 || epA, w);
        continue;
      }

      const cnt = comb(n, fh);
      const startDiff = hg - ag;
      const counts = new Map<string, number>();

      for (const hpos of combos(n, fh)) {
        const hset = new Set(hpos);
        let diff = startDiff;
        let mx = Math.max(startDiff, 0);
        let mn = Math.min(startDiff, 0);
        for (let i = 0; i < n; i++) {
          diff += hset.has(i) ? 1 : -1;
          if (diff > mx) mx = diff;
          if (diff < mn) mn = diff;
        }
        const remH2 = mx >= 2;
        const remH1 = mx >= 1;
        const remA2 = -mn >= 2;
        const remA1 = -mn >= 1;
        const key = `${+(remH1)}${+(remH2)}${+(remA1)}${+(remA2)}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      for (const [key, c] of counts) {
        const remH1 = key[0] === "1";
        const remH2 = key[1] === "1";
        const remA1 = key[2] === "1";
        const remA2 = key[3] === "1";
        const epH =
          homeLed2 || (threshold === 2 ? remH2 : remH1) || finalResult === "H";
        const epA =
          awayLed2 || (threshold === 2 ? remA2 : remA1) || finalResult === "A";
        add(finalResult, epH, epA, (w * c) / cnt);
      }
    }
  }

  const rows = [...map.values()];
  for (const r of rows) r.p /= tot || 1;
  return rows;
}

function plFromScenario(
  bet: SettleableBet,
  result: "H" | "D" | "A",
  epH: boolean,
  epA: boolean
): number {
  if (bet.betType === "dutch" && bet.legs?.length) {
    let totalStake = 0;
    let ret = 0;
    for (const leg of bet.legs) {
      totalStake += leg.stake;
      const sel = leg.selection;
      const ep =
        leg.earlyPayout &&
        ((sel === "home" && epH) || (sel === "away" && epA));
      const ftWin =
        (sel === "home" && result === "H") ||
        (sel === "away" && result === "A") ||
        (sel === "draw" && result === "D");
      if (ep || ftWin) ret += leg.stake * leg.odds;
    }
    return ret - totalStake;
  }

  const side = bet.selection;
  const paid =
    (side === "home" && epH) ||
    (side === "away" && epA) ||
    (side === "draw" && result === "D") ||
    (side === "home" && result === "H" && !bet.earlyPayout) ||
    (side === "away" && result === "A" && !bet.earlyPayout);

  const ftWin = side === "home" ? result === "H" : side === "away" ? result === "A" : result === "D";
  const early =
    bet.earlyPayout &&
    ((side === "home" && epH && result !== "H") || (side === "away" && epA && result !== "A"));

  return settleFromOutcome(bet, ftWin, paid, early).profit;
}

function modelEv(
  bet: SettleableBet,
  event: EventRow,
  scen: Scenario[]
): number | null {
  let ev = 0;
  for (const s of scen) {
    const epH = s.He2 || s.result === "H";
    const epA = s.Ae2 || s.result === "A";
    ev += s.p * plFromScenario(bet, s.result, epH, epA);
  }
  return Number.isFinite(ev) ? ev : null;
}

function dutchLegOdds(bet: SettleableBet): {
  oH: number;
  oA: number;
  oD: number;
  SH: number;
  SA: number;
  SD: number;
  threshold: 1 | 2;
} | null {
  if (!bet.legs?.length) return null;
  const home = bet.legs.find((l) => l.selection === "home");
  const away = bet.legs.find((l) => l.selection === "away");
  const draw = bet.legs.find((l) => l.selection === "draw");
  if (!home || !away || !draw) return null;
  const threshold: 1 | 2 = bet.legs.some((l) => l.earlyPayout) ? 2 : 2;
  return {
    oH: home.odds,
    oA: away.odds,
    oD: draw.odds,
    SH: home.stake,
    SA: away.stake,
    SD: draw.stake,
    threshold,
  };
}

/** Model-weighted live EV for EP / 2UP football positions; null → use snapshot provisional. */
export function liveProbabilisticProfit(bet: BetRow, event: EventRow): number | null {
  if (event.sport !== "football" || event.status !== "live") return null;

  const settleable = rowToSettleable(bet);
  if (!hasEarlyPayoutExposure(settleable)) return null;

  const probs = inferMatchProbs(settleable);
  if (!probs) return null;

  const factor = remainingTimeFactor(event.minute);
  const fit = fitModel(probs.tH, probs.tD, probs.tA);
  const grid = scoreGrid(fit.lh * factor, fit.la * factor, fit.rho, 12);
  const wfn = (fh: number, fa: number) => grid[fh]?.[fa] ?? 0;

  const hg = event.homeScore;
  const ag = event.awayScore;
  const homeLed2 = !!event.homeLed2;
  const awayLed2 = !!event.awayLed2;

  const dutch = dutchLegOdds(settleable);
  if (dutch) {
    const scen = liveScenarios(wfn, hg, ag, homeLed2, awayLed2, dutch.threshold);
    const dist = dutchDist(
      scen,
      dutch.oH,
      dutch.oA,
      dutch.oD,
      dutch.SH,
      dutch.SA,
      dutch.SD,
      dutch.threshold
    );
    return dist.EV;
  }

  if (settleable.layStake > 0 && settleable.backStake > 0) {
    const threshold: 1 | 2 = settleable.earlyPayout || settleable.market === "two_up" ? 2 : 2;
    const scen = liveScenarios(wfn, hg, ag, homeLed2, awayLed2, threshold);
    return modelEv(settleable, event, scen);
  }

  return null;
}

/** Best live valuation: model EV when available, else score snapshot. */
export function livePositionValuation(bet: BetRow, event: EventRow): LiveValuation {
  const snapshot =
    provisionalProfit(rowToSettleable(bet), rowToMatchResult(event)) ?? 0;
  const model = liveProbabilisticProfit(bet, event);
  if (model != null && hasEarlyPayoutExposure(rowToSettleable(bet))) {
    return { value: model, mode: "model" };
  }
  return { value: snapshot, mode: "snapshot" };
}

/** Pre-match EV from full-match scenarios (for comparison). */
export function preMatchDutchEv(legs: DutchLegRecord[]): number | null {
  const home = legs.find((l) => l.selection === "home");
  const away = legs.find((l) => l.selection === "away");
  const draw = legs.find((l) => l.selection === "draw");
  if (!home || !away || !draw) return null;
  const tH = 1 / home.odds;
  const tA = 1 / away.odds;
  const tD = 1 / draw.odds;
  const sum = tH + tD + tA;
  const fit = fitModel(tH / sum, tD / sum, tA / sum);
  const grid = scoreGrid(fit.lh, fit.la, fit.rho, 12);
  const wfn = (nh: number, na: number) => grid[nh]?.[na] ?? 0;
  const scen = scenariosW(wfn);
  const threshold: 1 | 2 = legs.some((l) => l.earlyPayout) ? 2 : 2;
  return dutchDist(
    scen,
    home.odds,
    away.odds,
    draw.odds,
    home.stake,
    away.stake,
    draw.stake,
    threshold
  ).EV;
}
