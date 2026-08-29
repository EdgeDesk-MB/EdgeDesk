import { NextResponse } from "next/server";
import { purgeSimulationData } from "@/lib/services/purge-simulations";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { blockHostedDeskMutation } from "@/lib/db/hosted-desk-guard";

export const dynamic = "force-dynamic";

/** DELETE simulated match events and their history feed entries. */
export const DELETE = withDeskScope(async function DELETE() {
  const blocked = blockHostedDeskMutation("Simulations");
  if (blocked) return blocked;
  const result = purgeSimulationData();
  return NextResponse.json({ ok: true, ...result });
});
