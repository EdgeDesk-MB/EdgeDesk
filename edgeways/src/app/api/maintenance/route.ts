import { NextResponse } from "next/server";
import { readMaintenanceBanner } from "@/lib/admin/operator-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const banner = await readMaintenanceBanner();
  return NextResponse.json(banner);
}
