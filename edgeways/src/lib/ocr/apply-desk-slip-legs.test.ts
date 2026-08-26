import { describe, expect, it } from "vitest";
import type { KnownFixtureOption } from "@/lib/add-bet-event-options";
import { deskLegsFromOcrSlip } from "./apply-desk-slip-legs";
import type { SlipLeg } from "./types";

const york1500: KnownFixtureOption = {
  externalId: "rac_york_1500",
  sport: "horse_racing",
  competition: "York",
  course: "York",
  homeTeam: "15:00 York",
  awayTeam: "15:00",
  startTime: new Date(2026, 7, 22, 15, 0).getTime(),
  status: "upcoming",
  offTime: "15:00",
  runners: ["Notable Speech", "Another Horse"],
};

const york1610: KnownFixtureOption = {
  ...york1500,
  externalId: "rac_york_1610",
  homeTeam: "16:10 York",
  awayTeam: "16:10",
  startTime: new Date(2026, 7, 22, 16, 10).getTime(),
  offTime: "16:10",
  runners: ["Dance In The Storm", "Filler"],
};

const slip: SlipLeg[] = [
  {
    label: "Notable Speech",
    odds: 3.5,
    market: "win",
    eventTime: "15:00",
    course: "York",
  },
  {
    label: "Dance In The Storm",
    odds: 3.25,
    market: "win",
    eventTime: "16:10",
    course: "York",
  },
];

describe("deskLegsFromOcrSlip", () => {
  it("puts each horse on its York race with win market", () => {
    const legs = deskLegsFromOcrSlip(slip, {
      events: [],
      fixtures: [york1500, york1610],
      seedSport: "football",
    });
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatchObject({
      label: "Notable Speech",
      selection: "Notable Speech",
      backOdds: 3.5,
      sport: "horse_racing",
      market: "win",
      eventId: null,
    });
    expect(legs[0]?.pendingFixture?.externalId).toBe("rac_york_1500");
    expect(legs[1]).toMatchObject({
      label: "Dance In The Storm",
      selection: "Dance In The Storm",
      backOdds: 3.25,
      market: "win",
    });
    expect(legs[1]?.pendingFixture?.externalId).toBe("rac_york_1610");
  });

  it("prefers a tracked event id over a pending fixture", () => {
    const tracked = {
      id: 88,
      sport: "horse_racing",
      competition: "York",
      course: "York",
      startTime: york1500.startTime,
      awayTeam: "15:00",
      offTime: "15:00",
      status: "upcoming",
    };
    const [first] = deskLegsFromOcrSlip([slip[0]!], {
      events: [tracked],
      fixtures: [york1500],
      seedSport: "horse_racing",
    });
    expect(first?.eventId).toBe(88);
    expect(first?.pendingFixture).toBeNull();
  });
});
