import { KEYBOARD_HELP_HREF } from "@/lib/keyboard/desk-shortcuts";

export type ShortcutGroupId = "general" | "daily" | "go-to";

export type ShortcutChord = {
  keys: string[];
  kind: "chord" | "sequence";
  withMod?: boolean;
};

export type ShortcutRow = {
  id: string;
  group: ShortcutGroupId;
  groupLabel: string;
  label: string;
  chord: ShortcutChord;
  haystack: string;
};

export const SHORTCUT_SHEET_GROUPS: ReadonlyArray<{
  id: ShortcutGroupId;
  label: string;
}> = [
  { id: "general", label: "General" },
  { id: "daily", label: "Daily" },
  { id: "go-to", label: "Go to" },
];

export const SHORTCUT_SHEET_ROWS: ReadonlyArray<ShortcutRow> = [
  {
    id: "palette",
    group: "general",
    groupLabel: "General",
    label: "Command palette",
    chord: { keys: ["K"], kind: "chord", withMod: true },
    haystack: "command palette search jump pages",
  },
  {
    id: "sheet",
    group: "general",
    groupLabel: "General",
    label: "Keyboard shortcuts",
    chord: { keys: ["?"], kind: "chord" },
    haystack: "keyboard shortcuts sheet help cheatsheet",
  },
  {
    id: "esc",
    group: "general",
    groupLabel: "General",
    label: "Close dialog",
    chord: { keys: ["Esc"], kind: "chord" },
    haystack: "close dialog escape",
  },
  {
    id: "save-dialog",
    group: "general",
    groupLabel: "General",
    label: "Save dialog",
    chord: { keys: ["↵"], kind: "chord", withMod: true },
    haystack: "save dialog confirm enter command control",
  },
  {
    id: "add-bet",
    group: "daily",
    groupLabel: "Daily",
    label: "Add bet",
    chord: { keys: ["N"], kind: "chord" },
    haystack: "add bet log new",
  },
  {
    id: "new-offer",
    group: "daily",
    groupLabel: "Daily",
    label: "New offer",
    chord: { keys: ["O"], kind: "chord" },
    haystack: "new offer campaign",
  },
  {
    id: "matched-calculator",
    group: "daily",
    groupLabel: "Daily",
    label: "Matched calculator",
    chord: { keys: ["M"], kind: "chord" },
    haystack: "matched calculator",
  },
  {
    id: "jump-home",
    group: "go-to",
    groupLabel: "Go to",
    label: "Home",
    chord: { keys: ["G", "H"], kind: "sequence" },
    haystack: "go home desk",
  },
  {
    id: "jump-racing",
    group: "go-to",
    groupLabel: "Go to",
    label: "Racing",
    chord: { keys: ["G", "R"], kind: "sequence" },
    haystack: "go racing desk",
  },
  {
    id: "jump-offers",
    group: "go-to",
    groupLabel: "Go to",
    label: "Offers",
    chord: { keys: ["G", "O"], kind: "sequence" },
    haystack: "go offers calendar",
  },
];

export const SHORTCUT_SHEET_HELP_HREF = KEYBOARD_HELP_HREF;

export const HELP_EVERYDAY_SHORTCUTS: ReadonlyArray<ShortcutRow> = [
  {
    id: "enter",
    group: "general",
    groupLabel: "Everyday",
    label: "Commit a numeric setting",
    chord: { keys: ["Enter"], kind: "chord" },
    haystack: "enter commit setting",
  },
  {
    id: "esc-help",
    group: "general",
    groupLabel: "Everyday",
    label: "Close a dialog or sheet",
    chord: { keys: ["Esc"], kind: "chord" },
    haystack: "escape close dialog",
  },
  {
    id: "save-dialog-help",
    group: "general",
    groupLabel: "Everyday",
    label: "Save a dialog",
    chord: { keys: ["↵"], kind: "chord", withMod: true },
    haystack: "save dialog confirm enter command control",
  },
];

export function preferMetaModifier(userAgent = ""): boolean {
  return /Mac|iPhone|iPad/i.test(userAgent);
}

export function formatShortcutKeys(chord: ShortcutChord, isMac: boolean): string[] {
  if (chord.withMod) {
    return [isMac ? "⌘" : "Ctrl", ...chord.keys];
  }
  return [...chord.keys];
}

export function filterShortcutRows(
  rows: ReadonlyArray<ShortcutRow>,
  query: string
): ShortcutRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) => {
    const keys = row.chord.keys.join(" ").toLowerCase();
    return (
      row.label.toLowerCase().includes(needle) ||
      row.groupLabel.toLowerCase().includes(needle) ||
      row.haystack.includes(needle) ||
      keys.includes(needle)
    );
  });
}

export function groupShortcutRows(rows: ReadonlyArray<ShortcutRow>): Array<{
  id: ShortcutGroupId;
  label: string;
  rows: ShortcutRow[];
}> {
  return SHORTCUT_SHEET_GROUPS.map((group) => ({
    ...group,
    rows: rows.filter((row) => row.group === group.id),
  })).filter((group) => group.rows.length > 0);
}
