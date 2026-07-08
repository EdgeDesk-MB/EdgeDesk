import { NextResponse } from "next/server";
import { getAppState } from "@/lib/services/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getAppState();
  return NextResponse.json(state);
}
