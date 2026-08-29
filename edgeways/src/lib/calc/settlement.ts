/**
 * Result-centric settlement engine.
 * A score (plus "was a team ever 2 goals ahead" flags tracked live) derives every
 * market outcome, and each open bet settles automatically from those outcomes.
 */

import type { EachWayBetMeta } from "@/lib/bets/ew-meta";

export type Market =
  | "match_odds"
  | "btts"
  | "over_under_1_5"
  | "over_under_2_5"
  | "over_under_3_5"
  | "correct_score"
  | "draw_no_bet"
  | "double_chance"
  | "two_up"
  | "win"
  | "place"
  | "each_way"
  | "extra_place"
  | "other";

export type MatchOddsSelection = "home" | "draw" | "away";

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  /** Was the home side ever 2+ goals ahead (tracked from live score progression)? */
  homeLed2: boolean;
  awayLed2: boolean;
  /** True while the match is still in play - settlement is then provisional */
  inPlay?: boolean;
}

export interface DerivedOutcomes {
  homeScore: number;
  awayScore: number;
  matchOdds: MatchOddsSelection;
  btts: "yes" | "no";
  overUnder15: "over" | "under";
  overUnder25: "over" | "under";
  overUnder35: "over" | "under";
  twoUpTriggered: { home: boolean; away: boolean };
  totalGoals: number;
}

export function deriveOutcomes(result: MatchResult): DerivedOutcomes {
  const { homeScore, awayScore, homeLed2, awayLed2 } = result;
  const totalGoals = homeScore + awayScore;
  return {
    homeScore,
    awayScore,
    matchOdds: homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "draw",
    btts: homeScore > 0 && awayScore > 0 ? "yes" : "no",
    overUnder15: totalGoals > 1.5 ? "over" : "under",
    overUnder25: totalGoals > 2.5 ? "over" : "under",
    overUnder35: totalGoals > 3.5 ? "over" : "under",
    twoUpTriggered: { home: homeLed2, away: awayLed2 },
    totalGoals,
  };
}

export type BetType =
  | "qualifying"
  | "boost"
  | "free_snr"
  | "free_sr"
  | "risk_free"
  | "back_only"
  | "lay_only"
  | "dutch";

export interface DutchLegRecord {
  label: string;
  market: Market;
  selection: string;
  odds: number;
  stake: number;
  /** Bookie offers 2UP early payout on this leg */
  earlyPayout?: boolean;
  /** Bookie or exchange this leg is placed at */
  bookmaker?: string;
  /** Set when this leg's stake is a free bet, not real cash - it costs
   * nothing if it loses. SNR: profit is stake × (odds − 1). SR: the stake
   * itself is paid out too, so profit is stake × odds. */
  freeBet?: "snr" | "sr";
}

export interface SettleableBet {
  market: Market;
  selection: string;
  betType: BetType;
  backStake: number;
  backOdds: number;
  layStake: number;
  layOdds: number;
  commission: number;
  /** Bookie side pays out early at 2 goals ahead */
  earlyPayout?: boolean;
  refundAmount?: number;
  refundRetention?: number;
  legs?: DutchLegRecord[];
  /** Dual win/place lays for each-way and extra-place bets */
  ewMeta?: EachWayBetMeta;
}

export type SettledBetStatus =
  | "won"
  | "lost"
  | "early_payout"
  | "void"
  | "half_win"
  | "half_lose"
  | "push";

export interface SettlementOutcome {
  status: SettledBetStatus;
  profit: number;
  /** Human readable explanation of how the number was reached */
  explanation: string;
}

/**
 * Ultimatcher Pending-sheet partials: ½ win, ½ lose, push.
 * Half outcomes average the full win and full lose P&L (dead-heat style).
 */
export function settlePartialOutcome(
  bet: SettleableBet,
  kind: "half_win" | "half_lose" | "push" | "void"
): SettlementOutcome {
  if (kind === "push" || kind === "void") {
    return {
      status: kind,
      profit: 0,
      explanation:
        kind === "push"
          ? "Push - stakes returned both sides"
          : "Void - stakes returned both sides",
    };
  }
  const win = settleFromOutcome(bet, true);
  const lose = settleFromOutcome(bet, false);
  const profit = (win.profit + lose.profit) / 2;
  return {
    status: kind,
    profit,
    explanation:
      kind === "half_win"
        ? `Half win (dead heat) - avg of win (£${win.profit.toFixed(2)}) and lose (£${lose.profit.toFixed(2)})`
        : `Half lose - avg of win (£${win.profit.toFixed(2)}) and lose (£${lose.profit.toFixed(2)})`,
  };
}

/** Did this market/selection win given derived football outcomes? null = underivable / voidable. */
export function selectionWon(
  market: Market | string,
  selection: string,
  outcomes: DerivedOutcomes
): boolean | null {
  switch (market) {
    case "match_odds":
      return outcomes.matchOdds === selection;
    case "btts":
      return outcomes.btts === selection;
    case "over_under_1_5":
      return outcomes.overUnder15 === selection;
    case "over_under_2_5":
      return outcomes.overUnder25 === selection;
    case "over_under_3_5":
      return outcomes.overUnder35 === selection;
    case "draw_no_bet":
      if (outcomes.matchOdds === "draw") return null;
      return outcomes.matchOdds === selection;
    case "double_chance": {
      const r = outcomes.matchOdds;
      if (selection === "home/draw") return r === "home" || r === "draw";
      if (selection === "home/away") return r === "home" || r === "away";
      if (selection === "draw/away") return r === "draw" || r === "away";
      return null;
    }
    case "two_up":
      return selection === "home" ? outcomes.twoUpTriggered.home : outcomes.twoUpTriggered.away;
    case "correct_score": {
      const m = selection.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
      if (!m) return null;
      return outcomes.homeScore === Number(m[1]) && outcomes.awayScore === Number(m[2]);
    }
    default:
      return null;
  }
}

/** Did the bookie side of this bet get paid out (normally or via 2UP early payout)? */
function backSidePaid(bet: SettleableBet, outcomes: DerivedOutcomes): { paid: boolean; early: boolean } {
  const won = selectionWon(bet.market, bet.selection, outcomes);
  if (won === null) return { paid: false, early: false };
  if (bet.earlyPayout && bet.market === "match_odds") {
    const led2 =
      bet.selection === "home" ? outcomes.twoUpTriggered.home
      : bet.selection === "away" ? outcomes.twoUpTriggered.away
      : false;
    if (led2) return { paid: true, early: !won };
  }
  return { paid: won, early: false };
}

/**
 * Settle a back+lay position from a known win/lose outcome - the shared leg maths
 * used both by the result engine and by "The bet wins IF" trigger settlement.
 * `paid` covers 2UP early payouts where the bookie pays despite the selection losing.
 */
export function settleFromOutcome(
  bet: SettleableBet,
  won: boolean,
  paid: boolean = won,
  early = false
): SettlementOutcome {
  const layLoses = won; // exchange settles on the real result, never the early payout
  const liability = bet.layStake * (bet.layOdds - 1);
  const layWinnings = bet.layStake * (1 - bet.commission);

  let backProfit = 0;
  switch (bet.betType) {
    case "qualifying":
    case "boost":
    case "back_only":
    case "risk_free":
    case "dutch":
      // risk_free: anticipated FB value is for lay sizing / expectedProfit only.
      // Actual cash is the back+lay P&L; the free bet is awarded and converted.
      backProfit = paid ? bet.backStake * (bet.backOdds - 1) : -bet.backStake;
      break;
    case "free_snr":
      backProfit = paid ? bet.backStake * (bet.backOdds - 1) : 0;
      break;
    case "free_sr":
      backProfit = paid ? bet.backStake * bet.backOdds : 0;
      break;
    case "lay_only":
      backProfit = 0;
      break;
  }

  const layProfit = bet.betType === "back_only" ? 0 : layLoses ? -liability : layWinnings;
  const profit = backProfit + layProfit;

  const explanation = early
    ? `Bookie paid early via 2UP (+£${(bet.backStake * (bet.backOdds - 1)).toFixed(2)}), exchange lay also won (+£${layWinnings.toFixed(2)})`
    : `Back side ${paid ? "won" : "lost"}, lay side ${layLoses ? "lost" : "won"}`;

  // Status reflects the BOOKIE-side result (a "won" qualifier can still be a small net loss)
  const bookieSideWon = bet.betType === "lay_only" ? !won : paid;
  return {
    status: early ? "early_payout" : bookieSideWon ? "won" : "lost",
    profit,
    explanation,
  };
}

/** Per-side net P&L for balance ledger distribution on settlement. */
export function settlementSidePnL(
  bet: SettleableBet,
  won: boolean,
  paid: boolean = won,
  early = false
): { bookie: number; exchange: number; total: number } {
  const layLoses = won;
  const liability = bet.layStake * (bet.layOdds - 1);
  const layWinnings = bet.layStake * (1 - bet.commission);

  let backProfit = 0;
  switch (bet.betType) {
    case "qualifying":
    case "boost":
    case "back_only":
    case "risk_free":
    case "dutch":
      // risk_free: anticipated FB value is for lay sizing / expectedProfit only.
      // Actual cash is the back+lay P&L; the free bet is awarded and converted.
      backProfit = paid ? bet.backStake * (bet.backOdds - 1) : -bet.backStake;
      break;
    case "free_snr":
      backProfit = paid ? bet.backStake * (bet.backOdds - 1) : 0;
      break;
    case "free_sr":
      backProfit = paid ? bet.backStake * bet.backOdds : 0;
      break;
    case "lay_only":
      backProfit = 0;
      break;
  }

  const layProfit = bet.betType === "back_only" ? 0 : layLoses ? -liability : layWinnings;
  return { bookie: backProfit, exchange: layProfit, total: backProfit + layProfit };
}

export function settleBet(bet: SettleableBet, result: MatchResult): SettlementOutcome | null {
  const outcomes = deriveOutcomes(result);

  if (bet.betType === "dutch") {
    if (!bet.legs || bet.legs.length === 0) return null;
    let profit = 0;
    const notes: string[] = [];
    let anyKnown = false;
    for (const leg of bet.legs) {
      const won = selectionWon(leg.market, leg.selection, outcomes);
      if (won === null) {
        if (leg.market === "draw_no_bet" && outcomes.matchOdds === "draw") {
          notes.push(`${leg.label}: void (DNB draw)`);
          continue;
        }
        return null;
      }
      anyKnown = true;
      let paid = won;
      let early = false;
      if (leg.earlyPayout && leg.market === "match_odds") {
        const led2 =
          leg.selection === "home" ? outcomes.twoUpTriggered.home
          : leg.selection === "away" ? outcomes.twoUpTriggered.away
          : false;
        if (led2 && !won) {
          paid = true;
          early = true;
        }
      }
      if (leg.freeBet === "sr") {
        profit += paid ? leg.stake * leg.odds : 0;
      } else if (leg.freeBet === "snr") {
        profit += paid ? leg.stake * (leg.odds - 1) : 0;
      } else {
        profit += paid ? leg.stake * (leg.odds - 1) : -leg.stake;
      }
      notes.push(`${leg.label}: ${paid ? (early ? "paid early (2UP)" : "won") : "lost"}`);
    }
    if (!anyKnown) return null;
    const anyEarly = notes.some((n) => n.includes("2UP"));
    const anyPaid = notes.some((n) => n.includes("won") || n.includes("paid early"));
    return {
      status: anyEarly ? "early_payout" : anyPaid ? "won" : "lost",
      profit,
      explanation: notes.join(" · "),
    };
  }

  const won = selectionWon(bet.market, bet.selection, outcomes);
  if (won === null) {
    if (bet.market === "draw_no_bet" && outcomes.matchOdds === "draw") {
      return { status: "void", profit: 0, explanation: "Draw - draw no bet void (stakes returned)" };
    }
    return null;
  }

  const { paid, early } = backSidePaid(bet, outcomes);
  return settleFromOutcome(bet, won, paid, early);
}

/**
 * Provisional value of an open bet given the CURRENT live score -
 * i.e. "what would I make if the match ended right now".
 */
export function provisionalProfit(bet: SettleableBet, live: MatchResult): number | null {
  const settled = settleBet(bet, { ...live, inPlay: true });
  return settled ? settled.profit : null;
}
