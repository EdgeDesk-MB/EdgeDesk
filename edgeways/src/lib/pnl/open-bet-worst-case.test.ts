import { describe, expect, it } from "vitest";
import {
  sumEventIfEndedNow,
  sumLiveChartProvisional,
  sumOpenWorstCaseProfit,
} from "./open-bet-worst-case";

type WorstCaseBet = Parameters<typeof sumOpenWorstCaseProfit>[0][number];

function bet(partial: Partial<WorstCaseBet> & Pick<WorstCaseBet, "id">): WorstCaseBet {
  return {
    status: "open",
    eventId: 10,
    market: "match_odds",
    selection: "home",
    betType: "free_snr",
    backStake: 0,
    backOdds: 0,
    layStake: 0,
    layOdds: 0,
    commission: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    expectedProfit: null,
    ...partial,
  };
}

describe("sumOpenWorstCaseProfit", () => {
  it("free SNR £10 @ 8.10 + lock-in lay £7.50 @ 4.00 (0% commission): worst path +£7.50, not Hull-win +£48.50", () => {
    // Back SNR: Hull wins 10 × (8.10 − 1) = +71.00; Hull does not win = £0
    // Lay: Hull wins liability 7.50 × (4.00 − 1) = −22.50; Hull does not win = +7.50
    // Pair: ifWin 71.00 − 22.50 = +48.50; ifLose 0 + 7.50 = +7.50; min = +7.50
    const total = sumOpenWorstCaseProfit([
      bet({
        id: 1,
        betType: "free_snr",
        backStake: 10,
        backOdds: 8.1,
      }),
      bet({
        id: 2,
        betType: "lay_only",
        layStake: 7.5,
        layOdds: 4,
      }),
    ]);
    expect(total).toBe(7.5);
  });

  it("same pair at 2% commission: lose-path floor is 7.50 × 0.98 = +£7.35", () => {
    const total = sumOpenWorstCaseProfit([
      bet({
        id: 1,
        betType: "free_snr",
        backStake: 10,
        backOdds: 8.1,
        commission: 0.02,
      }),
      bet({
        id: 2,
        betType: "lay_only",
        layStake: 7.5,
        layOdds: 4,
        commission: 0.02,
      }),
    ]);
    expect(total).toBe(7.35);
  });

  it("does not combine bets on different selections", () => {
    // Naked free SNR worst = £0; unrelated lay-only worst = min(−22.50, +7.50) = −22.50
    expect(
      sumOpenWorstCaseProfit([
        bet({
          id: 1,
          selection: "home",
          betType: "free_snr",
          backStake: 10,
          backOdds: 8.1,
        }),
        bet({
          id: 2,
          selection: "away",
          betType: "lay_only",
          layStake: 7.5,
          layOdds: 4,
        }),
      ])
    ).toBe(-22.5);
  });

  it("keeps stored expectedProfit on a lone unmatched qualifier", () => {
    expect(
      sumOpenWorstCaseProfit([
        bet({
          id: 1,
          betType: "qualifying",
          backStake: 10,
          backOdds: 2,
          expectedProfit: 0.5,
        }),
      ])
    ).toBe(0.5);
  });

  it("uses min(ifWin, ifLose) on a single matched back+lay row", () => {
    // Qualifying £10 @ 2.00 vs lay £10 @ 2.00, 0% commission:
    // ifWin = 10 − 10 = 0; ifLose = −10 + 10 = 0
    expect(
      sumOpenWorstCaseProfit([
        bet({
          id: 1,
          betType: "qualifying",
          backStake: 10,
          backOdds: 2,
          layStake: 10,
          layOdds: 2,
          expectedProfit: 99,
        }),
      ])
    ).toBe(0);
  });

  it("falls back to expectedProfit for each-way / extra-place (not two-way)", () => {
    expect(
      sumOpenWorstCaseProfit([
        bet({
          id: 1,
          market: "each_way",
          betType: "qualifying",
          backStake: 10,
          backOdds: 8,
          expectedProfit: 4.5,
        }),
      ])
    ).toBe(4.5);
  });

  it("ignores settled bets and excluded ids", () => {
    expect(
      sumOpenWorstCaseProfit(
        [
          bet({ id: 1, betType: "free_snr", backStake: 10, backOdds: 8.1 }),
          bet({
            id: 2,
            status: "won",
            betType: "lay_only",
            layStake: 7.5,
            layOdds: 4,
            expectedProfit: 7.5,
          }),
          bet({
            id: 3,
            betType: "free_snr",
            backStake: 10,
            backOdds: 8.1,
            expectedProfit: 18,
          }),
        ],
        { excludeBetIds: [3] }
      )
    ).toBe(0);
  });
});

describe("sumEventIfEndedNow", () => {
  it("sums snapshot provisionals for one event: +71.00 + −22.50 = +£48.50", () => {
    expect(
      sumEventIfEndedNow(
        [
          { eventId: 10, snapshotProvisional: 71 },
          { eventId: 10, snapshotProvisional: -22.5 },
          { eventId: 11, snapshotProvisional: 9 },
        ],
        10
      )
    ).toBe(48.5);
  });

  it("returns null when the event has no snapshot values", () => {
    expect(
      sumEventIfEndedNow([{ eventId: 10, snapshotProvisional: null }], 10)
    ).toBeNull();
    expect(sumEventIfEndedNow([], 10)).toBeNull();
  });
});

describe("sumLiveChartProvisional", () => {
  it("uses if-ended-now on a live 2UP instead of the worst-case floor: +£250 not −£10", () => {
    // Stored floor is the unmatched-path −£10. Current score already paid 2UP.
    const open = [
      bet({
        id: 1,
        market: "two_up",
        expectedProfit: -10,
      }),
    ];
    expect(sumOpenWorstCaseProfit(open)).toBe(-10);
    expect(
      sumLiveChartProvisional(open, [{ betId: 1, snapshotProvisional: 250 }])
    ).toBe(250);
  });

  it("keeps worst-case on open bets that are not live", () => {
    const open = [
      bet({ id: 1, expectedProfit: 4.2 }),
      bet({ id: 2, expectedProfit: -1.1, eventId: 11 }),
    ];
    expect(
      sumLiveChartProvisional(open, [{ betId: 2, snapshotProvisional: 18 }])
    ).toBe(22.2);
  });

  it("does not double-count a desk acca snapshot already in extraProvisional", () => {
    const open = [bet({ id: 9, expectedProfit: 3 })];
    expect(
      sumLiveChartProvisional(
        open,
        [{ betId: 9, kind: "acca", snapshotProvisional: 40 }],
        { extraProvisional: 12 }
      )
    ).toBe(15);
  });
});
