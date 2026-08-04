/**
 * Wagering-requirement helpers (Ultimatcher Bookies sheet WR).
 */
import { eq } from "drizzle-orm";
import { db, accounts, type AccountRow, type BetRow } from "@/lib/db";

export type WrType = "stake" | "risk_win";

/** How much of this cash back bet counts toward outstanding WR. */
export function wrContributionForBet(
  bet: Pick<BetRow, "backStake" | "backOdds" | "betType">,
  account: Pick<AccountRow, "wrRemaining" | "wrMinOdds" | "wrType">
): number {
  if (account.wrRemaining <= 0) return 0;
  if (bet.betType === "free_snr" || bet.betType === "free_sr") return 0;
  if (!(bet.backStake > 0) || !(bet.backOdds > 1)) return 0;

  const minOdds = account.wrMinOdds;
  if (minOdds != null && minOdds > 1 && bet.backOdds + 0.0001 < minOdds) return 0;

  const stake = bet.backStake;
  if (account.wrType === "risk_win") {
    const win = stake * (bet.backOdds - 1);
    return Math.min(stake, win, account.wrRemaining);
  }
  return Math.min(stake, account.wrRemaining);
}

/** Reduce outstanding WR after a cash bet is ledgered. Returns amount burned. */
export function applyWageringRequirement(bet: BetRow, bookieAccountId: number): number {
  const account = db.select().from(accounts).where(eq(accounts.id, bookieAccountId)).get();
  if (!account || account.type !== "bookie") return 0;

  const burn = wrContributionForBet(bet, account);
  if (!(burn > 0)) return 0;

  const next = Math.max(0, Math.round((account.wrRemaining - burn) * 100) / 100);
  db.update(accounts)
    .set({ wrRemaining: next })
    .where(eq(accounts.id, bookieAccountId))
    .run();
  return burn;
}

export function setWageringRequirement(
  accountId: number,
  input: {
    wrRemaining: number;
    wrMinOdds?: number | null;
    wrType?: WrType;
  }
): AccountRow {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) throw new Error("Account not found");
  if (account.type !== "bookie") throw new Error("WR only applies to bookies");

  return db
    .update(accounts)
    .set({
      wrRemaining: Math.max(0, input.wrRemaining),
      wrMinOdds:
        input.wrMinOdds === undefined
          ? account.wrMinOdds
          : input.wrMinOdds != null && input.wrMinOdds > 1
            ? input.wrMinOdds
            : null,
      wrType: input.wrType ?? account.wrType ?? "stake",
    })
    .where(eq(accounts.id, accountId))
    .returning()
    .get();
}
