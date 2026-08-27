import type { AdminUserRow } from "@/lib/services/app-users";

export type StripeDrift = {
  /** Stripe customers with no matching app_users row. */
  stripeOnly: number;
  /** Paid accounts (core/edge) with no Stripe customer id. */
  deskOnly: number;
};

/**
 * Cross-check Stripe customer ids against app_users. Preview and production
 * share one Neon, so a paid desk with no Stripe customer (or the reverse)
 * is a billing link bug worth surfacing, not a number to hide.
 */
export function buildStripeDrift(
  users: AdminUserRow[],
  stripeCustomerIds: string[]
): StripeDrift {
  const deskIds = new Set(
    users
      .map((user) => user.stripeCustomerId)
      .filter((id): id is string => Boolean(id))
  );
  const stripeOnly = stripeCustomerIds.filter((id) => !deskIds.has(id)).length;
  const deskOnly = users.filter(
    (user) =>
      (user.plan === "core" || user.plan === "edge") && !user.stripeCustomerId
  ).length;
  return { stripeOnly, deskOnly };
}

export function stripeDriftNote(drift: StripeDrift): string | null {
  const parts: string[] = [];
  if (drift.stripeOnly > 0) {
    parts.push(
      `${drift.stripeOnly} Stripe customer${drift.stripeOnly === 1 ? "" : "s"} with no desk`
    );
  }
  if (drift.deskOnly > 0) {
    parts.push(
      `${drift.deskOnly} paid account${drift.deskOnly === 1 ? "" : "s"} with no Stripe customer`
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
