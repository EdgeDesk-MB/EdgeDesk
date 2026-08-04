import { NextResponse } from "next/server";
import { testExchangeConnections } from "@/lib/services/exchange";

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await testExchangeConnections();
  return NextResponse.json(results);
}
