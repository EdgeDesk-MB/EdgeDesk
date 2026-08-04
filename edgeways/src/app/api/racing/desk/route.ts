import { NextRequest, NextResponse } from "next/server";
import { getRacingDesk } from "@/lib/services/racing-desk";
import type { ExchangeProvider } from "@/lib/services/exchange/types";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set<ExchangeProvider>([
  "betfair",
  "betdaq",
  "matchbook",
  "smarkets",
]);

export async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const raw = req.nextUrl.searchParams.get("exchange");
  const exchangeProvider =
    raw && PROVIDERS.has(raw as ExchangeProvider) ? (raw as ExchangeProvider) : null;
  const payload = await getRacingDesk(date, { exchangeProvider });
  return NextResponse.json(payload);
}
