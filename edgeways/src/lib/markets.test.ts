import { describe, expect, it } from "vitest";
import {
  capitaliseSelectionLabel,
  formatBetSelection,
  inferSportFromBet,
  isEarlyPayoutMarket,
  linkableEventsForSport,
  marketDef,
  marketUsesLinkedEventSides,
} from "./markets";

describe("inferSportFromBet", () => {
  it("prefers the linked event sport", () => {
    expect(inferSportFromBet("match_winner", "cricket", "tennis")).toBe("cricket");
  });

  it("uses the offer sport when there is no linked event", () => {
    expect(inferSportFromBet("match_winner", null, "cricket")).toBe("cricket");
  });

  it("prefers denormalised bet sport over offer sport", () => {
    expect(inferSportFromBet("other", null, "football", "horse_racing")).toBe(
      "horse_racing"
    );
  });

  it("falls back to market catalogues", () => {
    expect(inferSportFromBet("win")).toBe("horse_racing");
    expect(inferSportFromBet("match_winner")).toBe("tennis");
    expect(inferSportFromBet("btts")).toBe("football");
  });
});

describe("isEarlyPayoutMarket", () => {
  it("allows only the sport's match-winner market", () => {
    expect(isEarlyPayoutMarket("football", "match_odds")).toBe(true);
    expect(isEarlyPayoutMarket("football", "btts")).toBe(false);
    expect(isEarlyPayoutMarket("tennis", "match_winner")).toBe(true);
    expect(isEarlyPayoutMarket("darts", "match_winner")).toBe(true);
    expect(isEarlyPayoutMarket("darts", "correct_score")).toBe(false);
    expect(isEarlyPayoutMarket("tennis", "set_betting")).toBe(false);
    expect(isEarlyPayoutMarket("basketball", "match_winner")).toBe(true);
    expect(isEarlyPayoutMarket("basketball", "handicap")).toBe(false);
    expect(isEarlyPayoutMarket("horse_racing", "win")).toBe(false);
    expect(isEarlyPayoutMarket("horse_racing", "match_winner")).toBe(false);
    expect(isEarlyPayoutMarket("golf", "match_winner")).toBe(false);
    expect(isEarlyPayoutMarket("other", "match_winner")).toBe(false);
  });

  it("labels US-book winners as Moneyline", () => {
    expect(marketDef("basketball", "match_winner")?.label).toBe("Moneyline");
    expect(marketDef("baseball", "match_winner")?.label).toBe("Moneyline");
    expect(marketDef("american_football", "match_winner")?.label).toBe("Moneyline");
    expect(marketDef("ice_hockey", "match_winner")?.label).toBe("Moneyline");
    expect(marketDef("tennis", "match_winner")?.label).toBe("Match winner");
    expect(marketDef("football", "match_odds")?.label).toBe("Match odds");
  });
});

describe("marketUsesLinkedEventSides", () => {
  it("locks football match markets to the linked fixture sides", () => {
    expect(marketUsesLinkedEventSides("football", "match_odds")).toBe(true);
    expect(marketUsesLinkedEventSides("football", "draw_no_bet")).toBe(true);
    expect(marketUsesLinkedEventSides("football", "btts")).toBe(true);
    expect(marketUsesLinkedEventSides("football", "over_under_2_5")).toBe(true);
    expect(marketUsesLinkedEventSides("football", "correct_score")).toBe(true);
    expect(marketUsesLinkedEventSides("football", "first_goalscorer")).toBe(true);
  });

  it("leaves football Other editable so the sides are not assumed", () => {
    expect(marketUsesLinkedEventSides("football", "other")).toBe(false);
  });

  it("locks two-sided sports that pick home or away", () => {
    expect(marketUsesLinkedEventSides("tennis", "match_winner")).toBe(true);
    expect(marketUsesLinkedEventSides("rugby_union", "match_winner")).toBe(true);
  });

  it("does not lock racing or outright catalogues", () => {
    expect(marketUsesLinkedEventSides("horse_racing", "win")).toBe(false);
    expect(marketUsesLinkedEventSides("golf", "outright")).toBe(false);
    expect(marketUsesLinkedEventSides("greyhounds", "win")).toBe(false);
  });
});

describe("formatBetSelection", () => {
  it("shows Home / Draw / Away, not lowercase tokens", () => {
    expect(formatBetSelection("match_winner", "away")).toBe("Away");
    expect(formatBetSelection("match_odds", "home")).toBe("Home");
    expect(formatBetSelection("match_odds", "draw")).toBe("Draw");
    expect(formatBetSelection("btts", "yes")).toBe("Yes");
    expect(formatBetSelection("over_under_2_5", "over")).toBe("Over");
    expect(formatBetSelection("double_chance", "home/draw")).toBe("Home/Draw");
  });

  it("uses team names when the fixture is linked", () => {
    expect(formatBetSelection("match_odds", "home", "Everton", "Palace")).toBe(
      "Everton"
    );
    expect(formatBetSelection("match_winner", "away", "Yankees", "Red Sox")).toBe(
      "Red Sox"
    );
  });

  it("leaves horse names and free text alone", () => {
    expect(formatBetSelection("win", "Constitution Hill")).toBe("Constitution Hill");
    expect(capitaliseSelectionLabel("away")).toBe("Away");
  });
});

describe("linkableEventsForSport", () => {
  const events = [
    { id: 1, sport: "horse_racing", status: "scheduled" },
    { id: 2, sport: "horse_racing", status: "finished" },
    { id: 3, sport: "cricket", status: "scheduled" },
    { id: 4, sport: "cricket", status: "finished" },
    { id: 5, sport: "football", status: "live" },
  ];

  it("only returns events for the requested sport", () => {
    expect(linkableEventsForSport(events, "cricket").map((e) => e.id)).toEqual([3, 4]);
  });

  it("includes finished events for late linking in every sport", () => {
    expect(linkableEventsForSport(events, "horse_racing").map((e) => e.id)).toEqual([
      1, 2,
    ]);
    expect(linkableEventsForSport(events, "cricket").map((e) => e.id)).toEqual([3, 4]);
  });
});
