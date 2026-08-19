import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureVenueAccount } from "@/lib/accounts/ensure-venue";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1),
  kind: z.enum(["bookie", "exchange"]),
});

/** Idempotent: create/reactivate a bookie or exchange wallet from a free-typed name. */
export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = ensureVenueAccount(parsed.data.name, parsed.data.kind);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
});
