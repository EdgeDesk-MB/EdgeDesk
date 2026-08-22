/**
 * Where the desk (bets, later offers and wallets) is stored.
 *
 * DATABASE_URL alone is not enough: localhost already uses Neon for the
 * waitlist and accounts. The Mac file stays the desk until this flag is
 * set on a hosted deploy (Vercel Preview first).
 */
export function isNeonDesk(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (
    env.EDGEWAYS_DESK_BACKEND?.trim() === "neon" &&
    Boolean(env.DATABASE_URL?.trim())
  );
}
