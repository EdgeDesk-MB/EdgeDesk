import { describe, expect, it } from "vitest";
import { neonOfferRecurrenceMeta } from "@/lib/db/neon-desk-offer-series";
import type { OfferSeriesRow } from "@/lib/db/schema";

const series = (over: Partial<OfferSeriesRow> = {}): OfferSeriesRow => ({
  id: 4,
  recurrenceEnabled: 1,
  recurrenceStoppedFrom: null,
  skippedDatesJson: null,
  ruleJson: JSON.stringify({ freq: "daily", interval: 1 }),
  templateExpiresAt: null,
  horizonDays: 14,
  bookmaker: "Bet365",
  title: "Daily",
  description: null,
  expectedProfit: 2,
  sport: "football",
  offerType: null,
  scopeCourse: null,
  scopeRaceId: null,
  scopeRaceLabel: null,
  rules: null,
  offerUrl: null,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe("neonOfferRecurrenceMeta", () => {
  it("returns null without a series", () => {
    expect(neonOfferRecurrenceMeta({ seriesId: 4, instanceDate: "2026-08-30" }, null)).toBeNull();
    expect(neonOfferRecurrenceMeta({ seriesId: null, instanceDate: null }, series())).toBeNull();
  });

  it("exposes the clerk-owned series rule", () => {
    const meta = neonOfferRecurrenceMeta(
      { seriesId: 4, instanceDate: "2026-08-30" },
      series()
    );
    expect(meta).toMatchObject({
      seriesId: 4,
      enabled: true,
      instanceDate: "2026-08-30",
      rule: { freq: "daily", interval: 1 },
    });
  });
});
