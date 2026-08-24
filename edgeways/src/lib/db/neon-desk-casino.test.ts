import { describe, expect, it } from "vitest";
import { summariseNeonCasinoOffers } from "@/lib/db/neon-desk-casino";
import type {
  CasinoOfferComponentRow,
  CasinoOfferRow,
  CasinoOfferSeriesRow,
} from "@/lib/db/schema";

function offer(
  partial: Partial<CasinoOfferRow> & Pick<CasinoOfferRow, "id" | "title">
): CasinoOfferRow {
  return {
    casino: "Dynobet",
    bonusAmount: 0,
    wageringMultiplier: 0,
    rtp: null,
    contributionPct: null,
    status: "active",
    expectedEv: 0,
    actualProfit: null,
    notes: null,
    game: null,
    expiresAt: null,
    seriesId: null,
    instanceDate: null,
    offerUrl: null,
    createdAt: 1_700_000_000_000,
    completedAt: null,
    ...partial,
  };
}

function component(
  partial: Partial<CasinoOfferComponentRow> &
    Pick<CasinoOfferComponentRow, "id" | "casinoOfferId" | "componentType">
): CasinoOfferComponentRow {
  return {
    amount: null,
    wageringMultiplier: null,
    rtp: 0.96,
    contributionPct: null,
    spins: null,
    spinValue: null,
    chipCount: null,
    chipValue: null,
    houseEdgePreset: null,
    cashbackPct: null,
    cashbackCap: null,
    game: null,
    eligibleGamesJson: null,
    expectedEv: 0,
    sortOrder: 0,
    createdAt: 1_700_000_000_000,
    ...partial,
  };
}

function series(
  partial: Partial<CasinoOfferSeriesRow> & Pick<CasinoOfferSeriesRow, "id" | "title">
): CasinoOfferSeriesRow {
  return {
    recurrenceEnabled: 1,
    recurrenceStoppedFrom: null,
    skippedDatesJson: null,
    ruleJson: JSON.stringify({ freq: "weekly", interval: 1 }),
    templateExpiresAt: null,
    horizonDays: 14,
    casino: "Dynobet",
    notes: null,
    offerUrl: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...partial,
  };
}

describe("summariseNeonCasinoOffers", () => {
  it("summarises offers with components, EV and basis, newest first", () => {
    const summaries = summariseNeonCasinoOffers({
      offers: [
        offer({ id: 1, title: "Older", createdAt: 1_700_000_000_000 }),
        offer({ id: 2, title: "Newer", createdAt: 1_700_000_100_000 }),
      ],
      series: [],
      components: [
        component({ id: 1, casinoOfferId: 2, componentType: "cash", amount: 10, expectedEv: 10, sortOrder: 1 }),
        component({ id: 2, casinoOfferId: 2, componentType: "qualifying_wager", amount: 20, expectedEv: -1.5, sortOrder: 0 }),
      ],
      seriesComponents: [],
      games: [],
    });
    expect(summaries.map((s) => s.title)).toEqual(["Newer", "Older"]);
    const newer = summaries[0]!;
    // Components sorted by sortOrder, EV summed from components.
    expect(newer.components.map((c) => c.id)).toEqual([2, 1]);
    expect(newer.expectedEv).toBe(8.5);
    expect(newer.evBasis).toBe("estimated");
    expect(newer.recurrence).toBeNull();
    expect(newer.reminders).toEqual([]);
  });

  it("flags heuristic basis when any component defaulted its RTP", () => {
    const summaries = summariseNeonCasinoOffers({
      offers: [offer({ id: 1, title: "A" })],
      series: [],
      components: [
        component({ id: 1, casinoOfferId: 1, componentType: "cash", amount: 5, rtp: null }),
      ],
      seriesComponents: [],
      games: [],
    });
    expect(summaries[0]!.evBasis).toBe("heuristic");
  });

  it("attaches recurrence meta from the restored series row without touching SQLite", () => {
    const summaries = summariseNeonCasinoOffers({
      offers: [offer({ id: 1, title: "Instance", seriesId: 9, instanceDate: "2026-08-24" })],
      series: [series({ id: 9, title: "Weekly spins" })],
      components: [],
      seriesComponents: [],
      games: [],
    });
    expect(summaries[0]!.recurrence?.seriesId).toBe(9);
  });

  it("leaves recurrence null when the series row is absent", () => {
    const summaries = summariseNeonCasinoOffers({
      offers: [offer({ id: 1, title: "Orphan", seriesId: 99 })],
      series: [],
      components: [],
      seriesComponents: [],
      games: [],
    });
    expect(summaries[0]!.recurrence).toBeNull();
  });
});
