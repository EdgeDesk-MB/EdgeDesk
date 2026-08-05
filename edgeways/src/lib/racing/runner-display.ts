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

/** Decode Racing API sex / sex_code (C, F, G, …). */
export function formatSex(code?: string | null): string | undefined {
  if (!code?.trim()) return undefined;
  const key = code.trim().toUpperCase();
  const map: Record<string, string> = {
    C: "Colt",
    F: "Filly",
    G: "Gelding",
    H: "Horse",
    M: "Mare",
    R: "Rig",
  };
  if (map[key]) return map[key];
  // Already a word ("gelding") — title-case lightly
  if (key.length > 1) {
    return key.charAt(0) + key.slice(1).toLowerCase();
  }
  return key;
}

/** Days since last run → compact "12d". */
export function formatLastRun(days?: number | null): string | undefined {
  if (days == null || !Number.isFinite(days) || days < 0) return undefined;
  return `${Math.round(days)}d`;
}

/** Class 4 + rating band 0-85 → "Class 4 (0-85)". */
export function formatRaceClassLabel(
  raceClass?: string | null,
  ratingBand?: string | null
): string | undefined {
  const cls = raceClass?.trim();
  const band = ratingBand?.trim();
  if (!cls && !band) return undefined;
  if (cls && band) {
    if (cls.toLowerCase().includes(band.toLowerCase())) return cls;
    return `${cls} (${band})`;
  }
  return cls || band || undefined;
}

/** Split "Shay Farmer(5)" → { name, claimLbs } */
export function parseJockeyName(raw: string): { name: string; claimLbs?: number } {
  const m = raw.match(/^(.+?)\((\d+)\)\s*$/);
  if (m) {
    return { name: m[1].trim(), claimLbs: parseInt(m[2], 10) };
  }
  return { name: raw.trim() || "-" };
}
