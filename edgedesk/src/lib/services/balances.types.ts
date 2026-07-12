/**
 * Client-safe balance types (no SQLite / server services).
 */
import type { AccountRow } from "@/lib/db/schema";

export interface AccountBalance extends AccountRow {
  balance: number;
  freeBets: number;
  /** Confirmed cash only - pending credits excluded */
  pendingIn: number;
}

export interface BalanceSummary {
  total: number;
  bookies: number;
  exchanges: number;
  banks: number;
  pendingBankCredits: number;
  inBets: number;
  bankroll: number;
  accounts: AccountBalance[];
}
