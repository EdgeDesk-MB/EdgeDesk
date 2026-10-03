import { describe, expect, it } from "vitest";
import {
  exchangeReserve,
  layFundingNeed,
  layLiability,
  sharedLiabilityReturn,
  type SharedLiabilityLay,
} from "./shared-liability";

const lay = (
  overrides: Partial<SharedLiabilityLay> & Pick<SharedLiabilityLay, "id">
): SharedLiabilityLay => ({
  eventId: 9,
  market: "match_odds",
  selection: "home",
  layStake: 0,
  layOdds: 0,
  commission: 0.02,
  ...overrides,
});

describe("layLiability", () => {
  it("is stake x (odds - 1), rounded to the penny", () => {
    // 20 x 3.8 = 76.00 (the float is 76.00000000000001)
    expect(layLiability(lay({ id: 1, layStake: 20, layOdds: 4.8 }))).toBe(76);
    // 200 x 0.88 = 176.00 (the float is 175.99999999999997)
    expect(layLiability(lay({ id: 2, layStake: 200, layOdds: 1.88 }))).toBe(176);
    // 33.33 x 1.07 = 35.6631 -> 35.66
    expect(layLiability(lay({ id: 3, layStake: 33.33, layOdds: 2.07 }))).toBe(35.66);
  });

  it("is zero for a stake of nothing or odds of 1 or less", () => {
    expect(layLiability(lay({ id: 1, layStake: 0, layOdds: 4.8 }))).toBe(0);
    expect(layLiability(lay({ id: 2, layStake: 20, layOdds: 1 }))).toBe(0);
    expect(layLiability(lay({ id: 3, layStake: -20, layOdds: 4.8 }))).toBe(0);
  });
});

describe("exchangeReserve", () => {
  it("locks the full liability of a lone lay", () => {
    expect(exchangeReserve([lay({ id: 1, layStake: 20, layOdds: 4.8 })])).toBe(76);
  });

  it("locks only the worst case when lays cover different results of one market", () => {
    // Lay Norway 20 @ 4.8 (liability 76.00) + lay England 200 @ 1.88
    // (liability 176.00) on the same match, 2% commission.
    //   Norway wins:  -76.00 + 200 x 0.98 = +120.00
    //   England wins: -176.00 + 20 x 0.98 = -156.40  <- worst
    // Reserve 156.40 of the 252.00 summed liability, so 95.60 comes back.
    const lays = [
      lay({ id: 1, selection: "away", layStake: 20, layOdds: 4.8 }),
      lay({ id: 2, selection: "home", layStake: 200, layOdds: 1.88 }),
    ];
    expect(exchangeReserve(lays)).toBe(156.4);
    expect(sharedLiabilityReturn(lays)).toBe(95.6);
  });

  it("locks nothing when every result of the market pays out", () => {
    // Lay home 100 @ 1.5 and away 100 @ 1.5, 2% commission.
    //   home wins: -50.00 + 100 x 0.98 = +48.00
    //   away wins: -50.00 + 100 x 0.98 = +48.00
    const lays = [
      lay({ id: 1, selection: "home", layStake: 100, layOdds: 1.5 }),
      lay({ id: 2, selection: "away", layStake: 100, layOdds: 1.5 }),
    ];
    expect(exchangeReserve(lays)).toBe(0);
    expect(sharedLiabilityReturn(lays)).toBe(100);
  });

  it("does not share two lays on the same selection, because they lose together", () => {
    // Part-matched lays on home: 100 @ 2.0 (100.00) + 100 @ 3.0 (200.00).
    // Home winning loses both, so the exchange locks the full 300.00.
    const lays = [
      lay({ id: 1, selection: "home", layStake: 100, layOdds: 2 }),
      lay({ id: 2, selection: "home", layStake: 100, layOdds: 3 }),
    ];
    expect(exchangeReserve(lays)).toBe(300);
    expect(sharedLiabilityReturn(lays)).toBe(0);
  });

  it("does not share a market where several selections can win", () => {
    // Two runners in a Place market can both place, so both lays can lose.
    const lays = [
      lay({ id: 1, market: "place", selection: "Runner A", layStake: 100, layOdds: 2 }),
      lay({ id: 2, market: "place", selection: "Runner B", layStake: 100, layOdds: 3 }),
    ];
    expect(exchangeReserve(lays)).toBe(300);
    expect(sharedLiabilityReturn(lays)).toBe(0);
  });

  it("does not share Double chance, where two selections win together", () => {
    // Home winning settles both home/draw and home/away, so both lays lose.
    const lays = [
      lay({ id: 1, market: "double_chance", selection: "home/draw", layStake: 100, layOdds: 2 }),
      lay({ id: 2, market: "double_chance", selection: "home/away", layStake: 100, layOdds: 3 }),
    ];
    expect(exchangeReserve(lays)).toBe(300);
  });

  it("does not share across different events or different markets", () => {
    expect(
      exchangeReserve([
        lay({ id: 1, eventId: 9, selection: "home", layStake: 20, layOdds: 4.8 }),
        lay({ id: 2, eventId: 10, selection: "home", layStake: 200, layOdds: 1.88 }),
      ])
    ).toBe(252);
    expect(
      exchangeReserve([
        lay({ id: 1, market: "match_odds", selection: "home", layStake: 20, layOdds: 4.8 }),
        lay({ id: 2, market: "btts", selection: "yes", layStake: 200, layOdds: 1.88 }),
      ])
    ).toBe(252);
  });

  it("does not share lays with no linked event, because the market is unproven", () => {
    expect(
      exchangeReserve([
        lay({ id: 1, eventId: null, selection: "home", layStake: 20, layOdds: 4.8 }),
        lay({ id: 2, eventId: null, selection: "away", layStake: 200, layOdds: 1.88 }),
      ])
    ).toBe(252);
  });

  it("treats blank selections as separate positions, not one merged bucket", () => {
    // A quick-logged lay can land without a selection. We cannot prove two of
    // them are the same result, and crediting them as one would drop the
    // shared-liability return that balances already show.
    const lays = [
      lay({ id: 1, selection: "", layStake: 20, layOdds: 4.8 }),
      lay({ id: 2, selection: "", layStake: 200, layOdds: 1.88 }),
    ];
    expect(exchangeReserve(lays)).toBe(156.4);
  });

  it("sums reserves across separate markets", () => {
    // Shared pair on event 9 (156.40) plus a lone lay on event 10 (76.00).
    const lays = [
      lay({ id: 1, selection: "away", layStake: 20, layOdds: 4.8 }),
      lay({ id: 2, selection: "home", layStake: 200, layOdds: 1.88 }),
      lay({ id: 3, eventId: 10, layStake: 20, layOdds: 4.8 }),
    ];
    expect(exchangeReserve(lays)).toBe(232.4);
  });
});

describe("layFundingNeed", () => {
  it("needs the full liability when nothing else is laid on the market", () => {
    const need = layFundingNeed([], lay({ id: "new", layStake: 100, layOdds: 3 }));
    expect(need.grossLiability).toBe(200);
    expect(need.cashRequired).toBe(200);
    expect(need.sharedSaving).toBe(0);
    expect(need.shared).toBe(false);
  });

  it("needs only the extra worst case when the other side is already laid", () => {
    // Open: lay home 100 @ 2.0, liability 100.00, so 100.00 is locked.
    // New:  lay away 100 @ 3.0, liability 200.00 on its own.
    //   home wins: -100.00 + 100 x 0.98 = -2.00
    //   away wins: -200.00 + 100 x 0.98 = -102.00  <- worst
    // Reserve rises 100.00 -> 102.00, so the new lay locks 2.00 more.
    const open = [lay({ id: 1, selection: "home", layStake: 100, layOdds: 2 })];
    const need = layFundingNeed(open, lay({ id: "new", selection: "away", layStake: 100, layOdds: 3 }));
    expect(need.grossLiability).toBe(200);
    expect(need.cashRequired).toBe(2);
    expect(need.sharedSaving).toBe(198);
    expect(need.shared).toBe(true);
  });

  it("needs nothing when the new lay hedges more than it costs", () => {
    // Open: lay home 200 @ 1.88, liability 176.00 locked.
    // New:  lay away 50 @ 4.8, liability 190.00 on its own.
    //   home wins: -176.00 + 50 x 0.98 = -127.00  <- worst
    //   away wins: -190.00 + 200 x 0.98 = +6.00
    // Reserve falls 176.00 -> 127.00, so no extra cash is needed.
    const open = [lay({ id: 1, selection: "home", layStake: 200, layOdds: 1.88 })];
    const need = layFundingNeed(open, lay({ id: "new", selection: "away", layStake: 50, layOdds: 4.8 }));
    expect(need.grossLiability).toBe(190);
    expect(need.cashRequired).toBe(0);
    expect(need.sharedSaving).toBe(190);
    expect(need.shared).toBe(true);
  });

  it("needs the full liability when the open lay is on the same selection", () => {
    const open = [lay({ id: 1, selection: "home", layStake: 100, layOdds: 2 })];
    const need = layFundingNeed(open, lay({ id: "new", selection: "home", layStake: 100, layOdds: 3 }));
    expect(need.cashRequired).toBe(200);
    expect(need.sharedSaving).toBe(0);
    expect(need.shared).toBe(false);
  });

  it("replaces the lay under edit instead of double counting it", () => {
    // Editing bet 1 from 100 @ 2.0 (100.00 locked) up to 100 @ 3.0 (200.00)
    // needs 100.00 more, not 200.00.
    const open = [lay({ id: 1, selection: "home", layStake: 100, layOdds: 2 })];
    const need = layFundingNeed(open, lay({ id: 1, selection: "home", layStake: 100, layOdds: 3 }));
    expect(need.grossLiability).toBe(200);
    expect(need.cashRequired).toBe(100);
    expect(need.sharedSaving).toBe(0);
  });

  it("frees cash when the lay under edit shrinks", () => {
    const open = [lay({ id: 1, selection: "home", layStake: 100, layOdds: 3 })];
    const need = layFundingNeed(open, lay({ id: 1, selection: "home", layStake: 100, layOdds: 2 }));
    expect(need.cashRequired).toBe(0);
  });

  it("needs nothing for a bet with no lay", () => {
    const open = [lay({ id: 1, selection: "home", layStake: 100, layOdds: 2 })];
    const need = layFundingNeed(open, lay({ id: "new", layStake: 0, layOdds: 0 }));
    expect(need.grossLiability).toBe(0);
    expect(need.cashRequired).toBe(0);
    expect(need.shared).toBe(false);
  });

  it("ignores open lays that are not comparable to the candidate", () => {
    // Different event, so the gross liability still has to be funded.
    const open = [lay({ id: 1, eventId: 10, selection: "away", layStake: 200, layOdds: 1.88 })];
    const need = layFundingNeed(open, lay({ id: "new", selection: "home", layStake: 100, layOdds: 3 }));
    expect(need.cashRequired).toBe(200);
    expect(need.shared).toBe(false);
  });
});
