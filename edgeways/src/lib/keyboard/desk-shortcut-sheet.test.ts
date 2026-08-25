import { describe, expect, it } from "vitest";
import {
  filterShortcutRows,
  formatShortcutKeys,
  groupShortcutRows,
  HELP_EVERYDAY_SHORTCUTS,
  preferMetaModifier,
  SHORTCUT_SHEET_ROWS,
} from "./desk-shortcut-sheet";

describe("preferMetaModifier", () => {
  it("treats Apple platforms as ⌘, Windows and Linux as Ctrl", () => {
    expect(preferMetaModifier("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(true);
    expect(preferMetaModifier("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(
      true
    );
    expect(preferMetaModifier("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
    expect(preferMetaModifier("Mozilla/5.0 (X11; Linux x86_64)")).toBe(false);
  });
});

describe("formatShortcutKeys", () => {
  it("prefixes the modifier for the palette", () => {
    expect(formatShortcutKeys({ keys: ["K"], kind: "chord", withMod: true }, true)).toEqual([
      "⌘",
      "K",
    ]);
    expect(formatShortcutKeys({ keys: ["K"], kind: "chord", withMod: true }, false)).toEqual([
      "Ctrl",
      "K",
    ]);
  });

  it("prefixes the modifier for dialog save", () => {
    expect(formatShortcutKeys({ keys: ["↵"], kind: "chord", withMod: true }, true)).toEqual([
      "⌘",
      "↵",
    ]);
    expect(formatShortcutKeys({ keys: ["↵"], kind: "chord", withMod: true }, false)).toEqual([
      "Ctrl",
      "↵",
    ]);
  });

  it("keeps a go-to sequence as two letters", () => {
    expect(formatShortcutKeys({ keys: ["G", "H"], kind: "sequence" }, true)).toEqual([
      "G",
      "H",
    ]);
  });
});

describe("filterShortcutRows", () => {
  it("filters by label and leaves groups intact", () => {
    const hits = filterShortcutRows(SHORTCUT_SHEET_ROWS, "racing");
    expect(hits.map((row) => row.id)).toEqual(["jump-racing"]);
    expect(groupShortcutRows(hits).map((group) => group.id)).toEqual(["go-to"]);
  });

  it("returns every row when the query is blank", () => {
    expect(filterShortcutRows(SHORTCUT_SHEET_ROWS, "  ")).toHaveLength(
      SHORTCUT_SHEET_ROWS.length
    );
  });

  it("keeps everyday Help rows on Enter, Esc, and modifier save", () => {
    expect(
      HELP_EVERYDAY_SHORTCUTS.map((row) => ({
        keys: row.chord.keys,
        withMod: row.chord.withMod === true,
      }))
    ).toEqual([
      { keys: ["Enter"], withMod: false },
      { keys: ["Esc"], withMod: false },
      { keys: ["↵"], withMod: true },
    ]);
  });
});
