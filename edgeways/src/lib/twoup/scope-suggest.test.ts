import { describe, expect, it } from "vitest";
import { inferEpScopeFromOfferCopy, shouldProposeBookieScope } from "./scope-suggest";

describe("inferEpScopeFromOfferCopy", () => {
  it("reads 2UP and 1UP from the title", () => {
    expect(
      inferEpScopeFromOfferCopy({ bookie: "Coral", title: "2UP on Premier League" })
    ).toEqual({
      bookie: "Coral",
      sport: "football",
      leadBy: 2,
      reason: "The offer copy names 2UP.",
    });
    expect(inferEpScopeFromOfferCopy({ bookie: "Betano", title: "1-up early pay" })?.leadBy).toBe(
      1
    );
  });

  it("reads a lead unit and does not guess basketball as five", () => {
    expect(
      inferEpScopeFromOfferCopy({
        bookie: "bet365",
        title: "Pays 5 runs ahead",
        sport: "baseball",
      })
    ).toMatchObject({ sport: "baseball", leadBy: 5 });
    expect(
      inferEpScopeFromOfferCopy({
        bookie: "bet365",
        title: "Early payout on NBA",
        sport: "basketball",
      })
    ).toMatchObject({ sport: "basketball", leadBy: 1 });
    expect(inferEpScopeFromOfferCopy({ bookie: "Coral", title: "Acca insurance" })).toBeNull();
    expect(
      inferEpScopeFromOfferCopy({
        bookie: "bet365",
        title: "Pays 2 sets ahead",
        sport: "darts",
      })
    ).toMatchObject({ sport: "darts", leadBy: 2 });
  });
});

describe("shouldProposeBookieScope", () => {
  it("asks when the rule is missing or the lead differs", () => {
    const setup = {
      scopes: [
        { bookie: "Coral", surface: "early_payout" as const, sport: "football" as const, leadBy: 2 },
      ],
    };
    expect(
      shouldProposeBookieScope(setup, { bookie: "10Bet", sport: "football", leadBy: 2 })
    ).toBe(true);
    expect(
      shouldProposeBookieScope(setup, { bookie: "Coral", sport: "football", leadBy: 2 })
    ).toBe(false);
    expect(
      shouldProposeBookieScope(setup, { bookie: "Coral", sport: "football", leadBy: 1 })
    ).toBe(true);
  });
});
