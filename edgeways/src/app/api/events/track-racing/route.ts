import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findOrCreateRacingEvent } from "@/lib/services/racing-events";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const schema = z.object({
  course: z.string().min(1),
  startTime: z.number(),
  raceName: z.string().optional(),
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
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
