import { describe, expect, it } from "vitest";
import { inferSportFromBet, linkableEventsForSport } from "./markets";

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
