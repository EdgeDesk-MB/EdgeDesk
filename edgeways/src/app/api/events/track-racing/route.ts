import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findOrCreateRacingEvent } from "@/lib/services/racing-events";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { isFeedDenied } from "@/lib/entitlements/feed-guard";

export const dynamic = "force-dynamic";

const schema = z.object({
  course: z.string().min(1),
  startTime: z.number(),
  raceName: z.string().optional(),
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  // Plain 403 like /api/events/track: write route, callers dereference the event.
  if (await isFeedDenied("calculators")) {
    return NextResponse.json({ error: "Sign in to track races" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await findOrCreateRacingEvent(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
});
