import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateHistoryNote } from "@/lib/services/history-feed";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  note: z.string().nullable(),
});

export async function PATCH(
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

  const entry = updateHistoryNote(id, parsed.data.note);
  if (!entry) {
    return NextResponse.json(
      { error: "Balance correction not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ entry });
}
