import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import {
  primaryClerkEmail,
  runWithDeskActor,
  type DeskActor,
} from "@/lib/db/desk-scope";

const emailByUserId = new Map<string, string | null>();

export async function resolveDeskActor(): Promise<DeskActor> {
  try {
    const { userId } = await auth();
    if (!userId) return { clerkUserId: null, email: null };
    if (emailByUserId.has(userId)) {
      return { clerkUserId: userId, email: emailByUserId.get(userId) ?? null };
    }
    const email = primaryClerkEmail(await currentUser());
    emailByUserId.set(userId, email);
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
