import { describe, expect, it } from "vitest";
import {
  adminLiveSoundForKind,
  parseAdminLiveSoundEnabled,
  pickAdminLiveSound,
  shouldPlayAdminLiveSound,
} from "./live-toast-sound";

describe("parseAdminLiveSoundEnabled", () => {
  it("defaults on, and only 0 turns it off", () => {
    expect(parseAdminLiveSoundEnabled(null)).toBe(true);
    expect(parseAdminLiveSoundEnabled("1")).toBe(true);
    expect(parseAdminLiveSoundEnabled("0")).toBe(false);
  });
});

describe("shouldPlayAdminLiveSound", () => {
  it("plays the first toast and waits out the gap", () => {
    expect(shouldPlayAdminLiveSound(true, 2, 0, 1_000)).toBe(true);
    expect(shouldPlayAdminLiveSound(true, 2, 1_000, 1_200)).toBe(false);
    expect(shouldPlayAdminLiveSound(true, 2, 1_000, 1_500)).toBe(true);
    expect(shouldPlayAdminLiveSound(false, 2, 0, 1_000)).toBe(false);
    expect(shouldPlayAdminLiveSound(true, 0, 0, 1_000)).toBe(false);
  });
});

describe("admin live sound library", () => {
  it("maps desk volume to the soft chime", () => {
    expect(adminLiveSoundForKind("bet_created")).toBe("desk");
    expect(adminLiveSoundForKind("offer_created")).toBe("desk");
    expect(adminLiveSoundForKind("casino_created")).toBe("desk");
    expect(adminLiveSoundForKind("signup")).toBe("desk");
  });

  it("maps feed and health to the alert voices", () => {
    expect(adminLiveSoundForKind("feed_warning")).toBe("notice");
    expect(adminLiveSoundForKind("feed_critical")).toBe("alarm");
    expect(adminLiveSoundForKind("health_error")).toBe("alarm");
  });

  it("plays the most serious voice in a mixed burst", () => {
    expect(pickAdminLiveSound(["bet_created", "health_error"])).toBe("alarm");
    expect(pickAdminLiveSound(["signup", "feed_warning"])).toBe("notice");
    expect(pickAdminLiveSound(["bet_created", "offer_created"])).toBe("desk");
  });
});
