import { describe, expect, it } from "vitest";
import {
  extractBetStructure,
  extractEachWayFlag,
  extractSlipLegs,
  extractUnitStake,
} from "./parse-bet-structure";

describe("parse-bet-structure", () => {
  it("detects Lucky 15 and each-way", () => {
    const text = "Bet365 Lucky 15 Each Way\n£1 per bet\nTotal Stake £30.00";
    expect(extractBetStructure(text)).toBe("lucky_15");
    expect(extractEachWayFlag(text)).toBe(true);
    expect(extractUnitStake(text)).toBe(1);
  });

  it("extracts legs with odds", () => {
    const text = [
      "Lucky 15",
      "Constitution Hill 5/2",
      "State Man @ 3.50",
      "Galopin Des Champs 2.20",
      "Lossiemouth 4/1",
    ].join("\n");
    const legs = extractSlipLegs(text);
    expect(legs.length).toBe(4);
    expect(legs[0]?.label).toMatch(/Constitution/i);
  });

  it("detects Canadian / Super Yankee, Heinz, Super Heinz, Goliath", () => {
    expect(extractBetStructure("Canadian £1 unit")).toBe("canadian");
    expect(extractBetStructure("Super Yankee")).toBe("canadian");
    expect(extractBetStructure("Heinz 6 runners")).toBe("heinz");
    expect(extractBetStructure("Super Heinz")).toBe("super_heinz");
    expect(extractBetStructure("Goliath stake")).toBe("goliath");
  });
});
