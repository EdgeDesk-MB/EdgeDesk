import { describe, expect, it } from "vitest";
import {
  canOpenFootballEpModel,
  earlyPayoutOfferLabel,
  isTwoUpBet,
  parseTwoUpDeskView,
} from "./desk-view";
import type { EpBookieSetup } from "./bookie-offers";

describe("parseTwoUpDeskView", () => {
  it("defaults to fixtures and accepts the desk tiles", () => {
    expect(parseTwoUpDeskView(null)).toBe("fixtures");
    expect(parseTwoUpDeskView("picks")).toBe("picks");
    expect(parseTwoUpDeskView("mystery")).toBe("fixtures");
  });
});

describe("isTwoUpBet", () => {
  it("treats the early-payout flag, market, and common labels as desk bets", () => {
    expect(isTwoUpBet({ earlyPayout: 1 })).toBe(true);
    expect(isTwoUpBet({ market: "two_up" })).toBe(true);
    expect(isTwoUpBet({ label: "2UP dutch: Arsenal / Chelsea" })).toBe(true);
    expect(isTwoUpBet({ label: "Qualifier", market: "match_odds" })).toBe(false);
  });
});

describe("earlyPayoutOfferLabel", () => {
  it("keeps 2UP/1UP for football and explicit labels, not other sports", () => {
    expect(earlyPayoutOfferLabel({ market: "two_up" }, "baseball")).toBe("2UP");
    expect(earlyPayoutOfferLabel({ label: "1UP home" }, "football")).toBe("1UP");
    expect(earlyPayoutOfferLabel({ label: "away" }, "football")).toBe("2UP");
    expect(earlyPayoutOfferLabel({ label: "away" }, "baseball")).toBe("Early payout");
    expect(earlyPayoutOfferLabel({ label: "away" })).toBe("Early payout");
  });

  it("uses the bookie scope when the sport is not football 2UP or 1UP", () => {
    const setup: EpBookieSetup = {
      scopes: [{ bookie: "bet365", sport: "baseball", leadBy: 5 }],
    };
    expect(
      earlyPayoutOfferLabel({ bookmaker: "bet365", label: "Yankees" }, "baseball", setup)
    ).toBe("5 runs ahead");
    expect(
      earlyPayoutOfferLabel({ bookmaker: "Coral", label: "Yankees" }, "baseball", setup)
    ).toBe("Early payout");
  });
});

describe("canOpenFootballEpModel", () => {
  it("opens the model for football or an unknown sport, not baseball", () => {
    expect(canOpenFootballEpModel("football")).toBe(true);
    expect(canOpenFootballEpModel(null)).toBe(true);
    expect(canOpenFootballEpModel("baseball")).toBe(false);
  });
});
