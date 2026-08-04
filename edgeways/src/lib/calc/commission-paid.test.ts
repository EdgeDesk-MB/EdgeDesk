import { describe, expect, it } from "vitest";
import { commissionPaidOnSettledBet, type CommissionPaidInput } from "./commission-paid";
import { serializeEwMeta, type EachWayBetMeta } from "@/lib/bets/ew-meta";

function bet(over: Partial<CommissionPaidInput> = {}): CommissionPaidInput {
  return {
    betType: "qualifying",
    market: "win",
    status: "lost",
    layStake: 48,
    commission: 0.02,
    notes: null,
    ...over,
  };
}

const EW_META: EachWayBetMeta = {
  stakePerPart: 5,
  placeFraction: 0.2,
  layWin: { stake: 10, odds: 8 },
  layPlace: { stake: 8, odds: 2.4 },
  bookiePlaces: 4,
  exchangePlaces: 3,
  mode: "extra_place",
};

describe("commissionPaidOnSettledBet", () => {
  it("back lost, lay won: commission on lay stake — 48 × 0.02 = £0.96", () => {
    expect(commissionPaidOnSettledBet(bet({ status: "lost" }))).toBeCloseTo(0.96, 10);
  });

  it("back won, lay lost: no commission", () => {
    expect(commissionPaidOnSettledBet(bet({ status: "won" }))).toBe(0);
  });

  it("early payout: exchange lay also won — 20 × 0.05 = £1.00", () => {
    expect(
      commissionPaidOnSettledBet(bet({ status: "early_payout", layStake: 20, commission: 0.05 }))
    ).toBeCloseTo(1, 10);
  });

  it("half outcomes embed half the commission (avg of win £0 and lose 30 × 0.02) = £0.30", () => {
    expect(
      commissionPaidOnSettledBet(bet({ status: "half_win", layStake: 30 }))
    ).toBeCloseTo(0.3, 10);
    expect(
      commissionPaidOnSettledBet(bet({ status: "half_lose", layStake: 30 }))
    ).toBeCloseTo(0.3, 10);
  });

  it("void, push and open bets pay no commission", () => {
    expect(commissionPaidOnSettledBet(bet({ status: "void" }))).toBe(0);
    expect(commissionPaidOnSettledBet(bet({ status: "push" }))).toBe(0);
    expect(commissionPaidOnSettledBet(bet({ status: "open" }))).toBe(0);
  });

  it("back-only and dutch bets have no lay leg", () => {
    expect(commissionPaidOnSettledBet(bet({ betType: "back_only", status: "lost" }))).toBe(0);
    expect(commissionPaidOnSettledBet(bet({ betType: "dutch", status: "lost" }))).toBe(0);
  });

  it("lay-only: status reflects the bookie side, so 'won' means the lay won — 25 × 0.02 = £0.50", () => {
    expect(
      commissionPaidOnSettledBet(bet({ betType: "lay_only", status: "won", layStake: 25 }))
    ).toBeCloseTo(0.5, 10);
    expect(
      commissionPaidOnSettledBet(bet({ betType: "lay_only", status: "lost", layStake: 25 }))
    ).toBe(0);
  });

  it("lay-only half outcomes embed half the commission — 25 × 0.02 / 2 = £0.25", () => {
    expect(
      commissionPaidOnSettledBet(bet({ betType: "lay_only", status: "half_win", layStake: 25 }))
    ).toBeCloseTo(0.25, 10);
    expect(
      commissionPaidOnSettledBet(bet({ betType: "lay_only", status: "half_lose", layStake: 25 }))
    ).toBeCloseTo(0.25, 10);
  });

  it("EW fallback (no meta) placed-not-won: bookie paid AND lay won — 12 × 0.02 = £0.24", () => {
    // racing-settlement falls back to settleFromOutcome(bet, won, paid = won || placed);
    // placed-only keeps status "won" but the single lay WINS, marked in the explanation.
    const notes = "Back side won, lay side won";
    expect(
      commissionPaidOnSettledBet(
        bet({ market: "each_way", status: "won", layStake: 12, notes })
      )
    ).toBeCloseTo(0.24, 10);
    // A genuine win keeps "lay side lost" - no commission.
    expect(
      commissionPaidOnSettledBet(
        bet({ market: "each_way", status: "won", layStake: 12, notes: "Back side won, lay side lost" })
      )
    ).toBe(0);
  });

  it("zero lay stake or zero commission pays nothing", () => {
    expect(commissionPaidOnSettledBet(bet({ layStake: 0 }))).toBe(0);
    expect(commissionPaidOnSettledBet(bet({ commission: 0 }))).toBe(0);
  });

  describe("each-way dual lay (meta in notes)", () => {
    const notes = serializeEwMeta(EW_META);

    it("unplaced (status lost): both lays won — (10 + 8) × 0.02 = £0.36", () => {
      expect(
        commissionPaidOnSettledBet(
          bet({ market: "extra_place", status: "lost", notes })
        )
      ).toBeCloseTo(0.36, 10);
    });

    it("standard place: win lay won only — 10 × 0.02 = £0.20", () => {
      const settled = `${notes} | Finished in standard place (2) - place back paid, win lay won, place lay lost`;
      expect(
        commissionPaidOnSettledBet(
          bet({ market: "extra_place", status: "won", notes: settled })
        )
      ).toBeCloseTo(0.2, 10);
    });

    it("extra place: both lays won — (10 + 8) × 0.02 = £0.36", () => {
      const settled = `${notes} | Extra place (4 of 4) - place back paid, both lays won`;
      expect(
        commissionPaidOnSettledBet(
          bet({ market: "extra_place", status: "won", notes: settled })
        )
      ).toBeCloseTo(0.36, 10);
    });

    it("horse won: both lays lost — no commission", () => {
      const settled = `${notes} | Horse won - bookie win+place paid, both lays lost`;
      expect(
        commissionPaidOnSettledBet(
          bet({ market: "extra_place", status: "won", notes: settled })
        )
      ).toBe(0);
    });

    it("won with no settlement marker (manual settle): commission unknown, counts 0", () => {
      expect(
        commissionPaidOnSettledBet(
          bet({ market: "extra_place", status: "won", notes })
        )
      ).toBe(0);
    });
  });
});
