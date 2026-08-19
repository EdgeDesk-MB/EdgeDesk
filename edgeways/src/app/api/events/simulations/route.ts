import { NextResponse } from "next/server";
import { purgeSimulationData } from "@/lib/services/purge-simulations";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/** DELETE simulated match events and their history feed entries. */
export const DELETE = withDeskScope(async function DELETE() {
  const result = purgeSimulationData();
  return NextResponse.json({ ok: true, ...result });
});
