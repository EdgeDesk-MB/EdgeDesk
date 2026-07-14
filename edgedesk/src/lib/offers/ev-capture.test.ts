import { describe, expect, it } from "vitest";
import { captureSummary, formatCaptureLine } from "./ev-capture";
import type { EvSnapshotRow } from "./ev-capture";

function snap(over: Partial<EvSnapshotRow> = {}): EvSnapshotRow {
  return {
    id: 1,
    offerId: 1,
    version: 1,
    lockedAt: Date.now(),
    expectedProfit: 14.2,
    basis: "estimated",
    inputsJson: null,
    realizedProfit: null,
    capturePct: null,
    commissionDrag: null,
    settledAt: null,
    mistakeTag: null,
    ...over,
  };
}

describe("captureSummary", () => {
  it("returns null for empty snapshots", () => {
    expect(captureSummary([])).toBeNull();
  });

  it("returns the highest-version snapshot", () => {
    const result = captureSummary([
      snap({ version: 1, expectedProfit: 14.2 }),
      snap({ id: 2, version: 2, expectedProfit: 18.0 }),
    ]);
    expect(result?.version).toBe(2);
    expect(result?.expectedProfit).toBe(18.0);
  });

  it("reflects settled fill-in data", () => {
    const result = captureSummary([
      snap({ version: 1, expectedProfit: 14.2, realizedProfit: 11.8, capturePct: 0.83, settledAt: Date.now() }),
    ]);
    expect(result?.capturePct).toBeCloseTo(0.83);
    expect(result?.realizedProfit).toBe(11.8);
  });
});

describe("formatCaptureLine", () => {
  it("returns null when capturePct is not set", () => {
    const result = captureSummary([snap()]);
    expect(formatCaptureLine(result!)).toBeNull();
  });

  it("formats a settled post-mortem line", () => {
    const summary = captureSummary([
      snap({ expectedProfit: 14.2, realizedProfit: 11.8, capturePct: 0.83, settledAt: Date.now() }),
    ])!;
    const line = formatCaptureLine(summary);
    expect(line).toContain("14.20");
    expect(line).toContain("11.80");
    expect(line).toContain("83%");
  });

  it("handles div-by-zero when expectedProfit is near zero", () => {
    const summary = captureSummary([
      snap({ expectedProfit: 0, realizedProfit: 5, capturePct: null, settledAt: Date.now() }),
    ])!;
    // capturePct is null → formatCaptureLine returns null
    expect(formatCaptureLine(summary)).toBeNull();
  });
});
