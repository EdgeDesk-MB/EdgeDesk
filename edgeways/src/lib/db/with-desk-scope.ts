import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import {
  primaryClerkEmail,
  runWithDeskActor,
  type DeskActor,
} from "@/lib/db/desk-scope";
import { syncLegalAcceptanceFromClerkUser } from "@/lib/legal/record-acceptance";

const emailByUserId = new Map<string, string | null>();

export async function resolveDeskActor(): Promise<DeskActor> {
  try {
    const { userId } = await auth();
    if (!userId) return { clerkUserId: null, email: null };
    if (emailByUserId.has(userId)) {
      return { clerkUserId: userId, email: emailByUserId.get(userId) ?? null };
    }
    const user = await currentUser();
    const email = primaryClerkEmail(user);
    emailByUserId.set(userId, email);
    // EDGE-105: we already hold the Clerk user here exactly once per user per
    // instance - the cheapest place to mirror legal consent server-side.
    // NULL-guarded, so the write happens at most once per user ever.
    await syncLegalAcceptanceFromClerkUser(user);
    return { clerkUserId: userId, email };
  } catch {
    return { clerkUserId: null, email: null };
  }
}

export function withDeskScope<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => TResult | Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    const actor = await resolveDeskActor();
    return await runWithDeskActor(actor, () => handler(...args));
  };
}
