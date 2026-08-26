import { NextResponse } from "next/server";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";
import { testExchangeConnections } from "@/lib/services/exchange";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const denied = await lockedFeedResponse("exchange_lay", {
    source: "locked",
    providers: [],
  });
  if (denied) return denied;

  const results = await testExchangeConnections();
  return NextResponse.json(results);
});
