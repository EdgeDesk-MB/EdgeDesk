import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_UPDATE,
  DEFAULT_APP_UPDATE_MESSAGE,
  appUpdateExitHold,
  appUpdateIsVisible,
  appUpdatesEqual,
  deskHasBlockingOverlay,
  normalizeAppUpdate,
  parseAppUpdate,
  readAppUpdateFromUnknown,
  readBuildStampFromUnknown,
  shouldApplyDeskUpdateNow,
  shouldAutoApplyAppUpdate,
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

  it("shows auto only when the boot stamp is stale", () => {
    const settings = { mode: "auto" as const, message: DEFAULT_APP_UPDATE_MESSAGE };
    expect(appUpdateIsVisible(settings, "abc", "abc")).toBe(false);
    expect(appUpdateIsVisible(settings, "abc", "def")).toBe(true);
    expect(appUpdateIsVisible(settings, null, "def")).toBe(false);
    expect(appUpdateIsVisible(settings, "abc", null)).toBe(false);
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

describe("shouldApplyDeskUpdateNow", () => {
  const auto = { mode: "auto" as const, message: DEFAULT_APP_UPDATE_MESSAGE };

  function root(hit: Element | null): ParentNode {
    return { querySelector: () => hit } as unknown as ParentNode;
  }

  it("auto-applies only in auto mode when the stamp moved and no dialog is open", () => {
    expect(shouldAutoApplyAppUpdate(auto)).toBe(true);
    expect(shouldAutoApplyAppUpdate({ ...auto, mode: "force" })).toBe(false);
    expect(shouldApplyDeskUpdateNow(auto, "old", "new", root(null))).toBe(true);
    expect(
      shouldApplyDeskUpdateNow({ ...auto, mode: "force" }, "old", "new", root(null))
    ).toBe(false);
  });

  it("waits while a dialog is open", () => {
    const doc = root({} as Element);
    expect(deskHasBlockingOverlay(doc)).toBe(true);
    expect(shouldApplyDeskUpdateNow(auto, "old", "new", doc)).toBe(false);
  });
});
