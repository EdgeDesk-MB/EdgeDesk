/**
 * EDGE-83: server 403 for gated provider routes. Resolve billing once, then
 * deny only when `shouldDenyFeed` is true.
 */
import "server-only";

import { NextResponse } from "next/server";
import { shouldDenyFeed } from "@/lib/entitlements/feed-access";
import { resolveEntitlementBilling } from "@/lib/entitlements/resolve-billing";
import type { FeatureFlag } from "@/lib/entitlements/features";

export async function isFeedDenied(feature: FeatureFlag): Promise<boolean> {
  return shouldDenyFeed(await resolveEntitlementBilling(), feature);
}

export async function lockedFeedResponse(
  feature: FeatureFlag,
  body: unknown
): Promise<NextResponse | null> {
  if (!(await isFeedDenied(feature))) return null;
  return NextResponse.json(body, { status: 403 });
}
