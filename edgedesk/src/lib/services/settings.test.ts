import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  bookmakerFromOfferPrefs,
  stakeFromOfferPrefs,
} from "./settings-shared";

describe("stakeFromOfferPrefs / bookmakerFromOfferPrefs", () => {
  it("prefers remembered stake over rules and fallback", () => {
    const prefs = { "5": { stake: 12.5, bookmaker: "Coral" } };
    expect(stakeFromOfferPrefs(prefs, 5, 25, 10)).toBe(12.5);
    expect(stakeFromOfferPrefs({}, 5, 25, 10)).toBe(25);
    expect(stakeFromOfferPrefs({}, undefined, null, 10)).toBe(10);
    expect(stakeFromOfferPrefs({}, undefined, 0, 0)).toBe(DEFAULT_SETTINGS.defaultBackStake);
  });

  it("prefers remembered bookmaker", () => {
    const prefs = { "5": { stake: 10, bookmaker: "Sky Bet" } };
    expect(bookmakerFromOfferPrefs(prefs, 5, "Bet365", "Coral")).toBe("Sky Bet");
    expect(bookmakerFromOfferPrefs({}, 5, "Bet365", "Coral")).toBe("Bet365");
    expect(bookmakerFromOfferPrefs({}, undefined, null, "Coral")).toBe("Coral");
  });
});
