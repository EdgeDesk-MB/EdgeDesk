import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings-shared";
import {
  isFixtureScopeSettingsPatch,
  mergeAppSettings,
  parseStoredSettings,
} from "./settings-merge";

describe("parseStoredSettings", () => {
  it("does not persist the injected 2UP scout preview latch", () => {
    expect(
      parseStoredSettings({
        ...DEFAULT_SETTINGS,
        twoupScoutPreview: true,
      }).twoupScoutPreview
    ).toBeUndefined();
  });

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

  it("keeps hosted digest latches across parse and merge", () => {
    const settings = parseStoredSettings({
      ...DEFAULT_SETTINGS,
      digestLastSentWeek: "2026-W34",
      dailyTasksLastSentDay: "2026-08-24",
    });
    expect(settings.digestLastSentWeek).toBe("2026-W34");
    expect(settings.dailyTasksLastSentDay).toBe("2026-08-24");
    const patched = mergeAppSettings(settings, { digestWeekly: true });
    expect(patched.digestLastSentWeek).toBe("2026-W34");
    expect(patched.dailyTasksLastSentDay).toBe("2026-08-24");
    expect(mergeAppSettings(patched, { digestLastSentWeek: "2026-W35" }).digestLastSentWeek).toBe(
      "2026-W35"
    );
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

  it("round-trips favourite fixture scopes", () => {
    const patched = mergeAppSettings(DEFAULT_SETTINGS, {
      favouriteFootballScopes: ["England::Premier League", "all", "England::Premier League"],
      favouriteRacingCourses: ["Ascot", "favourites"],
    });
    expect(patched.favouriteFootballScopes).toEqual(["England::Premier League"]);
    expect(patched.favouriteRacingCourses).toEqual(["Ascot"]);
    const hidden = mergeAppSettings(DEFAULT_SETTINGS, {
      hiddenFootballScopes: ["Gibraltar::Premier Division", "all"],
    });
    expect(hidden.hiddenFootballScopes).toEqual(["Gibraltar::Premier Division"]);
    expect(
      parseStoredSettings({
        ...DEFAULT_SETTINGS,
        favouriteFootballScopes: patched.favouriteFootballScopes,
        hiddenFootballScopes: hidden.hiddenFootballScopes,
      })
    ).toMatchObject({
      favouriteFootballScopes: ["England::Premier League"],
      hiddenFootballScopes: ["Gibraltar::Premier Division"],
    });
    expect(isFixtureScopeSettingsPatch({ hiddenFootballScopes: ["Germany::Bundesliga"] })).toBe(
      true
    );
    expect(
      isFixtureScopeSettingsPatch({
        fixtureBoardView: { football: { rail: "pins" } },
      })
    ).toBe(true);
    expect(isFixtureScopeSettingsPatch({ defaultBackStake: 10 })).toBe(false);
  });

  it("merges fixture board view without dropping the other sport", () => {
    const pinned = mergeAppSettings(DEFAULT_SETTINGS, {
      fixtureBoardView: { football: { rail: "pins", status: "live" } },
    });
    expect(pinned.fixtureBoardView.football).toEqual({ rail: "pins", status: "live" });
    const withSport = mergeAppSettings(pinned, {
      fixtureBoardView: { sport: "horse_racing" },
    });
    expect(withSport.fixtureBoardView).toEqual({
      sport: "horse_racing",
      football: { rail: "pins", status: "live" },
      racing: { rail: "all", status: "all" },
    });
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
