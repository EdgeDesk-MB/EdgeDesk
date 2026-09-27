import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_UPDATE,
  DEFAULT_APP_UPDATE_MESSAGE,
  APP_UPDATE_PREVIEW_CAPTION,
  appUpdateExitHold,
  appUpdateIsPending,
  appUpdateIsVisible,
  appUpdatesEqual,
  normalizeAppUpdate,
  parseAppUpdate,
  readAppUpdateFromUnknown,
  readBuildCriticalFromUnknown,
  readBuildStampFromUnknown,
} from "./app-update-shared";

describe("normalizeAppUpdate", () => {
  it("fills defaults", () => {
    expect(normalizeAppUpdate(null)).toEqual(DEFAULT_APP_UPDATE);
    expect(normalizeAppUpdate({ mode: "nope" as never, message: "  " })).toEqual(
      DEFAULT_APP_UPDATE
    );
  });

  it("keeps a valid mode and trimmed message", () => {
    expect(
      normalizeAppUpdate({ mode: "force", message: "  Reload now.  " })
    ).toEqual({ mode: "force", message: "Reload now." });
  });
});

describe("parseAppUpdate", () => {
  it("returns defaults for empty or junk JSON", () => {
    expect(parseAppUpdate(null)).toEqual(DEFAULT_APP_UPDATE);
    expect(parseAppUpdate("not-json")).toEqual(DEFAULT_APP_UPDATE);
  });
});

describe("appUpdateIsVisible", () => {
  it("is hidden when off", () => {
    expect(
      appUpdateIsVisible(
        { mode: "off", message: DEFAULT_APP_UPDATE_MESSAGE },
        "old",
        "new"
      )
    ).toBe(false);
  });

  it("shows force whenever there is copy", () => {
    expect(
      appUpdateIsVisible(
        { mode: "force", message: DEFAULT_APP_UPDATE_MESSAGE },
        "same",
        "same"
      )
    ).toBe(true);
  });

  it("shows auto only for a stale boot stamp on a critical build", () => {
    const settings = { mode: "auto" as const, message: DEFAULT_APP_UPDATE_MESSAGE };
    expect(appUpdateIsVisible(settings, "abc", "abc", true)).toBe(false);
    expect(appUpdateIsVisible(settings, "abc", "def", true)).toBe(true);
    expect(appUpdateIsVisible(settings, null, "def", true)).toBe(false);
    expect(appUpdateIsVisible(settings, "abc", null, true)).toBe(false);
  });

  it("keeps an unflagged auto build quiet", () => {
    expect(DEFAULT_APP_UPDATE.mode).toBe("auto");
    expect(appUpdateIsVisible(DEFAULT_APP_UPDATE, "old", "new")).toBe(false);
    expect(appUpdateIsVisible(DEFAULT_APP_UPDATE, "old", "new", false)).toBe(false);
  });
});

describe("appUpdateIsPending", () => {
  it("is pending on auto when the boot stamp is stale", () => {
    expect(appUpdateIsPending(DEFAULT_APP_UPDATE, "old", "new")).toBe(true);
    expect(appUpdateIsPending(DEFAULT_APP_UPDATE, "same", "same")).toBe(false);
    expect(appUpdateIsPending(DEFAULT_APP_UPDATE, null, "new")).toBe(false);
    expect(appUpdateIsPending(DEFAULT_APP_UPDATE, "old", null)).toBe(false);
  });

  it("never self-applies on off or force", () => {
    const off = { mode: "off" as const, message: DEFAULT_APP_UPDATE_MESSAGE };
    const force = { mode: "force" as const, message: DEFAULT_APP_UPDATE_MESSAGE };
    expect(appUpdateIsPending(off, "old", "new")).toBe(false);
    expect(appUpdateIsPending(force, "old", "new")).toBe(false);
  });
});

describe("readBuildCriticalFromUnknown", () => {
  it("only accepts an explicit true", () => {
    expect(readBuildCriticalFromUnknown({ critical: true })).toBe(true);
    expect(readBuildCriticalFromUnknown({ critical: "true" })).toBe(false);
    expect(readBuildCriticalFromUnknown({ enabled: true })).toBe(false);
    expect(readBuildCriticalFromUnknown(null)).toBe(false);
  });
});

describe("payload extras", () => {
  it("reads update and stamp from a banner-shaped payload", () => {
    const raw = {
      enabled: false,
      message: "x",
      kind: "maintenance",
      href: null,
      linkLabel: null,
      buildStamp: " deploy-1 ",
      update: { mode: "force", message: "Reload now." },
    };
    expect(readBuildStampFromUnknown(raw)).toBe("deploy-1");
    expect(readAppUpdateFromUnknown(raw)).toEqual({
      mode: "force",
      message: "Reload now.",
    });
  });

  it("falls back when extras are missing", () => {
    expect(readBuildStampFromUnknown({ enabled: true })).toBeNull();
    expect(readAppUpdateFromUnknown({ enabled: true })).toEqual(DEFAULT_APP_UPDATE);
  });
});

describe("appUpdateExitHold", () => {
  it("keeps the last visible copy when the prompt turns off", () => {
    const on = { mode: "force" as const, message: DEFAULT_APP_UPDATE_MESSAGE };
    const off = { mode: "off" as const, message: DEFAULT_APP_UPDATE_MESSAGE };
    expect(appUpdateExitHold(on, off, "a", "a")).toEqual(on);
    expect(appUpdateExitHold(on, on, "a", "a")).toEqual(on);
    expect(appUpdateExitHold(null, off, "a", "a")).toBeNull();
  });
});

describe("appUpdatesEqual", () => {
  it("compares mode and message", () => {
    expect(appUpdatesEqual(DEFAULT_APP_UPDATE, { ...DEFAULT_APP_UPDATE })).toBe(
      true
    );
    expect(
      appUpdatesEqual(DEFAULT_APP_UPDATE, { ...DEFAULT_APP_UPDATE, mode: "off" })
    ).toBe(false);
  });
});


describe("APP_UPDATE_PREVIEW_CAPTION", () => {
  it("describes what live desks see in each mode", () => {
    expect(APP_UPDATE_PREVIEW_CAPTION).toEqual({
      auto: "Live desks only see this banner for critical updates. Otherwise they reload quietly.",
      force: "Live desks see this after the next deploy, until they reload.",
      off: "Hidden. Desks don't reload for updates.",
    });
  });
});
