import { NextResponse } from "next/server";
import { getAppState } from "@/lib/services/state";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { resolveEntitlementBilling } from "@/lib/entitlements/resolve-billing";
import { resolveTwoupScoutPreview } from "@/lib/entitlements/twoup-scout-preview";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const [state, billing, twoupScoutPreview] = await Promise.all([
    getAppState(),
    resolveEntitlementBilling(),
    resolveTwoupScoutPreview(),
  ]);
  return NextResponse.json({
    ...state,
    settings: { ...state.settings, billing, twoupScoutPreview },
  });
});
