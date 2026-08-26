/**
 * EDGE-105: mirror the sign-up ToS/Privacy consent from Clerk unsafeMetadata
 * (client-writable, weak) into a server-recorded app_users row. The server
 * stamps its own timestamp and the document version it observed, so the audit
 * trail does not trust client-supplied times.
 */
import "server-only";

import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal/public";
import {
  ensureAppUser,
  recordAppUserLegalAcceptance,
} from "@/lib/services/app-users";
import { primaryClerkEmail } from "@/lib/db/desk-scope";

type ClerkUserLike = {
  id: string;
  unsafeMetadata?: unknown;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
} | null;

export function clerkLegalAccepted(user: ClerkUserLike): boolean {
  const meta = (user?.unsafeMetadata ?? {}) as Record<string, unknown>;
  return meta.legalAccepted === true;
}

/** Never throws - consent recording must not break the request it rode in on. */
export async function syncLegalAcceptanceFromClerkUser(
  user: ClerkUserLike
): Promise<void> {
  if (!user || !clerkLegalAccepted(user)) return;
  try {
    await ensureAppUser({
      clerkUserId: user.id,
      email: primaryClerkEmail(user as Parameters<typeof primaryClerkEmail>[0]),
    });
    await recordAppUserLegalAcceptance({
      clerkUserId: user.id,
      legalVersion: LEGAL_EFFECTIVE_DATE,
    });
  } catch (error) {
    console.error("[legal] acceptance sync failed:", error);
  }
}
