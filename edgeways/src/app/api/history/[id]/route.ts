import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateHistoryNote } from "@/lib/services/history-feed";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { patchNeonDeskHistoryNote } from "@/lib/db/neon-desk-history";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  note: z.string().nullable(),
});

export const PATCH = withDeskScope(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (isNeonDesk()) {
    try {
      const entry = await patchNeonDeskHistoryNote(id, parsed.data.note);
      if (!entry) {
        return NextResponse.json(
          { error: "Balance correction not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ entry });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the note.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  const entry = updateHistoryNote(id, parsed.data.note);
  if (!entry) {
    return NextResponse.json(
      { error: "Balance correction not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ entry });
});
