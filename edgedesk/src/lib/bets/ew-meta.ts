/**
 * Persist each-way / extra-place lay structure on bet rows via `notes` JSON.
 */

export interface EachWayBetMeta {
  stakePerPart: number;
  placeFraction: number;
  layWin: { stake: number; odds: number };
  layPlace: { stake: number; odds: number };
  bookiePlaces: number;
  exchangePlaces: number;
  mode: "each_way" | "extra_place";
}

const META_KEY = "edgedesk_ew";

export function serializeEwMeta(meta: EachWayBetMeta): string {
  return JSON.stringify({ [META_KEY]: meta });
}

export function parseEwMeta(notes: string | null | undefined): EachWayBetMeta | null {
  if (!notes?.trim()) return null;
  const candidates = [notes.trim()];
  const pipe = notes.indexOf(" | ");
  if (pipe >= 0) candidates.push(notes.slice(0, pipe).trim());

  for (const raw of candidates) {
    if (!raw.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const hit = parsed[META_KEY];
      if (hit && typeof hit === "object") return hit as EachWayBetMeta;
    } catch {
      /* human notes or settlement append */
    }
  }
  return null;
}
