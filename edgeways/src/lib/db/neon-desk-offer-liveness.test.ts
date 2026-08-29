import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BetRow, OfferRow } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  offers: [] as OfferRow[],
  bets: [] as BetRow[],
  patches: [] as Array<{ id: number; patch: Record<string, unknown> }>,
  locks: [] as number[],
  fills: [] as Array<{ offerId: number; profit: number }>,
  quieted: [] as number[],
}));

vi.mock("@/lib/db/neon-desk-offers", () => ({
  listNeonDeskOffers: async () => mocks.offers,
  patchNeonDeskOffer: async (id: number, patch: Record<string, unknown>) => {
    mocks.patches.push({ id, patch });
    const row = mocks.offers.find((o) => o.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  },
}));

vi.mock("@/lib/db/neon-desk", () => ({
  listNeonDeskBets: async () => mocks.bets,
}));

vi.mock("@/lib/db/neon-desk-accounts", () => ({
  listNeonDeskBalanceTransactions: async () => [],
}));

vi.mock("@/lib/db/neon-desk-ev-snapshots", () => ({
  writeNeonEvLock: async (offer: { id: number }) => {
    mocks.locks.push(offer.id);
    return 1;
  },
  fillNeonSettlementSnapshot: async (offerId: number, realizedProfit: number) => {
    mocks.fills.push({ offerId, profit: realizedProfit });
  },
}));

vi.mock("@/lib/services/quiet-alerts", () => ({
  quietOfferAlerts: (offerId: number) => {
    mocks.quieted.push(offerId);
  },
}));

import { syncNeonOfferStatuses } from "@/lib/db/neon-desk-offer-liveness";

function offer(partial: Partial<OfferRow> & Pick<OfferRow, "id" | "status">): OfferRow {
  return {
    bookmaker: "Bet365",
    title: "Bet £10 get £10",
    description: null,
    expectedProfit: 8,
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
    ...partial,
  };
}

function bet(partial: Partial<BetRow> & Pick<BetRow, "id" | "status" | "offerId">): BetRow {
  return {
    eventId: null,
    label: "Arsenal",
    market: "match_odds",
    selection: "home",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 10,
    backOdds: 2,
    layStake: 0,
    layOdds: 0,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    expectedProfit: 1,
    actualProfit: partial.status === "won" ? 1 : null,
    notes: null,
    balanceLedgered: 1,
    balanceSettled: partial.status === "open" ? 0 : 1,
    createdAt: 1,
    settledAt: partial.status === "open" ? null : 2,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: "football",
    importFingerprint: null,
    importMeta: null,
    ...partial,
  };
}

describe("syncNeonOfferStatuses", () => {
  beforeEach(() => {
    mocks.offers = [];
    mocks.bets = [];
    mocks.patches = [];
    mocks.locks = [];
    mocks.fills = [];
    mocks.quieted = [];
  });

  it("activates a planned campaign that already has a bet and locks EV", async () => {
    mocks.offers = [offer({ id: 3, status: "planned" })];
    mocks.bets = [bet({ id: 10, status: "open", offerId: 3 })];
    expect(await syncNeonOfferStatuses()).toBe(1);
    expect(mocks.patches[0]).toEqual({ id: 3, patch: { status: "active" } });
    expect(mocks.locks).toEqual([3]);
  });

  it("completes a settled campaign and fills the EV snapshot", async () => {
    mocks.offers = [offer({ id: 4, status: "active" })];
    mocks.bets = [bet({ id: 11, status: "won", offerId: 4, actualProfit: 1.2 })];
    expect(await syncNeonOfferStatuses()).toBe(1);
    expect(mocks.patches[0]?.patch).toMatchObject({ status: "completed" });
    expect(mocks.quieted).toEqual([4]);
    expect(mocks.fills[0]?.offerId).toBe(4);
  });

  it("does not complete while a linked bet is still open", async () => {
    mocks.offers = [offer({ id: 5, status: "active" })];
    mocks.bets = [bet({ id: 12, status: "open", offerId: 5 })];
    expect(await syncNeonOfferStatuses()).toBe(0);
    expect(mocks.patches).toEqual([]);
  });
});
