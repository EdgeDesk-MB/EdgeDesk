import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";
import { verifyPublicDemoCookieValue } from "@/lib/demo/public-demo-cookie";
import { publicDemoRacingDesk } from "@/lib/demo/public-racing-desk";
import { getRacingDesk } from "@/lib/services/racing-desk";
import type { ExchangeProvider } from "@/lib/services/exchange/types";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";
import { getDeskActor } from "@/lib/db/desk-scope";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";
/** Betfair identity often challenges US datacentre IPs; prefer London. */
export const preferredRegion = ["lhr1", "iad1"];

const PROVIDERS = new Set<ExchangeProvider>([
  "betfair",
  "betdaq",
  "matchbook",
  "smarkets",
]);

export const GET = withDeskScope(async function GET(req: NextRequest) {
  // Aliased Neon id, not the raw Clerk id: localhost (Clerk test keys) must
  // read the same desk as live (Clerk prod keys issue a different user id).
  const clerkUserId = getDeskActor().neonClerkUserId || getDeskActor().clerkUserId;
  const date =
    req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const raw = req.nextUrl.searchParams.get("exchange");
  const exchangeProvider =
    raw && PROVIDERS.has(raw as ExchangeProvider) ? (raw as ExchangeProvider) : null;
  if (
    await verifyPublicDemoCookieValue(
      (await cookies()).get(PUBLIC_DEMO_COOKIE)?.value
    )
  ) {
    return NextResponse.json(publicDemoRacingDesk(date));
  }
  const demo = publicDemoRacingDesk(date);
  const denied = await lockedFeedResponse("racing_live_feeds", {
    source: "locked",
    ...demo,
  });
  if (denied) return denied;
  const payload = await getRacingDesk(date, { exchangeProvider, clerkUserId });
  return NextResponse.json(payload);
});
