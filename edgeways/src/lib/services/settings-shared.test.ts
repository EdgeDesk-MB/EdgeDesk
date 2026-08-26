import { describe, expect, it } from "vitest";
import {
  DEFAULT_TUNING,
  normalizeAgeConfirmedAt,
  normalizeMobileDeckPin,
  normalizeTuning,
} from "./settings-shared";

describe("normalizeMobileDeckPin", () => {
  it("keeps known pins and remaps a leftover chart pin to Summary", () => {
    expect(normalizeMobileDeckPin("auto")).toBe("auto");
    expect(normalizeMobileDeckPin("hero")).toBe("hero");
    expect(normalizeMobileDeckPin("do-next")).toBe("do-next");
    expect(normalizeMobileDeckPin("chart")).toBe("hero");
    expect(normalizeMobileDeckPin("nope")).toBe("auto");
    expect(normalizeMobileDeckPin(undefined)).toBe("auto");
  });
});

describe("normalizeAgeConfirmedAt", () => {
  it("treats missing, empty and garbage as unconfirmed", () => {
    expect(normalizeAgeConfirmedAt(undefined)).toBeNull();
    expect(normalizeAgeConfirmedAt(null)).toBeNull();
    expect(normalizeAgeConfirmedAt("")).toBeNull();
    expect(normalizeAgeConfirmedAt("nonsense")).toBeNull();
    expect(normalizeAgeConfirmedAt("0")).toBeNull();
    expect(normalizeAgeConfirmedAt("-5")).toBeNull();
  });

  it("parses a stored ms epoch", () => {
    expect(normalizeAgeConfirmedAt("1754870400000")).toBe(1754870400000);
  });
});

describe("normalizeTuning", () => {
  it("returns exact defaults for missing or garbage input", () => {
    expect(normalizeTuning(undefined)).toEqual(DEFAULT_TUNING);
    expect(normalizeTuning(null)).toEqual(DEFAULT_TUNING);
    expect(normalizeTuning("nonsense")).toEqual(DEFAULT_TUNING);
    expect(normalizeTuning({ nakedExposureMinutes: "not a number" })).toEqual(DEFAULT_TUNING);
  });

  it("defaults reproduce the previously hardcoded behaviour", () => {
    // Guard: if any of these change, every consumer's behaviour changes too.
    expect(DEFAULT_TUNING).toEqual({
      nakedExposureMinutes: 10,
      nakedImminentMinutes: 3,
      droughtNudgeDays: 40,
      retentionPrior: 0.8,
      retentionPriorWeight: 5,
      mistakeCapturePct: 0.9,
      edgeReportMinCampaigns: 5,
      effortMinutes: {},
    });
  });

  it("clamps every numeric field to its range", () => {
    const t = normalizeTuning({
      nakedExposureMinutes: 0,
      nakedImminentMinutes: -5,
      droughtNudgeDays: 9999,
      retentionPrior: 1.4,
      retentionPriorWeight: -1,
      mistakeCapturePct: -0.2,
      edgeReportMinCampaigns: 2.6,
    });
    expect(t.nakedExposureMinutes).toBe(1);
    expect(t.nakedImminentMinutes).toBe(0);
    expect(t.droughtNudgeDays).toBe(365);
    expect(t.retentionPrior).toBe(1);
    expect(t.retentionPriorWeight).toBe(0);
    expect(t.mistakeCapturePct).toBe(0);
    // Whole campaigns only
    expect(t.edgeReportMinCampaigns).toBe(3);
  });

  it("keeps only positive finite effort-minute overrides", () => {
    const t = normalizeTuning({
      effortMinutes: {
        place_qualifying: 12,
        start_planned: 0,
        convert_free_bet: -3,
        review_expiry: "junk",
        orphan_free_bet: 9999,
      },
    });
    expect(t.effortMinutes).toEqual({ place_qualifying: 12 });
  });
});
