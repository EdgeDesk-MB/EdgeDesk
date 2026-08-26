import { describe, expect, it } from "vitest";
import {
  countryLabelToIso,
  flagEmojiFromIso,
  flagLabelFromIso,
  racingRegionChip,
  racingRegionLabel,
  toIsoCountryCode,
} from "@/lib/geo/region";

describe("toIsoCountryCode", () => {
  it("maps Racing API codes to ISO", () => {
    expect(toIsoCountryCode("GB")).toBe("GB");
    expect(toIsoCountryCode("IRE")).toBe("IE");
    expect(toIsoCountryCode("ie")).toBe("IE");
    expect(toIsoCountryCode("UK")).toBe("GB");
    expect(toIsoCountryCode("ENGLAND")).toBe("GB");
    expect(toIsoCountryCode("SCOTLAND")).toBe("GB");
  });

  it("passes through home-nation football flag codes", () => {
    expect(toIsoCountryCode("ENG")).toBe("ENG");
    expect(toIsoCountryCode("SCT")).toBe("SCT");
    expect(toIsoCountryCode("WLS")).toBe("WLS");
  });

  it("returns null for unknown", () => {
    expect(toIsoCountryCode(null)).toBeNull();
    expect(toIsoCountryCode("")).toBeNull();
    expect(toIsoCountryCode("XYZ")).toBeNull();
  });
});

describe("countryLabelToIso", () => {
  it("uses home-nation flags for football country labels", () => {
    expect(countryLabelToIso("England")).toBe("ENG");
    expect(countryLabelToIso("Scotland")).toBe("SCT");
    expect(countryLabelToIso("Wales")).toBe("WLS");
    expect(countryLabelToIso("United Kingdom")).toBe("GB");
    expect(countryLabelToIso("Spain")).toBe("ES");
  });
});

describe("racing helpers", () => {
  it("labels and chips", () => {
    expect(racingRegionLabel("IRE")).toBe("Ireland");
    expect(racingRegionLabel("GB")).toBe("UK");
    expect(racingRegionChip("IRE")).toBe("IRE");
    expect(racingRegionChip(undefined)).toBe("GB");
  });

  it("builds flag emoji", () => {
    expect(flagEmojiFromIso("GB")).toBe("🇬🇧");
    expect(flagEmojiFromIso("IE")).toBe("🇮🇪");
    expect(flagEmojiFromIso("ENG")).toBe("🏴󠁧󠁢󠁥󠁮󠁧󠁿");
    expect(flagLabelFromIso("ENG")).toBe("England");
  });
});
