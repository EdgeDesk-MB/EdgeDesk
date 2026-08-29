/** History feed note for a manual wallet movement. Shared by SQLite and Neon. */
export function historyNoteFromManualTx(
  note: string | undefined,
  category: "top_up" | "withdrawal" | "adjustment" | "free_bet"
): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  if (trimmed === category.replace("_", " ")) return null;
  if (trimmed === "Opening balance") return null;
  if (trimmed === "Manual free bet top-up") return null;
  if (/^Balance set to /.test(trimmed)) return null;
  return trimmed;
}
