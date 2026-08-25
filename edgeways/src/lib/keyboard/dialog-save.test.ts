import { describe, expect, it } from "vitest";
import { dialogSaveHintKeys, matchDialogSave } from "./dialog-save";

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

describe("matchDialogSave", () => {
  it("accepts ⌘Enter and Ctrl+Enter, including from a field", () => {
    expect(matchDialogSave(key("Enter", { metaKey: true }))).toBe(true);
    expect(matchDialogSave(key("Enter", { ctrlKey: true }))).toBe(true);
    expect(matchDialogSave(key("NumpadEnter", { metaKey: true }))).toBe(true);
  });

  it("does not use ⌘S, which browsers often steal", () => {
    expect(matchDialogSave(key("s", { metaKey: true }))).toBe(false);
    expect(matchDialogSave(key("s", { ctrlKey: true }))).toBe(false);
  });

  it("ignores bare S, Enter, Alt, Shift, and other letters", () => {
    expect(matchDialogSave(key("s"))).toBe(false);
    expect(matchDialogSave(key("S"))).toBe(false);
    expect(matchDialogSave(key("Enter"))).toBe(false);
    expect(matchDialogSave(key("Enter", { altKey: true }))).toBe(false);
    expect(matchDialogSave(key("Enter", { shiftKey: true, metaKey: true }))).toBe(
      false
    );
    expect(matchDialogSave(key("n"))).toBe(false);
  });
});

describe("dialogSaveHintKeys", () => {
  it("paints ⌘↵ on Mac and Ctrl ↵ on Windows and Linux", () => {
    expect(dialogSaveHintKeys(true)).toEqual(["⌘", "↵"]);
    expect(dialogSaveHintKeys(false)).toEqual(["Ctrl", "↵"]);
  });
});
