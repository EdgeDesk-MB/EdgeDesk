import { NextRequest, NextResponse } from "next/server";
import { demoFixtures, fixturesByDate, hasApiKey } from "@/lib/services/apifootball";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!hasApiKey()) {
    return NextResponse.json({ source: "demo", fixtures: demoFixtures() });
  }
  try {
    const fixtures = await fixturesByDate(date);
    return NextResponse.json({ source: "api-football", fixtures });
  } catch (error) {
    return NextResponse.json(
      { source: "error", fixtures: [], error: String(error) },
      { status: 502 }
    );
  }
}
