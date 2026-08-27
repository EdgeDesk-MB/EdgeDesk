import type { AdminUserRow } from "@/lib/services/app-users";

export type LeavingRow = {
  clerkUserId: string;
  email: string | null;
  plan: string;
  reason: "Trial ending" | "Cancel scheduled";
  /** The trial end or scheduled cancel date. */
  at: number;
};

const TRIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Accounts about to leave: trial ends within 7 days, or a cancel is scheduled
 * while access continues. Sorted soonest first. Both dates already live on
 * app_users, so this is a read, not new telemetry.
 */
export function buildLeavingRows(
  users: AdminUserRow[],
  now: number = Date.now()
): LeavingRow[] {
  const rows: LeavingRow[] = [];
  for (const user of users) {
    if (
      user.trialEndsAt != null &&
      user.trialEndsAt > now &&
      user.trialEndsAt <= now + TRIAL_WINDOW_MS
    ) {
      rows.push({
        clerkUserId: user.clerkUserId,
        email: user.email,
        plan: user.plan,
        reason: "Trial ending",
        at: user.trialEndsAt,
      });
    } else if (user.cancelAt != null && user.cancelAt > now) {
      rows.push({
        clerkUserId: user.clerkUserId,
        email: user.email,
        plan: user.plan,
        reason: "Cancel scheduled",
        at: user.cancelAt,
      });
    }
  }
  return rows.sort((a, b) => a.at - b.at);
}
