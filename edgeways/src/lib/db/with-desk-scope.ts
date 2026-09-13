import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  primaryClerkEmail,
  runWithDeskActor,
  type DeskActor,
} from "@/lib/db/desk-scope";
import { resolveCanonicalNeonClerkUserId } from "@/lib/db/neon-desk-alias";
import { syncLegalAcceptanceFromClerkUser } from "@/lib/legal/record-acceptance";

const emailByUserId = new Map<string, string | null>();

export async function resolveDeskActor(): Promise<DeskActor> {
  try {
    const { userId } = await auth();
    if (!userId) return { clerkUserId: null, email: null };
    const cachedEmail = emailByUserId.get(userId);
    if (cachedEmail) {
      return { clerkUserId: userId, email: cachedEmail };
    }
    const user = await currentUser();
    const email = primaryClerkEmail(user);
    if (email) emailByUserId.set(userId, email);
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
    const neonClerkUserId =
      isNeonDesk() && actor.clerkUserId
        ? await resolveCanonicalNeonClerkUserId(actor)
        : actor.clerkUserId;
    // Async callback so the actor survives `cookies()` / racecard awaits.
    // A sync wrapper that merely returns a promise can drop AsyncLocalStorage
    // on the serverless isolate after the first await.
    return await runWithDeskActor(
      { ...actor, neonClerkUserId },
      async () => handler(...args)
    );
  };
}
