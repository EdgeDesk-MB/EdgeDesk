import { describe, expect, it } from "vitest";
import {
  DESK_GO_PREFIX_MS,
  focusedOpenBetRow,
  matchDeskShortcut,
  matchSettleFocusedBetChord,
  overlayAttrsBlockShortcuts,
  resolveDeskKey,
  shouldIgnoreDeskShortcut,
  targetAttrsAreTyping,
} from "./desk-shortcuts";

function key(
  k: string,
  extras: Partial<Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey">> = {}
) {
  return {
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...extras,
  };
}

describe("matchDeskShortcut", () => {
  it("maps daily chords without modifiers", () => {
    expect(matchDeskShortcut(key("n"))).toBe("add-bet");
    expect(matchDeskShortcut(key("N"))).toBe("add-bet");
    expect(matchDeskShortcut(key("o"))).toBe("new-offer");
    expect(matchDeskShortcut(key("m"))).toBe("matched-calculator");
    expect(matchDeskShortcut(key("?"))).toBe("keyboard-help");
    expect(matchDeskShortcut(key("/", { shiftKey: true }))).toBe("keyboard-help");
  });

  it("ignores browser and palette modifiers", () => {
    expect(matchDeskShortcut(key("n", { metaKey: true }))).toBeNull();
    expect(matchDeskShortcut(key("n", { ctrlKey: true }))).toBeNull();
    expect(matchDeskShortcut(key("n", { altKey: true }))).toBeNull();
    expect(matchDeskShortcut(key("k", { metaKey: true }))).toBeNull();
    expect(matchDeskShortcut(key("N", { shiftKey: true }))).toBeNull();
  });

  it("does not steal unused letters", () => {
    expect(matchDeskShortcut(key("g"))).toBeNull();
    expect(matchDeskShortcut(key("s"))).toBeNull();
    expect(matchDeskShortcut(key("Escape"))).toBeNull();
  });
});

describe("matchSettleFocusedBetChord (EDGE-79)", () => {
  it("matches a plain s", () => {
    expect(matchSettleFocusedBetChord(key("s"))).toBe(true);
    // A real capital S arrives with shiftKey — rejected below.
    expect(matchSettleFocusedBetChord(key("S", { shiftKey: true }))).toBe(false);
  });

  it("rejects modifiers and other keys", () => {
    expect(matchSettleFocusedBetChord(key("s", { shiftKey: true }))).toBe(false);
    expect(matchSettleFocusedBetChord(key("s", { metaKey: true }))).toBe(false);
    expect(matchSettleFocusedBetChord(key("s", { ctrlKey: true }))).toBe(false);
    expect(matchSettleFocusedBetChord(key("s", { altKey: true }))).toBe(false);
    expect(matchSettleFocusedBetChord(key("n"))).toBe(false);
    expect(matchSettleFocusedBetChord(key("Escape"))).toBe(false);
  });
});

describe("focusedOpenBetRow (EDGE-79)", () => {
  it("returns null without a focused element", () => {
    expect(focusedOpenBetRow(null)).toBeNull();
  });

  it("returns null outside the browser (no Element global)", () => {
    // Node test env: the guard must fail safe, never throw.
    expect(focusedOpenBetRow({} as Element)).toBeNull();
  });
});

describe("resolveDeskKey", () => {
  it("arms g then jumps within the timeout", () => {
    const armed = resolveDeskKey(key("g"), null, 0);
    expect(armed).toEqual({
      action: null,
      nextPrefixArmedAt: 0,
      consume: true,
    });
    expect(resolveDeskKey(key("h"), armed.nextPrefixArmedAt, 400)).toEqual({
      action: "jump-home",
      nextPrefixArmedAt: null,
      consume: true,
    });
    expect(resolveDeskKey(key("r"), 0, 400)).toEqual({
      action: "jump-racing",
      nextPrefixArmedAt: null,
      consume: true,
    });
    expect(resolveDeskKey(key("o"), 0, 400)).toEqual({
      action: "jump-offers",
      nextPrefixArmedAt: null,
      consume: true,
    });
  });

  it("does not treat o as New offer while g is armed", () => {
    expect(resolveDeskKey(key("o"), 0, 200).action).toBe("jump-offers");
  });

  it("expires the prefix after 1s and lets daily chords through", () => {
    const late = resolveDeskKey(key("n"), 0, DESK_GO_PREFIX_MS + 1);
    expect(late).toEqual({
      action: "add-bet",
      nextPrefixArmedAt: null,
      consume: true,
    });
  });

  it("lets n / m / ? cancel a live prefix", () => {
    expect(resolveDeskKey(key("n"), 0, 200).action).toBe("add-bet");
    expect(resolveDeskKey(key("m"), 0, 200).action).toBe("matched-calculator");
    expect(resolveDeskKey(key("?"), 0, 200).action).toBe("keyboard-help");
  });
});

describe("shouldIgnoreDeskShortcut", () => {
  it("treats text fields as typing", () => {
    expect(targetAttrsAreTyping({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(targetAttrsAreTyping({ tagName: "INPUT", type: "number" })).toBe(true);
    expect(targetAttrsAreTyping({ tagName: "TEXTAREA" })).toBe(true);
    expect(targetAttrsAreTyping({ tagName: "DIV", contentEditable: "true" })).toBe(true);
    expect(targetAttrsAreTyping({ tagName: "DIV", role: "combobox" })).toBe(true);
  });

  it("lets chords through on buttons and checkboxes", () => {
    expect(targetAttrsAreTyping({ tagName: "BUTTON" })).toBe(false);
    expect(targetAttrsAreTyping({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(targetAttrsAreTyping({ tagName: "DIV" })).toBe(false);
    expect(shouldIgnoreDeskShortcut({ target: null })).toBe(false);
  });

  it("blocks while a dialog or menu is open", () => {
    expect(overlayAttrsBlockShortcuts({ role: "dialog", dataState: "open" })).toBe(true);
    expect(overlayAttrsBlockShortcuts({ role: "menu", dataState: "open" })).toBe(true);
    expect(overlayAttrsBlockShortcuts({ role: "dialog", dataState: "closed" })).toBe(false);
  });

  it("blocks when another handler already claimed the event", () => {
    expect(shouldIgnoreDeskShortcut({ target: null, defaultPrevented: true })).toBe(true);
  });
});
