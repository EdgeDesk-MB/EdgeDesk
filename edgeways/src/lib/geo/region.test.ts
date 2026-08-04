import { describe, expect, it } from "vitest";
import {
  flagEmojiFromIso,
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
  });

  it("returns null for unknown", () => {
    expect(toIsoCountryCode(null)).toBeNull();
    expect(toIsoCountryCode("")).toBeNull();
    expect(toIsoCountryCode("XYZ")).toBeNull();
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
  });
});
