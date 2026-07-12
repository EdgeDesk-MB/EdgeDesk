/** Decode Racing API horse colour codes. */
export function formatHorseColour(code?: string | null): string | undefined {
  if (!code?.trim()) return undefined;
  const map: Record<string, string> = {
    b: "Bay",
    br: "Brown",
    ch: "Chestnut",
    gr: "Grey",
    ro: "Roan",
    bl: "Black",
    bk: "Black",
    wh: "White",
  };
  return map[code.trim().toLowerCase()] ?? code.toUpperCase();
}

export function formatHeadgear(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim().toUpperCase();
  const map: Record<string, string> = {
    B: "Blinkers",
    V: "Visor",
    H: "Hood",
    T: "Tongue strap",
    P: "Cheekpieces",
    E: "Eye shield",
  };
  return map[s] ?? raw;
}

/** Split "Shay Farmer(5)" → { name, claimLbs } */
export function parseJockeyName(raw: string): { name: string; claimLbs?: number } {
  const m = raw.match(/^(.+?)\((\d+)\)\s*$/);
  if (m) {
    return { name: m[1].trim(), claimLbs: parseInt(m[2], 10) };
  }
  return { name: raw.trim() || "-" };
}
