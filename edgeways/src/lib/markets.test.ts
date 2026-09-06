import { describe, expect, it } from "vitest";
import {
  inferSportFromBet,
  linkableEventsForSport,
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
