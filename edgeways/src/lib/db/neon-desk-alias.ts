/**
 * Clerk Development and Production issue different user ids for the same
 * email. Hosted desk rows are keyed by clerk_user_id, so localhost (test
 * keys) would otherwise open an empty copy of the Live desk. Resolve to the
 * Neon row that already holds the data.
 */
import "server-only";

import { count, inArray, sql } from "drizzle-orm";
import {
  deskOwnerUserId,
  pickCanonicalNeonClerkUserId,
  type DeskActor,
} from "@/lib/db/desk-scope";
import { getNeonDb } from "@/lib/db/neon";
import { appUsers as pgUsers, offers as pgOffers } from "@/lib/db/schema.pg";

const canonicalByEmail = new Map<string, string>();

export function clearNeonDeskAliasCache(): void {
  canonicalByEmail.clear();
}

export async function resolveCanonicalNeonClerkUserId(
  actor: DeskActor
): Promise<string | null> {
  const signedIn = actor.clerkUserId?.trim() || null;
  if (!signedIn) return null;
  const email = actor.email?.trim().toLowerCase() || null;
  if (!email) return signedIn;

  const cached = canonicalByEmail.get(email);
  if (cached) return cached;

  try {
    const db = getNeonDb();
    const users = await db
      .select({
        clerkUserId: pgUsers.clerkUserId,
        createdAt: pgUsers.createdAt,
      })
      .from(pgUsers)
      .where(sql`lower(coalesce(${pgUsers.email}, '')) = ${email}`);

    if (users.length <= 1) {
      const only = users[0]?.clerkUserId.trim() || signedIn;
      canonicalByEmail.set(email, only);
      return only;
    }

    const ids = users.map((row) => row.clerkUserId);
    const offerRows = await db
      .select({
        clerkUserId: pgOffers.clerkUserId,
        n: count(),
      })
      .from(pgOffers)
      .where(inArray(pgOffers.clerkUserId, ids))
      .groupBy(pgOffers.clerkUserId);

    const countById = new Map(
      offerRows
        .filter((row) => row.clerkUserId)
        .map((row) => [row.clerkUserId as string, Number(row.n)])
    );
    const picked = pickCanonicalNeonClerkUserId({
      signedInUserId: signedIn,
      preferredUserId: deskOwnerUserId(),
      candidates: users.map((row) => ({
        clerkUserId: row.clerkUserId,
        createdAt: row.createdAt,
        offerCount: countById.get(row.clerkUserId) ?? 0,
      })),
    });
    canonicalByEmail.set(email, picked);
    return picked;
  } catch (error) {
    console.error("[neon-desk-alias] could not resolve shared desk", error);
    return signedIn;
  }
}
