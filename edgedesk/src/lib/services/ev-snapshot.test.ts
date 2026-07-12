import { describe, expect, it, beforeEach } from "vitest";
import { db, offers, bets } from "@/lib/db";
import {
  writeEvLock,
  fillSettlementSnapshot,
  getSnapshotsForOffer,
} from "./ev-snapshot";
import type { OfferSummary } from "@/lib/services/offers.types";

function makeOffer(over: Partial<{ expectedProfit: number | null; status: string }> = {}): OfferSummary {
  const now = Date.now();
  const row = db
    .insert(offers)
    .values({
      title: "Test offer",
      bookmaker: "Bet365",
      expectedProfit: over.expectedProfit ?? 10,
      status: (over.status ?? "active") as "active" | "planned" | "completed" | "expired",
      createdAt: now,
    })
    .returning()
    .get();
  return {
    ...row,
    betCount: 0,
    openBets: 0,
    actualProfit: 0,
    expectedFromBets: 0,
    profit: {
      qualifyingProfit: 0,
      qualifyingSettledCount: 0,
      qualifyingOpenCount: 0,
      freeBetAwarded: false,
      freeBetAwardAmount: null,
      freeBetAwardReason: null,
      freeBetStage: "none",
      freeBetProfit: 0,
      freeBetOpenCount: 0,
      freeBetSettledCount: 0,
      openExpectedProfit: 0,
      totalProfit: 0,
    },
  };
}

beforeEach(() => {
  // Clear between tests
  db.delete(offers).run();
  db.delete(bets).run();
});

describe("writeEvLock", () => {
  it("writes version 1 when no snapshot exists", () => {
    const offer = makeOffer({ expectedProfit: 14.2 });
    const v = writeEvLock(offer, { expectedProfit: 14.2 });
    expect(v).toBe(1);
    const snaps = getSnapshotsForOffer(offer.id);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].expectedProfit).toBe(14.2);
    expect(snaps[0].version).toBe(1);
  });

  it("writes version 2 when editing expectedProfit after lock", () => {
    const offer = makeOffer({ expectedProfit: 14.2 });
    writeEvLock(offer, { expectedProfit: 14.2 });
    const v2 = writeEvLock(offer, { expectedProfit: 18.0 });
    expect(v2).toBe(2);
    const snaps = getSnapshotsForOffer(offer.id);
    expect(snaps).toHaveLength(2);
    // v1 must be unchanged
    expect(snaps[0].expectedProfit).toBe(14.2);
    // v2 has new value
    expect(snaps[1].expectedProfit).toBe(18.0);
  });

  it("does not write a new version when already settled", () => {
    const offer = makeOffer({ expectedProfit: 14.2 });
    writeEvLock(offer, { expectedProfit: 14.2 });
    fillSettlementSnapshot(offer.id, 11.8, 0.2);

    const v = writeEvLock(offer, { expectedProfit: 99 });
    expect(v).toBeNull();
    const snaps = getSnapshotsForOffer(offer.id);
    expect(snaps).toHaveLength(1); // no new version
  });
});

describe("fillSettlementSnapshot", () => {
  it("fills realized profit and capture pct once", () => {
    const offer = makeOffer({ expectedProfit: 14.2 });
    writeEvLock(offer, { expectedProfit: 14.2 });
    fillSettlementSnapshot(offer.id, 11.8, 0.22);
    const snaps = getSnapshotsForOffer(offer.id);
    expect(snaps[0].realizedProfit).toBeCloseTo(11.8);
    // 11.8 / 14.2 ≈ 0.831
    expect(snaps[0].capturePct).toBeCloseTo(0.831, 2);
    expect(snaps[0].commissionDrag).toBeCloseTo(0.22);
    expect(snaps[0].settledAt).not.toBeNull();
  });

  it("is idempotent — does not overwrite settled_at", () => {
    const offer = makeOffer({ expectedProfit: 14.2 });
    writeEvLock(offer, { expectedProfit: 14.2 });
    fillSettlementSnapshot(offer.id, 11.8, 0.2);
    const first = getSnapshotsForOffer(offer.id)[0].settledAt;
    fillSettlementSnapshot(offer.id, 99, 0);
    const second = getSnapshotsForOffer(offer.id)[0].settledAt;
    expect(second).toBe(first);
    expect(getSnapshotsForOffer(offer.id)[0].realizedProfit).toBeCloseTo(11.8);
  });

  it("sets capturePct=null when expectedProfit is near zero (div-by-zero guard)", () => {
    const offer = makeOffer({ expectedProfit: 0 });
    writeEvLock(offer, { expectedProfit: 0 });
    fillSettlementSnapshot(offer.id, 5, 0);
    const snaps = getSnapshotsForOffer(offer.id);
    expect(snaps[0].capturePct).toBeNull();
  });

  it("clamps capturePct at 2× for display sanity", () => {
    const offer = makeOffer({ expectedProfit: 5 });
    writeEvLock(offer, { expectedProfit: 5 });
    fillSettlementSnapshot(offer.id, 100, 0); // massively over-performed
    const snaps = getSnapshotsForOffer(offer.id);
    expect(snaps[0].capturePct).toBe(2);
  });
});
