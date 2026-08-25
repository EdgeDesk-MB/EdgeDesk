/**
 * EDGE-22: resolve the signed-in user's real billing row for the desk gate.
 * Operators (bootstrap admin / role=admin) always resolve to Edge so Sam's
 * own desk is never locked by his test subscriptions.
 */
import "server-only";

import { auth } from "@clerk/nextjs/server";
import { isOperatorAdmin } from "@/lib/admin/emails";
import { findAppUserByClerkId } from "@/lib/services/app-users";
import type { EntitlementBilling } from "@/lib/entitlements/effective-plan";

export async function resolveEntitlementBilling(): Promise<EntitlementBilling | null> {
  try {
    const { userId } = await auth();
    if (!userId) return null;
    const user = await findAppUserByClerkId(userId);
    if (!user) return null;
    if (isOperatorAdmin({ email: user.email, role: user.role })) {
      return { plan: "edge", billingStatus: "active" };
    }
    return { plan: user.plan, billingStatus: user.billingStatus };
  } catch (err) {
    // Fail open: a Neon/Clerk blip must never lock a paying user out of the
    // desk. Logged server-side; the gate falls back to preview behaviour.
    console.error("[entitlements] billing resolve failed:", err);
    return null;
  }
}
