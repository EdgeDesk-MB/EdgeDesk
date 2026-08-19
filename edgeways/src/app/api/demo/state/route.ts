import { NextResponse } from "next/server";
import { buildPublicDemoState } from "@/lib/demo/public-fixture";
import { parsePublicDemoView } from "@/lib/demo/public-demo";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET(request: Request) {
  const view = parsePublicDemoView(new URL(request.url).searchParams.get("view"));
  return NextResponse.json(buildPublicDemoState(view));
});
