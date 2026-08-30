import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfferSummary } from "@/lib/services/offers.types";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  rows: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mocks.rows),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.inserts.push(values);
        mocks.rows.push({
          id: mocks.rows.length + 1,
          realizedProfit: null,
          capturePct: null,
          commissionDrag: null,
          settledAt: null,
          mistakeTag: null,
          ...values,
        });
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          mocks.updates.push(values);
          const latest = mocks.rows.at(-1);
          if (latest) Object.assign(latest, values);
          return Promise.resolve();
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/offers/advantage", () => ({
  estimateOfferRemainingEv: () => ({ remainingEv: 6.4, basis: "estimated" }),
}));

import {
  fillNeonSettlementSnapshot,
  setNeonMistakeTag,
  writeNeonEvLock,
} from "@/lib/db/neon-desk-ev-snapshots";

function offer(id = 9): OfferSummary {
  return {
    id,
    bookmaker: "Bet365",
    title: "Bet £10 get £10",
    description: null,
    expectedProfit: 8,
    status: "active",
    expiresAt: null,
    createdAt: 1,
    completedAt: null,
    startsOn: null,
    sport: "football",
    offerType: null,
    scopeCourse: null,
    eventDate: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    rules: null,
    seriesId: null,
    instanceDate: null,
    source: null,
    offerUrl: null,
    betCount: 1,
    openBets: 0,
    actualProfit: 0,
    expectedFromBets: 8,
    profit: {
      qualifyingProfit: 0,
      qualifyingSettledCount: 0,
      qualifyingOpenCount: 1,
      freeBetAwarded: false,
      freeBetAwardAmount: 10,
      freeBetAwardReason: null,
      freeBetStage: "awaiting_result",
      freeBetProfit: 0,
      freeBetOpenCount: 0,
      freeBetSettledCount: 0,
      openExpectedProfit: 8,
      totalProfit: 0,
    },
  };
}

describe("writeNeonEvLock", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.rows = [];
    mocks.inserts = [];
    mocks.updates = [];
  });

  it("writes version 1 with the remaining-EV estimate", async () => {
    const version = await writeNeonEvLock(offer());
    expect(version).toBe(1);
    expect(mocks.inserts[0]).toMatchObject({
      offerId: 9,
      version: 1,
      expectedProfit: 6.4,
      basis: "estimated",
      clerkUserId: "user_live",
    });
    expect(String(mocks.inserts[0]?.inputsJson)).toContain("freeBetAmount");
  });

  it("skips a second lock when onlyIfUnlocked is set", async () => {
    await writeNeonEvLock(offer());
    const again = await writeNeonEvLock(offer(), { onlyIfUnlocked: true });
    expect(again).toBeNull();
    expect(mocks.inserts).toHaveLength(1);
  });

  it("does not lock again after settlement", async () => {
    await writeNeonEvLock(offer());
    await fillNeonSettlementSnapshot(9, 7.2, 0.1);
    const again = await writeNeonEvLock(offer());
    expect(again).toBeNull();
    expect(mocks.inserts).toHaveLength(1);
  });
});

describe("fillNeonSettlementSnapshot", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.rows = [];
    mocks.inserts = [];
    mocks.updates = [];
  });

  it("fills capture on the latest unlocked snapshot", async () => {
    await writeNeonEvLock(offer(), { expectedProfit: 8 });
    await fillNeonSettlementSnapshot(9, 6, 0.2);
    expect(mocks.updates[0]).toMatchObject({
      realizedProfit: 6,
      commissionDrag: 0.2,
      capturePct: 0.75,
    });
    expect(mocks.updates[0]?.settledAt).toEqual(expect.any(Number));
  });

  it("is a no-op when the latest snapshot is already settled", async () => {
    await writeNeonEvLock(offer(), { expectedProfit: 8 });
    await fillNeonSettlementSnapshot(9, 6, 0);
    await fillNeonSettlementSnapshot(9, 99, 0);
    expect(mocks.updates).toHaveLength(1);
  });
});

describe("setNeonMistakeTag", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.rows = [];
    mocks.inserts = [];
    mocks.updates = [];
  });

  it("refuses to tag an unsettled lock", async () => {
    await writeNeonEvLock(offer(), { expectedProfit: 8 });
    const ok = await setNeonMistakeTag(9, "laid_late");
    expect(ok).toBe(false);
    expect(mocks.updates).toHaveLength(0);
  });

  it("tags the latest settled snapshot", async () => {
    await writeNeonEvLock(offer(), { expectedProfit: 8 });
    await fillNeonSettlementSnapshot(9, 6, 0);
    const ok = await setNeonMistakeTag(9, "laid_late");
    expect(ok).toBe(true);
    expect(mocks.updates.at(-1)).toMatchObject({ mistakeTag: "laid_late" });
  });

  it("clears a tag with null", async () => {
    await writeNeonEvLock(offer(), { expectedProfit: 8 });
    await fillNeonSettlementSnapshot(9, 6, 0);
    await setNeonMistakeTag(9, "odds_moved");
    const ok = await setNeonMistakeTag(9, null);
    expect(ok).toBe(true);
    expect(mocks.updates.at(-1)).toMatchObject({ mistakeTag: null });
  });
});
