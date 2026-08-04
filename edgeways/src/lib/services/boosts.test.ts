import { describe, expect, it } from "vitest";
import { db, bets } from "@/lib/db";
import {
  countBoostsNeedingAction,
  createBoostDiary,
  linkBoostDiaryBet,
  listBoostDiary,
  settleBoostDiary,
  unlinkBoostDiaryForBet,
} from "@/lib/services/boosts";
import { filterBoostDiaryByQueue } from "@/lib/services/boosts-client";
import { ledgerBetPlacement } from "@/lib/services/balances";

function seedBet(overrides: Partial<typeof bets.$inferInsert> = {}) {
  return db
    .insert(bets)
    .values({
      label: "Salah ATG boost",
      market: "anytime_scorer",
      selection: "home",
      betType: "boost",
      bookmaker: "Sky Bet",
      backStake: 10,
      backOdds: 3,
      layStake: 9.74,
      layOdds: 3.1,
      commission: 0.02,
      status: "open",
      createdAt: Date.now(),
      ...overrides,
    })
    .returning()
    .get();
}

describe("boosts service (J2b)", () => {
  it("create diary starts Logged with no betId", () => {
    const row = createBoostDiary({
      label: "Test boost",
      kind: "boost",
      boostedOdds: 3,
      fairOdds: 2.7,
      stake: 10,
      evGbp: 1.11,
      basis: "estimated",
      layStake: 9.5,
      layOdds: 2.8,
      commission: 0.02,
    });
    expect(row.betId).toBeNull();
    expect(row.layStake).toBe(9.5);
    const listed = listBoostDiary();
    expect(listed[0]?.stage).toBe("logged");
    expect(filterBoostDiaryByQueue(listed, "logged")).toHaveLength(1);
    expect(filterBoostDiaryByQueue(listed, "placed")).toHaveLength(0);
  });

  it("link + settle updates bet and diary; Logged-only settle is rejected", () => {
    const diary = createBoostDiary({
      label: "Linked boost",
      kind: "boost",
      boostedOdds: 3,
      fairOdds: 2.7,
      stake: 10,
      evGbp: 1,
      basis: "estimated",
    });
    const rejected = settleBoostDiary(diary.id, "won");
    expect("error" in rejected).toBe(true);

    const bet = seedBet();
    ledgerBetPlacement(bet);
    linkBoostDiaryBet(diary.id, bet.id);

    const afterLink = listBoostDiary().find((e) => e.id === diary.id);
    expect(afterLink?.stage).toBe("placed");
    expect(afterLink?.linkedBet?.id).toBe(bet.id);

    const settled = settleBoostDiary(diary.id, "won");
    expect("error" in settled).toBe(false);
    if ("error" in settled) return;
    expect(settled.bet.status).toBe("won");
    expect(settled.entry.outcome).toBe("won");
    expect(settled.entry.actualProfit).toBeCloseTo(settled.bet.actualProfit ?? 0, 2);
  });

  it("deleting a bet unlinks the diary back to Logged", () => {
    const diary = createBoostDiary({
      label: "Unlink me",
      kind: "boost",
      boostedOdds: 2.5,
      fairOdds: 2.2,
      stake: 5,
      evGbp: 0.5,
      basis: "estimated",
    });
    const bet = seedBet({ label: "Unlink me" });
    linkBoostDiaryBet(diary.id, bet.id);
    unlinkBoostDiaryForBet(bet.id);
    const listed = listBoostDiary().find((e) => e.id === diary.id);
    expect(listed?.betId).toBeNull();
    expect(listed?.stage).toBe("logged");
  });

  it("countBoostsNeedingAction counts Logged and open Placed", () => {
    createBoostDiary({
      label: "Open log",
      kind: "boost",
      boostedOdds: 2,
      fairOdds: 1.9,
      stake: 5,
      evGbp: 0.2,
      basis: "estimated",
    });
    const diary = createBoostDiary({
      label: "Open placed",
      kind: "boost",
      boostedOdds: 2,
      fairOdds: 1.9,
      stake: 5,
      evGbp: 0.2,
      basis: "estimated",
    });
    const bet = seedBet({ label: "Open placed" });
    linkBoostDiaryBet(diary.id, bet.id);
    expect(countBoostsNeedingAction()).toBeGreaterThanOrEqual(2);
  });
});
