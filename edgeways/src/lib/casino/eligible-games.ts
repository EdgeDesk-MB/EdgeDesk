/**
 * Persist the eligible-games picker selection as a JSON string of names
 * (not library ids, which can change if the library is rebuilt).
 */

const MAX_NAMES = 80;
const MAX_NAME_LEN = 120;

export function serializeEligibleGames(names: string[] | null | undefined): string | null {
  if (!names || names.length === 0) return null;
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name || name.length > MAX_NAME_LEN) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(name);
    if (cleaned.length >= MAX_NAMES) break;
  }
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

export function parseEligibleGamesJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const names: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const name = item.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}
