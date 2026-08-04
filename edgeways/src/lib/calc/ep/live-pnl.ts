/**
 * Live in-play expected P&L - Dixon-Coles remaining-goals model for EP / 2UP positions.
 */
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { DutchLegRecord, MatchResult, SettleableBet } from "@/lib/calc/settlement";
import { provisionalProfit, settleFromOutcome } from "@/lib/calc/settlement";
import {
  comb,
  combos,
  dutchDist,
  dutchDistMixed,
  liveResult,
  scenariosW,
  type Scenario,
} from "@/lib/calc/ep/engine";
import {
  inferPreMatchProbs,
  liveMatchStateModel,
  remainingGoalsGrid,
  type PreMatchProbs,
} from "@/lib/calc/ep/live-model";

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

function hasEarlyPayoutExposure(bet: SettleableBet): boolean {
  if (bet.earlyPayout || bet.market === "two_up") return true;
  return !!bet.legs?.some((l) => l.earlyPayout);
}

/** Infer EP threshold from leg notes/label when present; default 2UP. */
function legThreshold(leg: DutchLegRecord): 1 | 2 {
  const blob = `${leg.label ?? ""} ${leg.market ?? ""}`.toLowerCase();
  if (/\b1\s*up\b|\b1up\b/.test(blob)) return 1;
  if (/\b2\s*up\b|\b2up\b/.test(blob)) return 2;
  // earlyPayout without label → assume classic 2UP
  return leg.earlyPayout ? 2 : 2;
}

/** Remaining-goals scenarios with final-score EP flags. */
function liveScenarios(
  wfn: (fh: number, fa: number) => number,
  hg: number,
  ag: number,
  homeLed2: boolean,
  awayLed2: boolean,
  maxg = 9
): Scenario[] {
  const map = new Map<string, Scenario & { p: number }>();
  let tot = 0;

  const add = (
    result: "H" | "D" | "A",
    He1: boolean,
    He2: boolean,
    Ae1: boolean,
    Ae2: boolean,
    p: number
  ) => {
    const key = `${result}|${+He1}${+He2}${+Ae1}${+Ae2}`;
    const cur = map.get(key);
    if (cur) cur.p += p;
    else map.set(key, { result, He1, He2, Ae1, Ae2, p });
  };

  for (let fh = 0; fh <= maxg; fh++) {
    for (let fa = 0; fa <= maxg; fa++) {
      const w = wfn(fh, fa);
      if (w < 1e-11) continue;
      const n = fh + fa;
      const finalResult = liveResult(hg + fh, ag + fa);
      tot += w;

      if (n === 0) {
        add(
          finalResult,
          homeLed2 || finalResult === "H",
          homeLed2 || finalResult === "H",
          awayLed2 || finalResult === "A",
          awayLed2 || finalResult === "A",
          w
        );
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
        const He1 = homeLed2 || remH1 || finalResult === "H";
        const He2 = homeLed2 || remH2 || finalResult === "H";
        const Ae1 = awayLed2 || remA1 || finalResult === "A";
        const Ae2 = awayLed2 || remA2 || finalResult === "A";
        add(finalResult, He1, He2, Ae1, Ae2, (w * c) / cnt);
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

  const ftWin =
    side === "home" ? result === "H" : side === "away" ? result === "A" : result === "D";
  const early =
    bet.earlyPayout &&
    ((side === "home" && epH && result !== "H") ||
      (side === "away" && epA && result !== "A"));

  return settleFromOutcome(bet, ftWin, paid, early).profit;
}

function modelEv(
  bet: SettleableBet,
  scen: Scenario[],
  homeThreshold: 1 | 2,
  awayThreshold: 1 | 2
): number | null {
  let ev = 0;
  for (const s of scen) {
    const epH =
      (homeThreshold === 2 ? s.He2 : s.He1) || s.result === "H";
    const epA =
      (awayThreshold === 2 ? s.Ae2 : s.Ae1) || s.result === "A";
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
  homeThreshold: 1 | 2;
  awayThreshold: 1 | 2;
} | null {
  if (!bet.legs?.length) return null;
  const home = bet.legs.find((l) => l.selection === "home");
  const away = bet.legs.find((l) => l.selection === "away");
  const draw = bet.legs.find((l) => l.selection === "draw");
  if (!home || !away || !draw) return null;
  return {
    oH: home.odds,
    oA: away.odds,
    oD: draw.odds,
    SH: home.stake,
    SA: away.stake,
    SD: draw.stake,
    homeThreshold: legThreshold(home),
    awayThreshold: legThreshold(away),
  };
}

function probsForBet(settleable: SettleableBet): PreMatchProbs | null {
  return inferPreMatchProbs({
    legs: settleable.legs,
    market: settleable.market,
    selection: settleable.selection,
    backOdds: settleable.backOdds,
    layOdds: settleable.layOdds,
    earlyPayout: settleable.earlyPayout,
  });
}

/** Model-weighted live EV for EP / 2UP football positions; null → use snapshot provisional. */
export function liveProbabilisticProfit(bet: BetRow, event: EventRow): number | null {
  if (event.sport !== "football" || event.status !== "live") return null;

  const settleable = rowToSettleable(bet);
  if (!hasEarlyPayoutExposure(settleable)) return null;

  const probs = probsForBet(settleable);
  if (!probs) return null;

  const model = liveMatchStateModel(probs, {
    minute: event.minute,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
  });
  const remaining = remainingGoalsGrid(model.fit, {
    minute: event.minute,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
  });
  const wfn = (fh: number, fa: number) => remaining[fh]?.[fa] ?? 0;

  const hg = event.homeScore;
  const ag = event.awayScore;
  const homeLed2 = !!event.homeLed2;
  const awayLed2 = !!event.awayLed2;

  const dutch = dutchLegOdds(settleable);
  if (dutch) {
    const scen = liveScenarios(wfn, hg, ag, homeLed2, awayLed2);
    if (dutch.homeThreshold === dutch.awayThreshold) {
      return dutchDist(
        scen,
        dutch.oH,
        dutch.oA,
        dutch.oD,
        dutch.SH,
        dutch.SA,
        dutch.SD,
        dutch.homeThreshold
      ).EV;
    }
    return dutchDistMixed(
      scen,
      dutch.oH,
      dutch.oA,
      dutch.oD,
      dutch.SH,
      dutch.SA,
      dutch.SD,
      dutch.homeThreshold,
      dutch.awayThreshold
    ).EV;
  }

  if (settleable.layStake > 0 && settleable.backStake > 0) {
    const threshold: 1 | 2 =
      settleable.earlyPayout || settleable.market === "two_up" ? 2 : 2;
    const scen = liveScenarios(wfn, hg, ag, homeLed2, awayLed2);
    return modelEv(settleable, scen, threshold, threshold);
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
  const model = liveMatchStateModel(
    { tH: tH / sum, tD: tD / sum, tA: tA / sum },
    { minute: 0, homeScore: 0, awayScore: 0 }
  );
  const remaining = remainingGoalsGrid(model.fit, {
    minute: 0,
    homeScore: 0,
    awayScore: 0,
  });
  const wfn = (nh: number, na: number) => remaining[nh]?.[na] ?? 0;
  const scen = scenariosW(wfn);
  const homeT = legThreshold(home);
  const awayT = legThreshold(away);
  if (homeT === awayT) {
    return dutchDist(
      scen,
      home.odds,
      away.odds,
      draw.odds,
      home.stake,
      away.stake,
      draw.stake,
      homeT
    ).EV;
  }
  return dutchDistMixed(
    scen,
    home.odds,
    away.odds,
    draw.odds,
    home.stake,
    away.stake,
    draw.stake,
    homeT,
    awayT
  ).EV;
}

/**
 * Live model EV for a dutch structure on the 2UP Desk Live tab.
 * Uses desk-calibrated pre-match probs + current score/minute/triggers.
 */
export function liveDeskDutchEv(input: {
  tH: number;
  tD: number;
  tA: number;
  tOV?: number | null;
  tBT?: number | null;
  minute: number;
  homeScore: number;
  awayScore: number;
  homeLed2: boolean;
  awayLed2: boolean;
  oH: number;
  oA: number;
  oD: number;
  SH: number;
  SA: number;
  SD: number;
  homeThreshold: 1 | 2;
  awayThreshold: 1 | 2;
}): { ev: number; markets: ReturnType<typeof liveMatchStateModel>["markets"] } {
  const model = liveMatchStateModel(
    {
      tH: input.tH,
      tD: input.tD,
      tA: input.tA,
      tOV: input.tOV,
      tBT: input.tBT,
    },
    {
      minute: input.minute,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
    }
  );
  const remaining = remainingGoalsGrid(model.fit, {
    minute: input.minute,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
  });
  const wfn = (fh: number, fa: number) => remaining[fh]?.[fa] ?? 0;
  const scen = liveScenarios(
    wfn,
    input.homeScore,
    input.awayScore,
    input.homeLed2,
    input.awayLed2
  );
  const ev =
    input.homeThreshold === input.awayThreshold
      ? dutchDist(
          scen,
          input.oH,
          input.oA,
          input.oD,
          input.SH,
          input.SA,
          input.SD,
          input.homeThreshold
        ).EV
      : dutchDistMixed(
          scen,
          input.oH,
          input.oA,
          input.oD,
          input.SH,
          input.SA,
          input.SD,
          input.homeThreshold,
          input.awayThreshold
        ).EV;
  return { ev, markets: model.markets };
}
