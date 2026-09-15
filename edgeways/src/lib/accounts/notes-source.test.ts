import { describe, expect, it } from "vitest";
import { isAutoOrEmptyScopeNote, scopeNoteTooltip } from "./notes-source";

describe("isAutoOrEmptyScopeNote", () => {
  it("treats a never-touched blank note as safe to auto-fill", () => {
    expect(isAutoOrEmptyScopeNote(null, null)).toBe(true);
    expect(isAutoOrEmptyScopeNote("   ", null)).toBe(true);
    expect(isAutoOrEmptyScopeNote(undefined, undefined)).toBe(true);
  });

  it("treats a scope-tagged note as safe to overwrite with a fresh auto-fill", () => {
    expect(isAutoOrEmptyScopeNote("Pays early for Football.", "scope")).toBe(true);
  });

  it("leaves a user's own text alone even if it happens to match old auto-fill copy", () => {
    expect(isAutoOrEmptyScopeNote("Pays early for Football.", "user")).toBe(false);
    expect(isAutoOrEmptyScopeNote("Called ahead, confirmed 2UP by phone", null)).toBe(false);
  });

  it("respects a user clearing a note back to blank - it must not silently refill on the next scope edit", () => {
    expect(isAutoOrEmptyScopeNote("", "user")).toBe(false);
    expect(isAutoOrEmptyScopeNote(null, "user")).toBe(false);
  });
});

describe("scopeNoteTooltip", () => {
  it("names the account type", () => {
    expect(scopeNoteTooltip("bookie")).toBe("Auto-created from bookie scope");
    expect(scopeNoteTooltip("exchange")).toBe("Auto-created from exchange scope");
    expect(scopeNoteTooltip("bank")).toBe("Auto-created from bookie scope");
  });
});
