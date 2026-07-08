import { NextResponse } from "next/server";
import { purgeSimulationData } from "@/lib/services/purge-simulations";

export const dynamic = "force-dynamic";

/** DELETE simulated match events and their history feed entries. */
export async function DELETE() {
  const result = purgeSimulationData();
  return NextResponse.json({ ok: true, ...result });
}
