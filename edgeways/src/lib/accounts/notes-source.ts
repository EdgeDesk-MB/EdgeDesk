/**
 * Provenance for `accounts.notes`: "scope" once the bookie/exchange scope
 * auto-fill wrote it, otherwise user-authored (null = legacy/manual).
 */
export type AccountNotesSource = "user" | "scope" | null | undefined;

/**
 * Safe to auto-overwrite when it's ours to begin with ("scope"), or when
 * nothing has ever touched it (blank, no source). Two things it must NOT
 * do:
 * - Overwrite a blank note whose source is "user" - that's a user
 *   deliberately clearing it via the notes field, and it must stick, or
 *   the next scope edit would silently refill it right back.
 * - Overwrite non-blank text with a null source - that predates the
 *   `notesSource` column (legacy real notes), so treat it as user-owned.
 */
export function isAutoOrEmptyScopeNote(
  notes: string | null | undefined,
  notesSource: AccountNotesSource
): boolean {
  if (notesSource === "scope") return true;
  if (notesSource === "user") return false;
  return !notes || !notes.trim();
}

/** Hover copy for the note icon when `notesSource === "scope"`. */
export function scopeNoteTooltip(accountType: "bookie" | "exchange" | "bank"): string {
  const noun = accountType === "exchange" ? "exchange" : "bookie";
  return `Auto-created from ${noun} scope`;
}
