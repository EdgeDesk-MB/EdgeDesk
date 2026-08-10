import { describe, expect, it } from "vitest";
import { emptyLegCountFromPrefill } from "./acca-run-prefill";

describe("emptyLegCountFromPrefill", () => {
  it("defaults to 3 legs", () => {
    expect(emptyLegCountFromPrefill(null)).toBe(3);
    expect(emptyLegCountFromPrefill(undefined)).toBe(3);
  });

  it("uses minSelections clamped to 2–12", () => {
    expect(
      emptyLegCountFromPrefill({
        offerId: 1,
        label: "x",
        stake: 10,
        minSelections: 5,
      })
    ).toBe(5);
    expect(
      emptyLegCountFromPrefill({
        offerId: 1,
        label: "x",
        stake: 10,
        minSelections: 1,
      })
    ).toBe(2);
    expect(
      emptyLegCountFromPrefill({
        offerId: 1,
        label: "x",
        stake: 10,
        minSelections: 20,
      })
    ).toBe(12);
  });
});
