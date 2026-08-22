import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings-shared";
import { mergeAppSettings, parseStoredSettings } from "./settings-merge";

describe("parseStoredSettings", () => {
  it("returns defaults for empty or invalid input", () => {
    expect(parseStoredSettings(null).ageConfirmedAt).toBeNull();
    expect(parseStoredSettings("").defaultBackStake).toBe(DEFAULT_SETTINGS.defaultBackStake);
    expect(parseStoredSettings("{").ageConfirmedAt).toBeNull();
  });

  it("reads a hosted age confirmation", () => {
    const settings = parseStoredSettings({
      ...DEFAULT_SETTINGS,
      ageConfirmedAt: 1_754_870_400_000,
    });
    expect(settings.ageConfirmedAt).toBe(1_754_870_400_000);
  });
});

describe("mergeAppSettings", () => {
  it("sets and clears ageConfirmedAt", () => {
    const confirmed = mergeAppSettings(DEFAULT_SETTINGS, {
      ageConfirmedAt: 1_754_870_400_000,
    });
    expect(confirmed.ageConfirmedAt).toBe(1_754_870_400_000);
    expect(mergeAppSettings(confirmed, { ageConfirmedAt: null }).ageConfirmedAt).toBeNull();
  });

  it("merges one offer pref without dropping the rest", () => {
    const withFirst = mergeAppSettings(DEFAULT_SETTINGS, {
      offerBetPref: { offerId: 5, stake: 12.5, bookmaker: "Coral" },
    });
    const withSecond = mergeAppSettings(withFirst, {
      offerBetPref: { offerId: 9, stake: 20, bookmaker: "Sky Bet" },
    });
    expect(withSecond.offerBetPrefs).toEqual({
      "5": { stake: 12.5, bookmaker: "Coral" },
      "9": { stake: 20, bookmaker: "Sky Bet" },
    });
  });
});
