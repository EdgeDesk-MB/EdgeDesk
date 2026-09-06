import { describe, expect, it } from "vitest";
import {
  ACTIVITY_UNSET_KEY,
  activityBetTypeLabel,
  activitySportLabel,
  buildActivityMixCharts,
  emptyActivityMix,
  filterActivityMix,
  leadingSportByUser,
  resolveActivitySport,
  sportDeskRows,
  type ActivityKeyedCount,
} from "@/lib/admin/activity-mix";

function count(
  clerkUserId: string,
  key: string,
  n: number
): ActivityKeyedCount {
  return { clerkUserId, key, n };
}

describe("activity mix labels", () => {
  it("does not treat a blank sport as football", () => {
    expect(activitySportLabel(ACTIVITY_UNSET_KEY)).toBe("Not set");
    expect(activitySportLabel("horse_racing")).toBe("Horse racing");
    expect(activitySportLabel("sports")).toBe("Sports");
  });

  it("resolves sport from event, then bet, then offer, then market", () => {
    expect(
      resolveActivitySport({
        eventSport: "football",
        betSport: "horse_racing",
        offerSport: "cricket",
        market: "win",
      })
    ).toBe("football");
    expect(
      resolveActivitySport({
        eventSport: "  ",
        betSport: "horse_racing",
        offerSport: "cricket",
      })
    ).toBe("horse_racing");
    expect(
      resolveActivitySport({
        offerSport: "cricket",
        market: "match_winner",
      })
    ).toBe("cricket");
    expect(resolveActivitySport({ market: "win" })).toBe("horse_racing");
    expect(resolveActivitySport({ market: "match_odds" })).toBe("football");
    expect(resolveActivitySport({ market: "set_betting" })).toBe("tennis");
    expect(resolveActivitySport({})).toBe(ACTIVITY_UNSET_KEY);
  });

  it("keeps unknown stored sport ids", () => {
    expect(resolveActivitySport({ eventSport: "gaelic_football" })).toBe(
      "gaelic_football"
    );
  });

  it("uses desk bet-type names", () => {
    expect(activityBetTypeLabel("qualifying")).toBe("Qualifying");
    expect(activityBetTypeLabel("free_snr")).toBe("Free bet (SNR)");
    expect(activityBetTypeLabel("back_only")).toBe("No lay");
  });
});

describe("filterActivityMix", () => {
  it("drops keyed counts for excluded desks", () => {
    const mix = emptyActivityMix();
    mix.betTypes = [
      count("admin_1", "qualifying", 9),
      count("user_a", "free_snr", 2),
    ];
    mix.betSports = [count("admin_1", "football", 3), count("user_a", "horse_racing", 4)];
    const scoped = filterActivityMix(mix, new Set(["admin_1"]));
    expect(scoped.betTypes).toEqual([count("user_a", "free_snr", 2)]);
    expect(scoped.betSports).toEqual([count("user_a", "horse_racing", 4)]);
  });
});

describe("buildActivityMixCharts", () => {
  it("sums fleet counts and keeps known bet-type order", () => {
    const mix = emptyActivityMix();
    mix.betTypes = [
      count("user_a", "free_snr", 2),
      count("user_b", "qualifying", 5),
      count("user_a", "qualifying", 1),
    ];
    const charts = buildActivityMixCharts(mix);
    expect(charts.betTypes.map((slice) => [slice.label, slice.value])).toEqual([
      ["Qualifying", 6],
      ["Free bet (SNR)", 2],
    ]);
  });

  it("labels unset sports and ranks bookmakers without row payloads", () => {
    const mix = emptyActivityMix();
    mix.betSports = [
      count("user_a", ACTIVITY_UNSET_KEY, 3),
      count("user_b", "horse_racing", 4),
    ];
    mix.betBookmakers = [
      count("user_a", "Sky Bet", 2),
      count("user_b", "Sky Bet", 1),
      count("user_b", "Bet365", 8),
    ];
    mix.betCampaigns = [
      count("user_a", "linked", 2),
      count("user_a", "none", 3),
    ];
    mix.betPurposes = [
      count("user_a", "edge", 4),
      count("user_b", "mug", 1),
    ];
    const charts = buildActivityMixCharts(mix);
    expect(charts.betSports.map((slice) => [slice.label, slice.value])).toEqual([
      ["Horse racing", 4],
      ["Not set", 3],
    ]);
    expect(charts.betBookmakers[0]).toMatchObject({
      label: "Bet365",
      value: 8,
    });
    expect(charts.betBookmakers[1]).toMatchObject({
      label: "Sky Bet",
      value: 3,
    });
    expect(charts.betCampaigns.map((slice) => [slice.label, slice.value])).toEqual([
      ["On a campaign", 2],
      ["Not on a campaign", 3],
    ]);
    expect(charts.betPurposes.map((slice) => [slice.label, slice.value])).toEqual([
      ["Edge", 4],
      ["Mug", 1],
    ]);
  });
});

describe("leadingSportByUser", () => {
  it("picks the sport with the most bets on each desk", () => {
    const leading = leadingSportByUser([
      count("user_a", "football", 2),
      count("user_a", "horse_racing", 5),
      count("user_b", "cricket", 1),
    ]);
    expect(leading.get("user_a")).toEqual({
      key: "horse_racing",
      n: 5,
      total: 7,
    });
    expect(leading.get("user_b")).toEqual({
      key: "cricket",
      n: 1,
      total: 1,
    });
  });

  it("breaks ties with the fleet sport order", () => {
    const leading = leadingSportByUser([
      count("user_a", "football", 3),
      count("user_a", "horse_racing", 3),
    ]);
    expect(leading.get("user_a")?.key).toBe("horse_racing");
  });
});

describe("sportDeskRows", () => {
  it("counts bets and distinct desks per sport", () => {
    expect(
      sportDeskRows([
        count("user_a", "horse_racing", 4),
        count("user_b", "horse_racing", 1),
        count("user_b", "football", 2),
      ])
    ).toEqual([
      { key: "horse_racing", label: "Horse racing", bets: 5, desks: 2 },
      { key: "football", label: "Football", bets: 2, desks: 1 },
    ]);
  });
});
