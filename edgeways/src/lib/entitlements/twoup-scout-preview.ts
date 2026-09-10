/**
 * 2UP scout preview. Localhost is always on. Hosted uses desk previews
 * (Releases), falling back to the owner email until that row is saved.
 */
import "server-only";

import { auth } from "@clerk/nextjs/server";
import { resolveDeskPreview } from "@/lib/admin/desk-previews";
import { isNeonDesk } from "@/lib/db/desk-backend";

export async function resolveTwoupScoutPreview(): Promise<boolean> {
  if (!isNeonDesk()) return true;
  try {
    const { userId } = await auth();
    return resolveDeskPreview("twoup_scout", userId);
  } catch (err) {
    console.error("[entitlements] 2UP scout preview resolve failed:", err);
    return false;
  }
}
