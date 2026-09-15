import { normaliseBookieName } from "@/lib/twoup/bookie-offers";

export function accountsScopeHref(
  venueId: number,
  surface: "early_payout" | "racing" = "early_payout"
): string {
  const params = new URLSearchParams({
    venue: String(venueId),
    scope: surface,
  });
  return `/accounts?${params.toString()}`;
}

export function venueIdForBookie(
  accounts: readonly { id: number; name: string }[],
  bookie: string
): number | null {
  const key = normaliseBookieName(bookie);
  if (!key) return null;
  const hit = accounts.find((account) => normaliseBookieName(account.name) === key);
  return hit?.id ?? null;
}
