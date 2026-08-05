import { describe, expect, it } from "vitest";
import { casinoRequiredBalance } from "./required-balance";

describe("casinoRequiredBalance", () => {
  it("returns the first qualifying_wager amount by sortOrder", () => {
    expect(
      casinoRequiredBalance([
        { componentType: "bonus", amount: 50, sortOrder: 0 },
        { componentType: "qualifying_wager", amount: 20, sortOrder: 2 },
        { componentType: "qualifying_wager", amount: 10, sortOrder: 1 },
      ])
    ).toBe(10);
  });

  it("skips QW rows with null or zero amount", () => {
    expect(
      casinoRequiredBalance([
        { componentType: "qualifying_wager", amount: null, sortOrder: 0 },
        { componentType: "qualifying_wager", amount: 0, sortOrder: 1 },
        { componentType: "qualifying_wager", amount: 15, sortOrder: 2 },
      ])
    ).toBe(15);
  });

  it("returns null when there is no usable QW", () => {
    expect(
      casinoRequiredBalance([{ componentType: "free_spins", amount: null, sortOrder: 0 }])
    ).toBeNull();
  });
});
