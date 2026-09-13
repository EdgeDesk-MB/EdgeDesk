import { describe, expect, it } from "vitest";
import {
  inferSportFromBet,
  linkableEventsForSport,
  marketOffersTwoUpEarlyPayout,
  marketUsesLinkedEventSides,
  twoUpEarlyPayoutHint,
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

describe("marketOffersTwoUpEarlyPayout", () => {
  it("keeps football on match odds only", () => {
    expect(marketOffersTwoUpEarlyPayout("football", "match_odds")).toBe(true);
    expect(marketOffersTwoUpEarlyPayout("football", "btts")).toBe(false);
    expect(marketOffersTwoUpEarlyPayout("football", "match_winner")).toBe(false);
  });

  it("offers 2UP on the winner market for US sports and ice hockey", () => {
    for (const sport of [
      "american_football",
      "baseball",
      "ice_hockey",
      "basketball",
    ] as const) {
      expect(marketOffersTwoUpEarlyPayout(sport, "match_winner")).toBe(true);
      expect(marketOffersTwoUpEarlyPayout(sport, "handicap")).toBe(false);
    }
  });

  it("does not offer 2UP on other two-way sports", () => {
    expect(marketOffersTwoUpEarlyPayout("tennis", "match_winner")).toBe(false);
    expect(marketOffersTwoUpEarlyPayout("rugby_union", "match_winner")).toBe(false);
    expect(marketOffersTwoUpEarlyPayout("cricket", "match_winner")).toBe(false);
  });
});

describe("twoUpEarlyPayoutHint", () => {
  it("names the scoring unit for each 2UP sport", () => {
    expect(twoUpEarlyPayoutHint("football")).toContain("2 goals");
    expect(twoUpEarlyPayoutHint("ice_hockey")).toContain("2 goals");
    expect(twoUpEarlyPayoutHint("baseball")).toContain("2 runs");
    expect(twoUpEarlyPayoutHint("american_football")).toContain("2 scores");
    expect(twoUpEarlyPayoutHint("basketball")).toContain("2 points");
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
