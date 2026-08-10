import { describe, expect, it } from "vitest";
import {
  deskBackBetLabel,
  isDeskFreeBetType,
  normaliseDeskBackBetType,
  primarySportFromLegs,
} from "./desk-back-bet-type";

describe("normaliseDeskBackBetType", () => {
  it("keeps free_snr and free_sr", () => {
    expect(normaliseDeskBackBetType("free_snr")).toBe("free_snr");
    expect(normaliseDeskBackBetType("free_sr")).toBe("free_sr");
  });

  it("defaults unknown values to qualifying", () => {
    expect(normaliseDeskBackBetType(undefined)).toBe("qualifying");
    expect(normaliseDeskBackBetType("dutch")).toBe("qualifying");
  });
});

describe("deskBackBetLabel", () => {
  it("prefixes FB for free stake sources", () => {
    expect(deskBackBetLabel("Acca", "Weekend", "free_snr")).toBe("Acca FB · Weekend");
    expect(deskBackBetLabel("BB", "Arsenal", "free_sr")).toBe("BB FB · Arsenal");
    expect(deskBackBetLabel("Yankee", "Lucky", "qualifying")).toBe("Yankee · Lucky");
  });
});

describe("primarySportFromLegs", () => {
  it("returns the first non-empty sport", () => {
    expect(
      primarySportFromLegs([{ sport: null }, { sport: "tennis" }, { sport: "football" }])
    ).toBe("tennis");
  });

  it("returns null when none set", () => {
    expect(primarySportFromLegs([{ sport: "" }, { sport: null }])).toBe(null);
  });
});

describe("isDeskFreeBetType", () => {
  it("detects free stake types", () => {
    expect(isDeskFreeBetType("free_snr")).toBe(true);
    expect(isDeskFreeBetType("qualifying")).toBe(false);
  });
});
