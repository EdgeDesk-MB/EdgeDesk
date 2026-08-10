import { describe, expect, it } from "vitest";
import {
  extraPlaceMinRunnersWarning,
  minRunnersForExtraPlace,
  nearExtraPlaceMinRunners,
} from "./extra-place-min-runners";

describe("extra-place-min-runners", () => {
  it("defaults 5p→16, 4p→12, 3p→7", () => {
    expect(minRunnersForExtraPlace(5)).toBe(16);
    expect(minRunnersForExtraPlace(4)).toBe(12);
    expect(minRunnersForExtraPlace(3)).toBe(7);
  });

  it("Bet365 is more generous on 5p/4p", () => {
    expect(minRunnersForExtraPlace(5, "Bet365")).toBe(15);
    expect(minRunnersForExtraPlace(4, "Bet365")).toBe(11);
  });

  it("warns when below or near minimum", () => {
    expect(extraPlaceMinRunnersWarning(14, 5, "Coral")).toMatch(/need 16/);
    expect(extraPlaceMinRunnersWarning(17, 5, "Coral")).toMatch(/close to/);
    expect(extraPlaceMinRunnersWarning(20, 5, "Coral")).toBeNull();
    expect(nearExtraPlaceMinRunners(17, 5)).toBe(true);
    expect(nearExtraPlaceMinRunners(20, 5)).toBe(false);
  });
});
