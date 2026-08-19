import { NextResponse } from "next/server";
import { getAppState } from "@/lib/services/state";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const state = await getAppState();
  return NextResponse.json(state);
});
