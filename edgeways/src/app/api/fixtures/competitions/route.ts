import { NextResponse } from "next/server";
import { demoCompetitions, hasApiKey } from "@/lib/services/apifootball";
import { getFootballCompetitionCatalog } from "@/lib/services/football-competition-store";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { lockedFeedResponse } from "@/lib/entitlements/feed-guard";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const locked = await lockedFeedResponse("calculators", {
    source: "locked",
    competitions: [],
  });
  if (locked) return locked;

  if (!hasApiKey()) {
    return NextResponse.json({ source: "demo", competitions: demoCompetitions() });
  }

  try {
    const competitions = await getFootballCompetitionCatalog();
    return NextResponse.json({ source: "feed", competitions });
  } catch (error) {
    console.error("[fixtures/competitions] catalog failed:", error);
    return NextResponse.json({ source: "feed", competitions: [] });
  }
});
