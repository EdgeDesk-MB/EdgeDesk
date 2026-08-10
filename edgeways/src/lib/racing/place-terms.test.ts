import { describe, expect, it } from "vitest";
import { inferIsHandicap, ukPlaceTerms } from "./place-terms";

describe("ukPlaceTerms", () => {
  it("win-only for tiny fields", () => {
    expect(ukPlaceTerms(4)).toEqual({ places: 1, placeFraction: null, isHandicap: false });
  });

  it("5–7 → 2 places at 1/4", () => {
    expect(ukPlaceTerms(6).places).toBe(2);
    expect(ukPlaceTerms(6).placeFraction).toBe(0.25);
  });

  it("8+ non-handicap → 3 at 1/5", () => {
    expect(ukPlaceTerms(10)).toMatchObject({ places: 3, placeFraction: 0.2, isHandicap: false });
    expect(ukPlaceTerms(20, { isHandicap: false })).toMatchObject({
      places: 3,
      placeFraction: 0.2,
    });
  });

  it("12–15 handicap → 3 at 1/4", () => {
    expect(ukPlaceTerms(14, { isHandicap: true })).toMatchObject({
      places: 3,
      placeFraction: 0.25,
      isHandicap: true,
    });
  });

  it("16+ handicap → 4 at 1/4", () => {
    expect(ukPlaceTerms(16, { isHandicap: true })).toMatchObject({
      places: 4,
      placeFraction: 0.25,
    });
  });

  it("infers handicap from race type / name", () => {
    expect(inferIsHandicap({ type: "Flat Handicap" })).toBe(true);
    expect(inferIsHandicap({ raceName: "0-85 Hcap" })).toBe(true);
    expect(inferIsHandicap({ type: "Novice Hurdle" })).toBe(false);
    expect(ukPlaceTerms(16, { type: "Handicap Hurdle" }).places).toBe(4);
  });
});
