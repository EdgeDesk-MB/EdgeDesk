import { NextRequest, NextResponse } from "next/server";
import { getRacingDesk } from "@/lib/services/racing-desk";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date =
    req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const payload = await getRacingDesk(date);
  return NextResponse.json(payload);
}
