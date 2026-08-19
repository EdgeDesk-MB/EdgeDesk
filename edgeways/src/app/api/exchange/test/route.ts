import { NextResponse } from "next/server";
import { testExchangeConnections } from "@/lib/services/exchange";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const results = await testExchangeConnections();
  return NextResponse.json(results);
});
