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

  it("detects Sportsbook multiples as an accumulator", () => {
    expect(extractBetStructure("MULTIPLES\n2 Selections")).toBe("accumulator");
  });

  it("reads Betfair Sportsbook multiples with Win - time course", () => {
    const text = [
      "MULTIPLES",
      "2 Selections",
      "4 Notable Speech 3.50",
      "Win - 15:00 York",
      "7 Dance In The Storm 3.25",
      "Win - 16:10 York",
    ].join("\n");
    const legs = extractSlipLegs(text);
    expect(legs).toEqual([
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
    ]);
  });

  it("reads the real Tesseract sparse dump from a Sportsbook multiples crop", () => {
    const text = `MULTIPLES

2 Selections

4 Notable Speech

3.50

Win - 15:00 York

V* 7 Dance In The Storm

3.25

Win - 16:10 York
`;
    const legs = extractSlipLegs(text);
    expect(legs.map((l) => l.label)).toEqual([
      "Notable Speech",
      "Dance In The Storm",
    ]);
    expect(legs[0]).toMatchObject({
      odds: 3.5,
      eventTime: "15:00",
      course: "York",
      market: "win",
    });
    expect(legs[1]).toMatchObject({
      odds: 3.25,
      eventTime: "16:10",
      course: "York",
    });
  });

  it("strips silk OCR junk on the same line as horse and odds", () => {
    const text = [
      "4 Notable Speech 3.50",
      "Win - 15:00 York",
      "V* 7 Dance In The Storm 3.25",
      "Win - 16:10 York",
    ].join("\n");
    const legs = extractSlipLegs(text);
    expect(legs[1]?.label).toBe("Dance In The Storm");
    expect(legs[1]?.odds).toBe(3.25);
  });

  it("reads multiples when odds sit on the next line", () => {
    const text = [
      "4 Notable Speech",
      "3.50",
      "Win - 15:00 York",
      "7 Dance In The Storm",
      "3.25",
      "Win - 16:10 York",
    ].join("\n");
    const legs = extractSlipLegs(text);
    expect(legs.map((l) => l.label)).toEqual([
      "Notable Speech",
      "Dance In The Storm",
    ]);
    expect(legs[0]?.eventTime).toBe("15:00");
    expect(legs[1]?.course).toBe("York");
  });

  it("detects Canadian / Super Yankee, Heinz, Super Heinz, Goliath", () => {
    expect(extractBetStructure("Canadian £1 unit")).toBe("canadian");
    expect(extractBetStructure("Super Yankee")).toBe("canadian");
    expect(extractBetStructure("Heinz 6 runners")).toBe("heinz");
    expect(extractBetStructure("Super Heinz")).toBe("super_heinz");
    expect(extractBetStructure("Goliath stake")).toBe("goliath");
  });
});
