import { describe, expect, it } from "vitest";
import {
  racingOfferBetLabel,
  stripStaleHorseFromRacingBetLabel,
  syncRacingBetLabelOnSelectionChange,
} from "./racing-bet-label";

const OFFER = "Bet £10 get £10 free bet (2nd–4th)";

describe("racingOfferBetLabel", () => {
  it("is course · offer, with no runner", () => {
    expect(racingOfferBetLabel("Kilbeggan", OFFER)).toBe(`Kilbeggan · ${OFFER}`);
  });
});

describe("stripStaleHorseFromRacingBetLabel", () => {
  it("drops an ignored edge-pick favourite when another horse was backed", () => {
    expect(
      stripStaleHorseFromRacingBetLabel(`Kilbeggan · Fou De Toi · ${OFFER}`, "Los Blanco")
    ).toBe(`Kilbeggan · ${OFFER}`);
  });

  it("keeps the runner when it is the selection", () => {
    expect(
      stripStaleHorseFromRacingBetLabel(`Kilbeggan · Fou De Toi · ${OFFER}`, "Fou De Toi")
    ).toBe(`Kilbeggan · Fou De Toi · ${OFFER}`);
  });

  it("treats country-suffix spelling as the same horse", () => {
    expect(
      stripStaleHorseFromRacingBetLabel(
        `Kilbeggan · Fou De Toi (IRE) · ${OFFER}`,
        "Fou De Toi"
      )
    ).toBe(`Kilbeggan · Fou De Toi (IRE) · ${OFFER}`);
  });

  it("leaves course · off-time labels alone", () => {
    expect(
      stripStaleHorseFromRacingBetLabel("Kilbeggan · 18:15", "Los Blanco")
    ).toBe("Kilbeggan · 18:15");
  });

  it("does not strip a clock from a three-part offer label", () => {
    expect(
      stripStaleHorseFromRacingBetLabel(`Goodwood · 13:50 · ${OFFER}`, "Los Blanco")
    ).toBe(`Goodwood · 13:50 · ${OFFER}`);
  });

  it("leaves non-racing titles alone", () => {
    expect(stripStaleHorseFromRacingBetLabel("Qualify · Bet365", "Home")).toBe(
      "Qualify · Bet365"
    );
  });
});

describe("syncRacingBetLabelOnSelectionChange", () => {
  it("strips the old horse from a course · horse · offer title", () => {
    expect(
      syncRacingBetLabelOnSelectionChange(
        `Kilbeggan · Fou De Toi · ${OFFER}`,
        "Fou De Toi",
        "Los Blanco"
      )
    ).toBe(`Kilbeggan · ${OFFER}`);
  });

  it("rewrites the horse in an each-way title", () => {
    expect(
      syncRacingBetLabelOnSelectionChange(
        "Kilbeggan · Fou De Toi EW",
        "Fou De Toi",
        "Los Blanco"
      )
    ).toBe("Kilbeggan · Los Blanco EW");
  });

  it("rewrites extra-place titles that suffix the horse", () => {
    expect(
      syncRacingBetLabelOnSelectionChange(
        "Kilbeggan · Fou De Toi EP 4p",
        "Fou De Toi",
        "Los Blanco"
      )
    ).toBe("Kilbeggan · Los Blanco EP 4p");
  });
});
