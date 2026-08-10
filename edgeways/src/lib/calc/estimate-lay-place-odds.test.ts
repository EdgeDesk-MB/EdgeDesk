import { describe, expect, it } from "vitest";
import { estimateLayPlaceOdds } from "./estimate-lay-place-odds";

describe("estimateLayPlaceOdds", () => {
  it("seeds place lay above fair place odds from win terms", () => {
    expect(estimateLayPlaceOdds(11, 0.2)).toBe(3.24);
  });

  it("falls back when inputs invalid", () => {
    expect(estimateLayPlaceOdds(1, 0.2)).toBe(2.8);
    expect(estimateLayPlaceOdds(5, 0)).toBe(2.8);
  });
});
