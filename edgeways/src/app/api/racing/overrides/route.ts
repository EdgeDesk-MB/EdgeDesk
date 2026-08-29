import { NextRequest, NextResponse } from "next/server";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  clearNeonOddsOverride,
  upsertNeonOddsOverride,
} from "@/lib/db/neon-desk-racing-overrides";
import {
  clearOddsOverride,
  upsertOddsOverride,
} from "@/lib/services/racing-odds-overrides";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

function parseDecimal(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n) || n <= 1) return null;
  return n;
}

/** Upsert manual bookie/exchange odds for a runner (Free-tier paste override). */
export const POST = withDeskScope(async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      raceId?: string;
      horseId?: string;
      bookieDecimal?: number | string | null;
      exchangeDecimal?: number | string | null;
    };
    const raceId = body.raceId?.trim();
    const horseId = body.horseId?.trim();
    if (!raceId || !horseId) {
      return NextResponse.json({ error: "raceId and horseId required" }, { status: 400 });
    }

    const payload = {
      raceId,
      horseId,
      bookieDecimal: parseDecimal(body.bookieDecimal),
      exchangeDecimal: parseDecimal(body.exchangeDecimal),
    };
    const override = isNeonDesk()
      ? await upsertNeonOddsOverride(payload)
      : upsertOddsOverride(payload);
    return NextResponse.json({ override });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.startsWith("Sign in") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
});

/** Clear manual override for a runner. */
export const DELETE = withDeskScope(async function DELETE(req: NextRequest) {
  const raceId = req.nextUrl.searchParams.get("raceId")?.trim();
  const horseId = req.nextUrl.searchParams.get("horseId")?.trim();
  if (!raceId || !horseId) {
    return NextResponse.json({ error: "raceId and horseId required" }, { status: 400 });
  }
  if (isNeonDesk()) {
    await clearNeonOddsOverride(raceId, horseId);
  } else {
    clearOddsOverride(raceId, horseId);
  }
  return NextResponse.json({ ok: true });
});
