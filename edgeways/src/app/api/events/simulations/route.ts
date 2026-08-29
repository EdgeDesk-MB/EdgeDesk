import { NextResponse } from "next/server";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/** Match simulation is retired. Leftover rows can be removed one by one. */
export const DELETE = withDeskScope(async function DELETE() {
  return NextResponse.json(
    { error: "Match simulation is no longer available." },
    { status: 410 }
  );
});
