import { NextRequest, NextResponse } from "next/server";
import { getAppState } from "@/lib/services/state";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { resolveEntitlementBilling } from "@/lib/entitlements/resolve-billing";
import { resolveTwoupScoutPreview } from "@/lib/entitlements/twoup-scout-preview";
import {
  PRIVATE_REVALIDATE,
  etagForJsonBody,
  ifNoneMatchHits,
  slimAppStateForWire,
} from "@/lib/services/app-state-wire";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const [state, billing, twoupScoutPreview] = await Promise.all([
    getAppState(),
    resolveEntitlementBilling(),
    resolveTwoupScoutPreview(),
  ]);
  const payload = slimAppStateForWire({
    ...state,
    settings: { ...state.settings, billing, twoupScoutPreview },
  });
  const body = JSON.stringify(payload);
  const etag = etagForJsonBody(body);
  const headers = {
    ETag: etag,
    "Cache-Control": PRIVATE_REVALIDATE,
    "Content-Type": "application/json",
  };
  if (ifNoneMatchHits(req.headers.get("if-none-match"), etag)) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, { status: 200, headers });
});
