/**
 * Hosted-desk mutation guard. Features that still only write SQLite must not
 * return success against a Neon-backed Home snapshot.
 */
import { NextResponse } from "next/server";
import { isNeonDesk } from "@/lib/db/desk-backend";

export function hostedDeskNotReadyResponse(feature: string): NextResponse {
  return NextResponse.json(
    { error: `${feature} is not available on the hosted desk yet.` },
    { status: 400 }
  );
}

/** Non-null when this request is a hosted desk and the feature is still SQLite-only. */
export function blockHostedDeskMutation(feature: string): NextResponse | null {
  return isNeonDesk() ? hostedDeskNotReadyResponse(feature) : null;
}
