/** Stake source for Acca / Bet Builder / Systems desk back bets. */
export type DeskBackBetType = "qualifying" | "free_snr" | "free_sr";

export function normaliseDeskBackBetType(
  value?: string | null
): DeskBackBetType {
  if (value === "free_snr" || value === "free_sr") return value;
  return "qualifying";
}

export function isDeskFreeBetType(
  value?: string | null
): value is "free_snr" | "free_sr" {
  return value === "free_snr" || value === "free_sr";
}

export function deskBackBetLabel(
  prefix: string,
  label: string,
  betType: string | null | undefined
): string {
  const free = isDeskFreeBetType(betType);
  return free ? `${prefix} FB · ${label}` : `${prefix} · ${label}`;
}

/** Primary sport for a multi-leg desk ticket (first set sport wins). */
export function primarySportFromLegs(
  legs: Array<{ sport?: string | null }>
): string | null {
  for (const leg of legs) {
    const s = leg.sport?.trim();
    if (s) return s;
  }
  return null;
}
