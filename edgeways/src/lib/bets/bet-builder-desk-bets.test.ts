import { describe, expect, it } from "vitest";
import { isBetBuilderDeskBack, isBetBuilderDeskLay } from "./bet-builder-desk-bets";

describe("bet-builder-desk-bets helpers", () => {
  it("recognises Bet Builder Desk backs and lays", () => {
    expect(
      isBetBuilderDeskBack({
        label: "BB · Arsenal",
        notes: "Bet Builder desk - combined lay",
        betType: "qualifying",
      })
    ).toBe(true);
    expect(
      isBetBuilderDeskBack({
        label: "BB FB · Convert",
        notes: "Bet Builder desk free-bet convert - no lay",
        betType: "free_snr",
      })
    ).toBe(true);
    expect(
      isBetBuilderDeskBack({
        label: "BB · Arsenal",
        notes: null,
        betType: "qualifying",
      })
    ).toBe(false);
    expect(
      isBetBuilderDeskLay({ label: "BB lay · Arsenal", betType: "lay_only" })
    ).toBe(true);
  });
});
